import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { ApiError, badRequest, releaseYearOf, withErrorHandling } from "@/app/api/_lib/handler";
import { entries, games, getDb, platforms } from "@/db";
import { platformLabel } from "@/lib/games";
import { getTopGamesByPlatform } from "@/lib/igdb";
import { requireUser } from "@/lib/session";

const PLATFORM_RESULT_LIMIT = 10;

export async function GET(_request: NextRequest, { params }: { params: Promise<{ igdbId: string }> }) {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const { igdbId: rawIgdbId } = await params;
    const igdbId = Number(rawIgdbId);
    if (!Number.isInteger(igdbId) || igdbId <= 0) {
      throw badRequest("igdbId must be a positive integer");
    }

    const db = await getDb();

    const [platform] = await db
      .select({ igdbId: platforms.igdbId, name: platforms.name, abbreviation: platforms.abbreviation })
      .from(platforms)
      .where(eq(platforms.igdbId, igdbId))
      .limit(1);
    if (!platform) {
      throw new ApiError(404, { error: "platform_not_found" });
    }

    const rankedRows = await db
      .select({ igdbId: games.igdbId })
      .from(entries)
      .innerJoin(games, eq(entries.gameId, games.id))
      .where(eq(entries.userId, user.id));
    const rankedIgdbIds = new Set(rankedRows.map((row) => row.igdbId));

    let results: Awaited<ReturnType<typeof getTopGamesByPlatform>>;
    try {
      results = await getTopGamesByPlatform(igdbId);
    } catch (err) {
      console.error("IGDB platform lookup failed:", err);
      return NextResponse.json({ error: "igdb_unavailable" }, { status: 502 });
    }

    return NextResponse.json({
      platform: { igdbId: platform.igdbId, label: platformLabel(platform) },
      results: results
        .filter((game) => !rankedIgdbIds.has(game.igdbId))
        .slice(0, PLATFORM_RESULT_LIMIT)
        .map((game) => ({
          ...game,
          firstReleaseDate: game.firstReleaseDate ? game.firstReleaseDate.toISOString() : null,
          releaseYear: releaseYearOf(game.firstReleaseDate),
          platforms: game.platforms.map(platformLabel),
        })),
    });
  });
}
