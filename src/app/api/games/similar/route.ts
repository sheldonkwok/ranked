import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { ApiError, badRequest, releaseYearOf, withErrorHandling } from "@/app/api/_lib/handler";
import { entries, games, getDb } from "@/db";
import { getSimilarGames, type IgdbGame } from "@/lib/igdb";
import { requireUser } from "@/lib/session";

const SIMILAR_RESULT_LIMIT = 10;

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();

    const name = (request.nextUrl.searchParams.get("name") ?? "").trim();
    if (name.length === 0) {
      throw badRequest("name is required");
    }

    const db = await getDb();
    const rankedRows = await db
      .select({ igdbId: games.igdbId, name: games.name })
      .from(entries)
      .innerJoin(games, eq(entries.gameId, games.id))
      .where(eq(entries.userId, user.id));

    // Scoped to the user's own ranked games — `games.name` isn't globally
    // unique, but it's effectively unique within one person's ranking, and
    // "games like this" only makes sense for something already ranked.
    const target =
      rankedRows.find((row) => row.name === name) ??
      rankedRows.find((row) => row.name.toLowerCase() === name.toLowerCase());
    if (!target) {
      throw new ApiError(404, { error: "game_not_ranked" });
    }

    let results: IgdbGame[];
    try {
      results = await getSimilarGames(target.igdbId);
    } catch (err) {
      console.error("IGDB similar_games failed:", err);
      return NextResponse.json({ error: "igdb_unavailable" }, { status: 502 });
    }

    const rankedIgdbIds = new Set(rankedRows.map((row) => row.igdbId));

    return NextResponse.json({
      target: { name: target.name },
      results: results
        .filter((game) => !rankedIgdbIds.has(game.igdbId))
        .slice(0, SIMILAR_RESULT_LIMIT)
        .map((game) => ({
          ...game,
          firstReleaseDate: game.firstReleaseDate ? game.firstReleaseDate.toISOString() : null,
          releaseYear: releaseYearOf(game.firstReleaseDate),
        })),
    });
  });
}
