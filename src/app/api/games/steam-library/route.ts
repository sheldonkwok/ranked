import { and, eq, gt, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { badRequest, releaseYearOf, withErrorHandling } from "@/app/api/_lib/handler";
import { entries, type Game, games, getDb, steamAppMisses } from "@/db";
import { type GameUpsert, upsertGames } from "@/lib/games";
import { IGDB_MULTIQUERY_MAX, type IgdbGame, resolveGamesByName } from "@/lib/igdb";
import { requireUser } from "@/lib/session";
import { fetchSteamLibrary, SteamNotConfiguredError } from "@/lib/steam";

const LIBRARY_RESULT_LIMIT = 10;
// How far down the playtime-sorted library to scan for LIBRARY_RESULT_LIMIT resolvable games — needs headroom since some apps (tools, SDKs) never resolve to IGDB; scanned in IGDB_MULTIQUERY_MAX batches to cap round trips.
const STEAM_SCAN_LIMIT = 30;
// How long a "no IGDB match" is trusted before re-checking IGDB — long enough repeat requests are free, but not forever, in case IGDB adds the game later.
const STEAM_MISS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Response fields shared by a freshly-resolved IGDB game and a cached games row (which has no totalRatingCount — never stored).
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

    const db = await getDb();
    const scanAppIds = scan.map((game) => game.appId);

    // Precompute what's already known for this scan window: the user's ranked games (excluded from results), cached IGDB matches (games.steam_app_id), and fresh cached misses (steam_app_misses).
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

    const rankedIgdbIds = new Set(rankedRows.map((row) => row.igdbId));
    const cachedByAppId = new Map(
      cachedRows
        .filter((row): row is Game & { steamAppId: number } => row.steamAppId !== null)
        .map((row) => [row.steamAppId, row])
    );
    const freshMisses = new Set(missRows.map((row) => row.steamAppId));

    const results: LibraryMatch[] = [];
    const seenIgdbIds = new Set<number>();
    // Appids resolved (or confirmed unresolvable) this request, persisted after the loop so future requests skip IGDB for them.
    const newlyResolved: GameUpsert[] = [];
    const newMisses: number[] = [];

    try {
      for (let start = 0; start < scan.length && results.length < LIBRARY_RESULT_LIMIT; start += IGDB_MULTIQUERY_MAX) {
        const batch = scan.slice(start, start + IGDB_MULTIQUERY_MAX);
        // Only apps not already resolved (hit or fresh miss) need an actual IGDB round trip.
        const pending = batch.filter((game) => !cachedByAppId.has(game.appId) && !freshMisses.has(game.appId));

        let resolved = new Map<string, IgdbGame>();
        if (pending.length > 0) {
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
          // A base game and its edition can resolve to the same IGDB entry — since scan is playtime-sorted, the first (highest-playtime) occurrence wins.
          if (seenIgdbIds.has(igdbId)) continue;

          seenIgdbIds.add(igdbId);
          results.push(
            cachedRow
              ? gameRowToMatch(cachedRow, steamGame.playtimeForever)
              : igdbGameToMatch(resolvedGame as IgdbGame, steamGame.playtimeForever)
          );
        }
      }
    } catch (err) {
      console.error("IGDB resolution failed:", err);
      return NextResponse.json({ error: "igdb_unavailable" }, { status: 502 });
    }

    // Persist what was learned this request — games.igdb_id is the upsert conflict target, so only one appid per igdbId is cached; the other just re-resolves next time (minor cost, not a correctness issue).
    if (newlyResolved.length > 0 || newMisses.length > 0) {
      const uniqueResolved = new Map<number, GameUpsert>();
      for (const upsert of newlyResolved) {
        if (!uniqueResolved.has(upsert.game.igdbId)) {
          uniqueResolved.set(upsert.game.igdbId, upsert);
        }
      }
      const uniqueMisses = Array.from(new Set(newMisses));

      try {
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
      } catch (err) {
        // A caching failure shouldn't turn an otherwise-successful response into a 502 — worst case, the next request just re-resolves.
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
