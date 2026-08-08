import { and, eq, gt, gte, ne, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { type Entry, entries, type Game, games, type Tier } from "@/db/schema";

/** A plain `Db` handle or an in-flight transaction `Tx` — both expose the same `select` surface used here. */
export type DbOrTx = Db | Tx;

export const TIER_BANDS: Record<Tier, { lo: number; hi: number }> = {
  liked: { lo: 6.7, hi: 10.0 },
  fine: { lo: 3.4, hi: 6.6 },
  disliked: { lo: 0.0, hi: 3.3 },
};

export const TIER_ORDER: Tier[] = ["liked", "fine", "disliked"];

/** Minimum total ranked entries (across all tiers) before scores are shown to the user. */
export const SCORE_UNLOCK_THRESHOLD = 10;

/** Whether a user with `entryCount` total ranked entries should see numeric scores. */
export function scoresUnlocked(entryCount: number): boolean {
  // Skip the threshold under `next dev` (not `vitest`, which sets NODE_ENV="test") so scores show without ranking 10 games first.
  if (process.env.NODE_ENV === "development") return true;
  return entryCount >= SCORE_UNLOCK_THRESHOLD;
}

/** The subset of a game's columns the ranked-list read path actually needs — narrower than `Game` to keep TOAST-able columns (summary, platforms) off the hottest query. */
export type RankedEntryGame = Pick<Game, "id" | "igdbId" | "name" | "coverImageId" | "firstReleaseDate">;

export type RankedEntry = {
  id: Entry["id"];
  gameId: Entry["gameId"];
  tier: Entry["tier"];
  position: Entry["position"];
  score: number;
  game: RankedEntryGame;
};

/** Derives a game's 0-10 score by interpolating its position within its tier's band (a lone entry gets `hi`), rounded to one decimal. */
export function computeScore(index: number, count: number, tier: Tier): number {
  const { lo, hi } = TIER_BANDS[tier];

  if (count === 1) {
    return hi;
  }

  const raw = hi - (index * (hi - lo)) / (count - 1);
  return Math.round(raw * 10) / 10;
}

const rankedEntrySelection = {
  id: entries.id,
  gameId: entries.gameId,
  tier: entries.tier,
  position: entries.position,
  score: entries.score,
  game: {
    id: games.id,
    igdbId: games.igdbId,
    name: games.name,
    coverImageId: games.coverImageId,
    firstReleaseDate: games.firstReleaseDate,
  },
};

function toRankedEntry(row: {
  id: number;
  gameId: number;
  tier: Tier;
  position: number;
  score: string;
  game: RankedEntryGame;
}): RankedEntry {
  return { ...row, score: Number(row.score) };
}

/** All of a user's entries, ordered by tier (liked, fine, disliked, matching the enum's declaration order) then position — lets the index serve the sort directly instead of an explicit CASE. */
export async function getRankedEntries(dbOrTx: DbOrTx, userId: string): Promise<RankedEntry[]> {
  const rows = await dbOrTx
    .select(rankedEntrySelection)
    .from(entries)
    .innerJoin(games, eq(entries.gameId, games.id))
    .where(eq(entries.userId, userId))
    .orderBy(entries.tier, entries.position);

  return rows.map(toRankedEntry);
}

/** A single tier's entries, ordered by position; pass `excludeEntryId` to build the "candidate list" for re-ranking. */
export async function getTierEntries(
  dbOrTx: DbOrTx,
  userId: string,
  tier: Tier,
  excludeEntryId?: number
): Promise<RankedEntry[]> {
  const conditions = [eq(entries.userId, userId), eq(entries.tier, tier)];
  if (excludeEntryId !== undefined) {
    conditions.push(ne(entries.id, excludeEntryId));
  }

  const rows = await dbOrTx
    .select(rankedEntrySelection)
    .from(entries)
    .innerJoin(games, eq(entries.gameId, games.id))
    .where(and(...conditions))
    .orderBy(entries.position);

  return rows.map(toRankedEntry);
}

async function countTierEntries(tx: Tx, userId: string, tier: Tier): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.tier, tier)));

  return row?.count ?? 0;
}

/** Inserts a new entry into `tier` at `position` (clamped to bounds), shifting later entries down, and recomputes tier scores. */
export async function insertEntry(
  tx: Tx,
  userId: string,
  gameId: number,
  tier: Tier,
  position: number
): Promise<number> {
  const count = await countTierEntries(tx, userId, tier);
  const clamped = Math.max(0, Math.min(position, count));

  await tx
    .update(entries)
    .set({ position: sql`${entries.position} + 1` })
    .where(and(eq(entries.userId, userId), eq(entries.tier, tier), gte(entries.position, clamped)));

  const [inserted] = await tx
    .insert(entries)
    .values({
      userId,
      gameId,
      tier,
      position: clamped,
      score: "0",
    })
    .returning();

  await recomputeTierScores(tx, userId, tier);

  return inserted.id;
}

async function loadOwnedEntry(tx: Tx, userId: string, entryId: number): Promise<Entry> {
  const [entry] = await tx
    .select()
    .from(entries)
    .where(and(eq(entries.id, entryId), eq(entries.userId, userId)))
    .limit(1);

  if (!entry) {
    throw new Error(`Entry ${entryId} not found for user ${userId}`);
  }

  return entry;
}

/** Moves an entry to `newPosition` (an index into `newTier`'s list excluding itself, clamped) and recomputes affected tier scores. */
export async function moveEntry(
  tx: Tx,
  userId: string,
  entryId: number,
  newTier: Tier,
  newPosition: number
): Promise<void> {
  const entry = await loadOwnedEntry(tx, userId, entryId);
  const oldTier = entry.tier;
  const oldPosition = entry.position;

  // Close the gap left behind in the old tier.
  await tx
    .update(entries)
    .set({ position: sql`${entries.position} - 1` })
    .where(and(eq(entries.userId, userId), eq(entries.tier, oldTier), gt(entries.position, oldPosition)));

  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.tier, newTier), ne(entries.id, entryId)));

  const clamped = Math.max(0, Math.min(newPosition, count));

  // Make room in the target tier without shifting the moving entry itself (still at its stale position).
  await tx
    .update(entries)
    .set({ position: sql`${entries.position} + 1` })
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.tier, newTier),
        gte(entries.position, clamped),
        ne(entries.id, entryId)
      )
    );

  await tx
    .update(entries)
    .set({ tier: newTier, position: clamped, updatedAt: new Date() })
    .where(eq(entries.id, entryId));

  await recomputeTierScores(tx, userId, oldTier);
  if (newTier !== oldTier) {
    await recomputeTierScores(tx, userId, newTier);
  }
}

/** Deletes an entry, closes the gap it left in its tier, and recomputes that tier's scores. */
export async function removeEntry(tx: Tx, userId: string, entryId: number): Promise<void> {
  const entry = await loadOwnedEntry(tx, userId, entryId);

  await tx.delete(entries).where(eq(entries.id, entryId));

  await tx
    .update(entries)
    .set({ position: sql`${entries.position} - 1` })
    .where(and(eq(entries.userId, userId), eq(entries.tier, entry.tier), gt(entries.position, entry.position)));

  await recomputeTierScores(tx, userId, entry.tier);
}

/** Renumbers `tier` to a dense 0..n-1 and rewrites every score in one statement. The arithmetic mirrors `computeScore`'s
    IEEE-754 double math bit-for-bit — exact `numeric` arithmetic disagrees at .05 ties (e.g. disliked index 5 of 7: 0.5
    vs 0.6), and casting float8 to numeric loses precision at ~16 significant digits, which also flips ties. Verified
    identical to computeScore for every index, all three tiers, n = 1..400. */
export async function recomputeTierScores(tx: Tx, userId: string, tier: Tier): Promise<void> {
  const { lo, hi } = TIER_BANDS[tier];

  await tx.execute(sql`
    with ranked as (
      select id,
             (row_number() over (order by position, id))::int - 1 as rn,
             (count(*) over ())::int as cnt
      from ${entries}
      where ${entries.userId} = ${userId} and ${entries.tier} = ${tier}
    ),
    interpolated as (
      select id, rn, cnt,
             ((${hi}::float8 - (rn::float8 * (${hi}::float8 - ${lo}::float8)) / ((cnt - 1)::float8)) * 10::float8) as x
      from ranked
    ),
    scored as (
      select id, rn,
             (case
                when cnt = 1 then ${hi}::numeric(3,1)
                else ((case when x - floor(x) >= 0.5 then floor(x) + 1 else floor(x) end)::numeric / 10)::numeric(3,1)
              end) as score
      from interpolated
    )
    update ${entries} as e
    set position = s.rn, score = s.score
    from scored s
    where e.id = s.id
      and (e.position is distinct from s.rn or e.score is distinct from s.score)
  `);
}
