import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  releaseYearOf,
  withErrorHandling,
} from "@/app/api/_lib/handler";
import { entries, games, getDb } from "@/db";
import { type IgdbGame, searchGames } from "@/lib/igdb";
import { requireUser } from "@/lib/session";

const SEARCH_RESULT_LIMIT = 8;

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await requireUser();

    const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) {
      throw badRequest("q must be at least 2 characters");
    }

    let results: IgdbGame[];
    try {
      results = await searchGames(q);
    } catch (err) {
      console.error("IGDB search failed:", err);
      return NextResponse.json({ error: "igdb_unavailable" }, { status: 502 });
    }

    const db = await getDb();
    const rankedRows = await db
      .select({ igdbId: games.igdbId })
      .from(entries)
      .innerJoin(games, eq(entries.gameId, games.id))
      .where(eq(entries.userId, user.id));
    const rankedIgdbIds = new Set(rankedRows.map((row) => row.igdbId));

    return NextResponse.json({
      results: results
        .filter((game) => !rankedIgdbIds.has(game.igdbId))
        .slice(0, SEARCH_RESULT_LIMIT)
        .map((game) => ({
          ...game,
          firstReleaseDate: game.firstReleaseDate
            ? game.firstReleaseDate.toISOString()
            : null,
          releaseYear: releaseYearOf(game.firstReleaseDate),
        })),
    });
  });
}
