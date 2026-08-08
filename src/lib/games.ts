// Shared `games` table upsert, used by both POST /api/entries and GET /api/games/steam-library.
import { eq, inArray, sql } from "drizzle-orm";
import { type Game, gamePlatforms, games, platforms } from "@/db/schema";
import type { IgdbGame, IgdbPlatform } from "@/lib/igdb";
import type { DbOrTx } from "@/lib/ranking";

export type GameUpsert = {
  game: IgdbGame;
  /** Set when this game was resolved from a Steam library entry. */
  steamAppId?: number;
};

/** Upserts the `platforms` a batch of games references, keyed on `igdbId`, and returns local id lookup. */
async function upsertPlatforms(db: DbOrTx, igdbGames: IgdbGame[]): Promise<Map<number, number>> {
  const byIgdbId = new Map<number, IgdbPlatform>();
  for (const game of igdbGames) {
    for (const platform of game.platforms) {
      byIgdbId.set(platform.igdbId, platform);
    }
  }
  if (byIgdbId.size === 0) return new Map();

  const rows = await db
    .insert(platforms)
    .values(
      Array.from(byIgdbId.values()).map((p) => ({ igdbId: p.igdbId, name: p.name, abbreviation: p.abbreviation }))
    )
    .onConflictDoUpdate({
      target: platforms.igdbId,
      set: {
        name: sql`excluded.name`,
        abbreviation: sql`excluded.abbreviation`,
      },
    })
    .returning();

  return new Map(rows.map((row) => [row.igdbId, row.id]));
}

/** Replaces the platform links for a batch of upserted games — delete-then-insert so a platform IGDB drops for a game propagates. */
async function syncGamePlatforms(db: DbOrTx, upserts: GameUpsert[], rows: Game[]): Promise<void> {
  const localIdByIgdbId = await upsertPlatforms(
    db,
    upserts.map((u) => u.game)
  );

  const gameIds = rows.map((row) => row.id);
  await db.delete(gamePlatforms).where(inArray(gamePlatforms.gameId, gameIds));

  const rowByIgdbId = new Map(rows.map((row) => [row.igdbId, row]));
  const links: { gameId: number; platformId: number }[] = [];
  for (const { game } of upserts) {
    const row = rowByIgdbId.get(game.igdbId);
    if (!row) continue;

    const platformIds = new Set<number>();
    for (const platform of game.platforms) {
      const localId = localIdByIgdbId.get(platform.igdbId);
      if (localId !== undefined) platformIds.add(localId);
    }
    for (const platformId of platformIds) {
      links.push({ gameId: row.id, platformId });
    }
  }

  if (links.length > 0) {
    await db.insert(gamePlatforms).values(links);
  }
}

/** Upserts a batch of IGDB games and their platform links, keyed on `igdbId`; `steamAppId` is `coalesce`d so a search-add upsert can't clobber a Steam-learned value. */
export async function upsertGames(db: DbOrTx, upserts: GameUpsert[]): Promise<Game[]> {
  if (upserts.length === 0) return [];

  const rows = await db
    .insert(games)
    .values(
      upserts.map(({ game, steamAppId }) => ({
        igdbId: game.igdbId,
        name: game.name,
        coverImageId: game.coverImageId,
        firstReleaseDate: game.firstReleaseDate,
        summary: game.summary,
        steamAppId: steamAppId ?? null,
      }))
    )
    .onConflictDoUpdate({
      target: games.igdbId,
      set: {
        name: sql`excluded.name`,
        coverImageId: sql`excluded.cover_image_id`,
        firstReleaseDate: sql`excluded.first_release_date`,
        summary: sql`excluded.summary`,
        steamAppId: sql`coalesce(excluded.steam_app_id, ${games.steamAppId})`,
      },
    })
    .returning();

  await syncGamePlatforms(db, upserts, rows);

  return rows;
}

/** Convenience wrapper for the common single-game upsert (search-add path). */
export async function upsertGame(db: DbOrTx, game: IgdbGame): Promise<Game> {
  const [row] = await upsertGames(db, [{ game }]);
  return row;
}

/** Display label for a platform — IGDB's abbreviation when it has one, else the full name. */
export function platformLabel(platform: { name: string; abbreviation: string | null }): string {
  return platform.abbreviation ?? platform.name;
}

/** Platform labels for a set of game ids, keyed by game id; games with none are absent from the map. */
export async function getPlatformLabels(db: DbOrTx, gameIds: number[]): Promise<Map<number, string[]>> {
  if (gameIds.length === 0) return new Map();

  const rows = await db
    .select({ gameId: gamePlatforms.gameId, name: platforms.name, abbreviation: platforms.abbreviation })
    .from(gamePlatforms)
    .innerJoin(platforms, eq(gamePlatforms.platformId, platforms.id))
    .where(inArray(gamePlatforms.gameId, gameIds))
    .orderBy(platforms.name);

  const labels = new Map<number, string[]>();
  for (const row of rows) {
    const list = labels.get(row.gameId) ?? [];
    list.push(platformLabel(row));
    labels.set(row.gameId, list);
  }
  return labels;
}
