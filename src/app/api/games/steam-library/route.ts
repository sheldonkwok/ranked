import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { badRequest, releaseYearOf, withErrorHandling } from "@/app/api/_lib/handler";
import { entries, games, getDb } from "@/db";
import { IGDB_MULTIQUERY_MAX, type IgdbGame, resolveGamesByName } from "@/lib/igdb";
import { requireUser } from "@/lib/session";
import { fetchSteamLibrary, SteamNotConfiguredError } from "@/lib/steam";
import { withTiming } from "@/lib/trace";

const LIBRARY_RESULT_LIMIT = 10;
// How far down the (already playtime-sorted) Steam library to scan looking
// for LIBRARY_RESULT_LIMIT resolvable, unranked games. Some Steam apps never
// resolve to an IGDB game (tools, dedicated servers, SDKs), so this needs
// headroom above LIBRARY_RESULT_LIMIT — scanned in IGDB_MULTIQUERY_MAX-sized
// batches, so worst case costs a few multiquery round trips, not one per app.
const STEAM_SCAN_LIMIT = 30;

export async function GET() {
  return withErrorHandling(async () => {
    const user = await requireUser();

    if (!user.steamId) {
      throw badRequest("steam_not_linked");
    }

    let library: Awaited<ReturnType<typeof fetchSteamLibrary>>;
    try {
      library = await fetchSteamLibrary(user.steamId);
    } catch (err) {
      if (err instanceof SteamNotConfiguredError) {
        return NextResponse.json({ error: "steam_unavailable" }, { status: 502 });
      }
      console.error("Steam GetOwnedGames failed:", err);
      return NextResponse.json({ error: "steam_unavailable" }, { status: 502 });
    }

    const scan = library.slice(0, STEAM_SCAN_LIMIT);
    console.log(`[timing] steam.library size=${library.length} scanned=${scan.length}`);

    const rankedIgdbIds = await withTiming("db.rankedIgdbIds", async (t) => {
      const db = await getDb();
      const rankedRows = await db
        .select({ igdbId: games.igdbId })
        .from(entries)
        .innerJoin(games, eq(entries.gameId, games.id))
        .where(eq(entries.userId, user.id));
      t.set("row_count", rankedRows.length);
      return new Set(rankedRows.map((row) => row.igdbId));
    });

    type ResultRow = IgdbGame & { playtimeForever: number };
    const results: ResultRow[] = [];
    const seenIgdbIds = new Set<number>();

    try {
      await withTiming(
        "igdb.matchLibrary",
        async (t) => {
          let batches = 0;
          for (
            let start = 0;
            start < scan.length && results.length < LIBRARY_RESULT_LIMIT;
            start += IGDB_MULTIQUERY_MAX
          ) {
            batches++;
            const batch = scan.slice(start, start + IGDB_MULTIQUERY_MAX);
            const resolved = await resolveGamesByName(batch.map((game) => game.name));

            for (const steamGame of batch) {
              if (results.length >= LIBRARY_RESULT_LIMIT) break;

              const match = resolved.get(steamGame.name);
              if (!match) continue;
              if (rankedIgdbIds.has(match.igdbId)) continue;
              // A base game and its edition (e.g. "Fallout 3" + "Fallout 3: GOTY
              // Edition") can both resolve to the same IGDB entry. Since `scan`
              // is playtime-sorted, the first (highest-playtime) occurrence wins.
              if (seenIgdbIds.has(match.igdbId)) continue;

              seenIgdbIds.add(match.igdbId);
              results.push({ ...match, playtimeForever: steamGame.playtimeForever });
            }
          }
          t.set("batches", batches);
          t.set("matched", results.length);
        },
        { scan_size: scan.length }
      );
    } catch (err) {
      console.error("IGDB resolution failed:", err);
      return NextResponse.json({ error: "igdb_unavailable" }, { status: 502 });
    }

    return NextResponse.json({
      results: results.map((game) => ({
        igdbId: game.igdbId,
        name: game.name,
        coverImageId: game.coverImageId,
        firstReleaseDate: game.firstReleaseDate ? game.firstReleaseDate.toISOString() : null,
        releaseYear: releaseYearOf(game.firstReleaseDate),
        platforms: game.platforms,
        summary: game.summary,
        playtimeForever: game.playtimeForever,
      })),
    });
  });
}
