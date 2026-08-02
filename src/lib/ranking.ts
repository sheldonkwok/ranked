import { and, eq, gt, gte, ne, sql } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { type Entry, entries, type Game, games, type Tier } from "@/db/schema";

/**
 * Read-only query functions accept either a plain `Db` handle (e.g. from
 * `getDb()` in a server component) or an in-flight transaction `Tx` (e.g.
 * from inside an API route's `db.transaction(...)` callback). Both expose
 * the same `select` query-builder surface we rely on here, so a simple
 * union typechecks cleanly against both drivers without needing a custom
 * structural interface.
 */
export type DbOrTx = Db | Tx;

export const TIER_BANDS: Record<Tier, { lo: number; hi: number }> = {
  liked: { lo: 6.7, hi: 10.0 },
  fine: { lo: 3.4, hi: 6.6 },
  disliked: { lo: 0.0, hi: 3.3 },
};

export const TIER_ORDER: Tier[] = ["liked", "fine", "disliked"];

/** SQL fragment ordering rows by TIER_ORDER (liked, fine, disliked). */
const tierOrderSql = sql`case ${entries.tier} when 'liked' then 0 when 'fine' then 1 when 'disliked' then 2 else 3 end`;

export type RankedEntry = {
  id: Entry["id"];
  userId: Entry["userId"];
  gameId: Entry["gameId"];
  tier: Entry["tier"];
  position: Entry["position"];
  score: number;
  createdAt: Entry["createdAt"];
  updatedAt: Entry["updatedAt"];
  game: Game;
};

/**
 * Derives a game's 0-10 score from its position within its tier.
 *
 * A tier's band is spread evenly across its members: the best entry
 * (index 0) gets `hi`, the worst (index count-1) gets `lo`, and everything
 * else is linearly interpolated. A lone entry in a tier gets `hi`. Result
 * is rounded to one decimal place.
 */
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
  userId: entries.userId,
  gameId: entries.gameId,
  tier: entries.tier,
  position: entries.position,
  score: entries.score,
  createdAt: entries.createdAt,
  updatedAt: entries.updatedAt,
  game: games,
};

function toRankedEntry(row: {
  id: number;
  userId: string;
  gameId: number;
  tier: Tier;
  position: number;
  score: string;
  createdAt: Date;
  updatedAt: Date;
  game: Game;
}): RankedEntry {
  return { ...row, score: Number(row.score) };
}

/** All of a user's entries, ordered by tier (liked, fine, disliked) then position. */
export async function getRankedEntries(
  dbOrTx: DbOrTx,
  userId: string
): Promise<RankedEntry[]> {
  const rows = await dbOrTx
    .select(rankedEntrySelection)
    .from(entries)
    .innerJoin(games, eq(entries.gameId, games.id))
    .where(eq(entries.userId, userId))
    .orderBy(tierOrderSql, entries.position);

  return rows.map(toRankedEntry);
}

/**
 * A single tier's entries, ordered by position. Pass `excludeEntryId` to
 * build the "candidate list" a client compares a specific entry against
 * during re-ranking (e.g. when moving that entry within the same tier).
 */
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

async function countTierEntries(
  tx: Tx,
  userId: string,
  tier: Tier
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.tier, tier)));

  return row?.count ?? 0;
}

/**
 * Inserts a new entry into `tier` at `position` (clamped to the tier's
 * current bounds), shifting later entries down to make room, and
 * recomputes the whole tier's scores. Returns the new entry's id.
 */
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
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.tier, tier),
        gte(entries.position, clamped)
      )
    );

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

async function loadOwnedEntry(
  tx: Tx,
  userId: string,
  entryId: number
): Promise<Entry> {
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

/**
 * Moves an existing entry to `newPosition` within `newTier`. `newPosition`
 * is an index into the target tier's list *excluding* the moving entry
 * itself (i.e. the candidate list a client would render after filtering
 * the entry being moved out), and is clamped to that list's bounds.
 * Recomputes scores for the old tier and, if different, the new tier.
 */
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
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.tier, oldTier),
        gt(entries.position, oldPosition)
      )
    );

  const [{ count }] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(entries)
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.tier, newTier),
        ne(entries.id, entryId)
      )
    );

  const clamped = Math.max(0, Math.min(newPosition, count));

  // Make room in the target tier for the moving entry (never shifting
  // the moving entry itself, which still holds its stale position).
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

/**
 * Deletes an entry, closes the gap it left in its tier, and recomputes
 * that tier's scores.
 */
export async function removeEntry(
  tx: Tx,
  userId: string,
  entryId: number
): Promise<void> {
  const entry = await loadOwnedEntry(tx, userId, entryId);

  await tx.delete(entries).where(eq(entries.id, entryId));

  await tx
    .update(entries)
    .set({ position: sql`${entries.position} - 1` })
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.tier, entry.tier),
        gt(entries.position, entry.position)
      )
    );

  await recomputeTierScores(tx, userId, entry.tier);
}

/**
 * Recomputes every score in `tier` from its current position order, and
 * (defensively) normalizes positions to a dense 0..n-1 range in the
 * process.
 */
export async function recomputeTierScores(
  tx: Tx,
  userId: string,
  tier: Tier
): Promise<void> {
  const rows = await tx
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.tier, tier)))
    .orderBy(entries.position);

  const count = rows.length;

  for (let i = 0; i < count; i++) {
    const score = computeScore(i, count, tier);
    await tx
      .update(entries)
      .set({ position: i, score: score.toFixed(1) })
      .where(eq(entries.id, rows[i].id));
  }
}
