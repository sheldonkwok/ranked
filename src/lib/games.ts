// Shared `games` table upsert, used by both POST /api/entries and GET /api/games/steam-library.
import { sql } from "drizzle-orm";
import { type Game, games } from "@/db/schema";
import type { IgdbGame } from "@/lib/igdb";
import type { DbOrTx } from "@/lib/ranking";

export type GameUpsert = {
  game: IgdbGame;
  /** Set when this game was resolved from a Steam library entry. */
  steamAppId?: number;
};

/** Upserts a batch of IGDB games in a single statement, keyed on `igdbId`; `steamAppId` is `coalesce`d so a search-add upsert can't clobber a Steam-learned value. */
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
