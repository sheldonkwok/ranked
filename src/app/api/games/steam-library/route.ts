import { and, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { badRequest, releaseYearOf, withErrorHandling } from "@/app/api/_lib/handler";
import { entries, type Game, games, getDb, steamAppMisses } from "@/db";
import { type GameUpsert, upsertGames } from "@/lib/games";
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
// How long a "no IGDB match" result for a Steam appid is trusted before
// re-checking IGDB — long enough that repeat requests are effectively free,
// but not forever, in case IGDB adds the game later.
const STEAM_MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// The fields the response actually serializes, for both a freshly-resolved
// IGDB game and a cached `games` row read straight back out of the DB
// (which has no `totalRatingCount` — that field is never stored).
type LibraryMatch = {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  firstReleaseDate: Date | null;
  platforms: string[];
  summary: string | null;
  playtimeForever: number;
};

function gameRowToMatch(row: Game, playtimeForever: number): LibraryMatch {
  return {
    igdbId: row.igdbId,
    name: row.name,
    coverImageId: row.coverImageId,
    firstReleaseDate: row.firstReleaseDate,
    platforms: row.platforms ?? [],
    summary: row.summary,
    playtimeForever,
  };
}

function igdbGameToMatch(game: IgdbGame, playtimeForever: number): LibraryMatch {
  return {
    igdbId: game.igdbId,
    name: game.name,
    coverImageId: game.coverImageId,
    firstReleaseDate: game.firstReleaseDate,
    platforms: game.platforms,
    summary: game.summary,
    playtimeForever,
  };
}

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

    const db = await getDb();
    const scanAppIds = scan.map((game) => game.appId);

    // Everything we already know about this scan window before asking IGDB
    // anything: which of the user's ranked games are in it (so they're
    // excluded from results), which Steam appids already have a cached IGDB
    // match (`games.steam_app_id`), and which are a cached "no match" within
    // the miss TTL (`steam_app_misses`).
    const { rankedIgdbIds, cachedByAppId, freshMisses } = await withTiming("db.libraryLookup", async (t) => {
      const rankedRows = await db
        .select({ igdbId: games.igdbId })
        .from(entries)
        .innerJoin(games, eq(entries.gameId, games.id))
        .where(eq(entries.userId, user.id));

      const cachedRows =
        scanAppIds.length > 0 ? await db.select().from(games).where(inArray(games.steamAppId, scanAppIds)) : [];

      const missRows =
        scanAppIds.length > 0
          ? await db
              .select({ steamAppId: steamAppMisses.steamAppId })
              .from(steamAppMisses)
              .where(
                and(
                  inArray(steamAppMisses.steamAppId, scanAppIds),
                  gt(steamAppMisses.checkedAt, new Date(Date.now() - STEAM_MISS_TTL_MS))
                )
              )
          : [];

      t.set("row_count", rankedRows.length);
      t.set("cached_hits", cachedRows.length);
      t.set("cached_misses", missRows.length);

      return {
        rankedIgdbIds: new Set(rankedRows.map((row) => row.igdbId)),
        cachedByAppId: new Map(
          cachedRows
            .filter((row): row is Game & { steamAppId: number } => row.steamAppId !== null)
            .map((row) => [row.steamAppId, row])
        ),
        freshMisses: new Set(missRows.map((row) => row.steamAppId)),
      };
    });

    const results: LibraryMatch[] = [];
    const seenIgdbIds = new Set<number>();
    // Steam appids resolved (or confirmed unresolvable) against IGDB during
    // this request, persisted after the loop so the next request for this
    // library skips IGDB entirely for them.
    const newlyResolved: GameUpsert[] = [];
    const newMisses: number[] = [];

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
            const batch = scan.slice(start, start + IGDB_MULTIQUERY_MAX);
            // Only apps this scan window hasn't already resolved (as a hit
            // or a fresh miss) need an actual IGDB round trip.
            const pending = batch.filter((game) => !cachedByAppId.has(game.appId) && !freshMisses.has(game.appId));

            let resolved = new Map<string, IgdbGame>();
            if (pending.length > 0) {
              batches++;
              resolved = await resolveGamesByName(pending.map((game) => game.name));
              for (const steamGame of pending) {
                const match = resolved.get(steamGame.name);
                if (match) {
                  newlyResolved.push({ game: match, steamAppId: steamGame.appId });
                } else {
                  newMisses.push(steamGame.appId);
                }
              }
            }

            for (const steamGame of batch) {
              if (results.length >= LIBRARY_RESULT_LIMIT) break;

              const cachedRow = cachedByAppId.get(steamGame.appId);
              const resolvedGame = resolved.get(steamGame.name);
              const igdbId = cachedRow?.igdbId ?? resolvedGame?.igdbId;
              if (igdbId === undefined) continue;
              if (rankedIgdbIds.has(igdbId)) continue;
              // A base game and its edition (e.g. "Fallout 3" + "Fallout 3: GOTY
              // Edition") can both resolve to the same IGDB entry. Since `scan`
              // is playtime-sorted, the first (highest-playtime) occurrence wins.
              if (seenIgdbIds.has(igdbId)) continue;

              seenIgdbIds.add(igdbId);
              results.push(
                cachedRow
                  ? gameRowToMatch(cachedRow, steamGame.playtimeForever)
                  : igdbGameToMatch(resolvedGame as IgdbGame, steamGame.playtimeForever)
              );
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

    // Persist what was learned this request. A base game and an edition can
    // both resolve to the same IGDB id, but `games.igdb_id` is the upsert's
    // conflict target, so a batch can only carry one row per igdbId — the
    // first Steam appid to claim it wins; the other just stays uncached and
    // re-resolves next time, which is a minor cost, not a correctness issue.
    if (newlyResolved.length > 0 || newMisses.length > 0) {
      const uniqueResolved = new Map<number, GameUpsert>();
      for (const upsert of newlyResolved) {
        if (!uniqueResolved.has(upsert.game.igdbId)) {
          uniqueResolved.set(upsert.game.igdbId, upsert);
        }
      }
      const uniqueMisses = Array.from(new Set(newMisses));

      try {
        await withTiming("db.cacheSteamMatches", async (t) => {
          if (uniqueResolved.size > 0) {
            await upsertGames(db, Array.from(uniqueResolved.values()));
          }
          if (uniqueMisses.length > 0) {
            await db
              .insert(steamAppMisses)
              .values(uniqueMisses.map((steamAppId) => ({ steamAppId })))
              .onConflictDoUpdate({
                target: steamAppMisses.steamAppId,
                set: { checkedAt: new Date() },
              });
          }
          t.set("resolved", uniqueResolved.size);
          t.set("misses", uniqueMisses.length);
        });
      } catch (err) {
        // A caching failure shouldn't turn an otherwise-successful response
        // into a 502 — worst case the next request just re-resolves.
        console.error("Failed to cache Steam library matches:", err);
      }
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
