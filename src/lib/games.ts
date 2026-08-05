// Shared `games` table upsert, used by both POST /api/entries (adding a
// ranked game found via search) and GET /api/games/steam-library (caching a
// Steam appid -> IGDB game match so it isn't re-resolved on every request).
import { sql } from "drizzle-orm";
import { type Game, games } from "@/db/schema";
import type { IgdbGame } from "@/lib/igdb";
import type { DbOrTx } from "@/lib/ranking";

export type GameUpsert = {
  game: IgdbGame;
  /** Set when this game was resolved from a Steam library entry. */
  steamAppId?: number;
};

/**
 * Upserts a batch of IGDB games in a single statement, keyed on `igdbId`.
 *
 * `steamAppId` is combined with `coalesce` rather than overwritten outright:
 * an upsert with no `steamAppId` (the search-add path) must not clobber a
 * `steam_app_id` a previous Steam-library match already recorded on that row,
 * and an upsert that does carry one should still attach to a row that was
 * originally created via search. `excluded.*` refers to the incoming values
 * for the whole batch, so this stays a single round trip regardless of size.
 */
export async function upsertGames(db: DbOrTx, upserts: GameUpsert[]): Promise<Game[]> {
  if (upserts.length === 0) return [];

  return db
    .insert(games)
    .values(
      upserts.map(({ game, steamAppId }) => ({
        igdbId: game.igdbId,
        name: game.name,
        coverImageId: game.coverImageId,
        firstReleaseDate: game.firstReleaseDate,
        platforms: game.platforms,
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
        platforms: sql`excluded.platforms`,
        summary: sql`excluded.summary`,
        steamAppId: sql`coalesce(excluded.steam_app_id, ${games.steamAppId})`,
      },
    })
    .returning();
}

/** Convenience wrapper for the common single-game upsert (search-add path). */
export async function upsertGame(db: DbOrTx, game: IgdbGame): Promise<Game> {
  const [row] = await upsertGames(db, [{ game }]);
  return row;
}
