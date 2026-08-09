import { desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { withErrorHandling } from "@/app/api/_lib/handler";
import { entries, gamePlatforms, getDb, platforms } from "@/db";
import { platformLabel } from "@/lib/games";
import { requireUser } from "@/lib/session";

export async function GET() {
  return withErrorHandling(async () => {
    const user = await requireUser();
    const db = await getDb();

    const gameCount = sql<number>`count(*)::int`;
    const rows = await db
      .select({
        igdbId: platforms.igdbId,
        name: platforms.name,
        abbreviation: platforms.abbreviation,
        gameCount,
      })
      .from(entries)
      .innerJoin(gamePlatforms, eq(gamePlatforms.gameId, entries.gameId))
      .innerJoin(platforms, eq(platforms.id, gamePlatforms.platformId))
      .where(eq(entries.userId, user.id))
      .groupBy(platforms.igdbId, platforms.name, platforms.abbreviation)
      .orderBy(desc(gameCount), platforms.name);

    return NextResponse.json({
      platforms: rows.map((row) => ({ igdbId: row.igdbId, label: platformLabel(row), gameCount: row.gameCount })),
    });
  });
}
