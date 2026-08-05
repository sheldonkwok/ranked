// Server-only IGDB API client.
//
// IGDB (https://api-docs.igdb.com) is authenticated via a Twitch app's
// client-credentials OAuth flow. This module fetches and caches a Twitch
// access token in memory and uses it to issue Apicalypse-flavored requests
// against api.igdb.com.
//
// This file must never be imported from client components/bundles.
if (typeof window !== "undefined") {
  throw new Error("igdb.ts is server-only");
}

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API_BASE = "https://api.igdb.com/v4";

// How long before actual expiry we treat a cached token as stale, so we
// don't hand IGDB a token that dies mid-flight.
const TOKEN_REFRESH_SKEW_MS = 60_000;

type TokenCache = {
  accessToken: string;
  expiresAt: number; // epoch ms
};

let tokenCache: TokenCache | null = null;

function getRequiredEnv(name: "TWITCH_CLIENT_ID" | "TWITCH_CLIENT_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Set it in .env.local (see .env.example) — IGDB access is authenticated via a Twitch developer app's client-credentials OAuth flow.`
    );
  }
  return value;
}

function isTokenFresh(cache: TokenCache | null): cache is TokenCache {
  if (!cache) return false;
  return Date.now() < cache.expiresAt - TOKEN_REFRESH_SKEW_MS;
}

type TwitchTokenResponse = {
  access_token: string;
  expires_in: number;
  token_type: string;
};

async function fetchNewToken(): Promise<TokenCache> {
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  const clientSecret = getRequiredEnv("TWITCH_CLIENT_SECRET");

  const url = new URL(TWITCH_TOKEN_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to obtain Twitch OAuth token (status ${res.status}): ${text}`);
  }

  const data = (await res.json()) as TwitchTokenResponse;
  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && isTokenFresh(tokenCache)) {
    return tokenCache.accessToken;
  }
  const fresh = await fetchNewToken();
  tokenCache = fresh;
  return fresh.accessToken;
}

async function performIgdbFetch(endpoint: string, body: string, accessToken: string) {
  const clientId = getRequiredEnv("TWITCH_CLIENT_ID");
  return fetch(`${IGDB_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "text/plain",
    },
    body,
    cache: "no-store",
  });
}

async function igdbRequest<T>(endpoint: string, body: string): Promise<T> {
  const accessToken = await getAccessToken();
  let res = await performIgdbFetch(endpoint, body, accessToken);

  if (res.status === 401) {
    // Token may have been revoked or expired early — invalidate the cache,
    // fetch a brand new token, and retry exactly once.
    tokenCache = null;
    const refreshedToken = await getAccessToken(true);
    res = await performIgdbFetch(endpoint, body, refreshedToken);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`IGDB request to "${endpoint}" failed (status ${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

export type IgdbGame = {
  igdbId: number;
  name: string;
  coverImageId: string | null;
  firstReleaseDate: Date | null; // IGDB returns unix seconds
  platforms: string[]; // platform abbreviations, [] if none
  summary: string | null;
  totalRatingCount: number;
};

type RawIgdbGame = {
  id: number;
  name: string;
  cover?: { image_id: string } | null;
  first_release_date?: number | null;
  platforms?: { abbreviation?: string }[] | null;
  summary?: string | null;
  total_rating_count?: number | null;
};

const GAME_FIELDS =
  "fields name, cover.image_id, first_release_date, platforms.abbreviation, summary, total_rating_count;";
// Wider than the number of results shown client-side, since already-ranked
// games are filtered out server-side after this fetch.
const SEARCH_FETCH_LIMIT = 30;
// IGDB's `search` is a fuzzy relevance index that can bury or entirely omit an
// exact title when the query's tokens stem into a much larger franchise (e.g.
// "The Finals" -> "final" -> the whole Final Fantasy catalog). The exact-name
// fallback (see searchGames) is scoped to these game_types: main games,
// bundles, standalone/expanded editions, ports, remakes, and remasters —
// deliberately excluding DLC/expansion/episode/season/mod/pack, which is what
// floods a naive name search for anything with a live-service tie-in.
const NAME_MATCH_GAME_TYPES = "(0,3,4,8,9,10,11)";
const NAME_MATCH_FETCH_LIMIT = 10;

function normalizeGame(raw: RawIgdbGame): IgdbGame {
  return {
    igdbId: raw.id,
    name: raw.name,
    coverImageId: raw.cover?.image_id ?? null,
    firstReleaseDate: typeof raw.first_release_date === "number" ? new Date(raw.first_release_date * 1000) : null,
    platforms: (raw.platforms ?? []).map((p) => p.abbreviation).filter((abbr): abbr is string => Boolean(abbr)),
    summary: raw.summary ?? null,
    totalRatingCount: raw.total_rating_count ?? 0,
  };
}

function escapeApicalypseString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * An exact match is "substantive" if it looks like a real, known game rather
 * than an obscure same-titled entry (IGDB has, for example, a bare "Zelda"
 * with no cover and no ratings — promoting every exact match unconditionally
 * would rank it above "The Legend of Zelda"). Requiring both a cover and at
 * least one rating is a cheap, effective filter for that.
 */
function isSubstantive(game: IgdbGame): boolean {
  return game.coverImageId !== null && game.totalRatingCount > 0;
}

/**
 * Merges IGDB's fuzzy `search` results with an exact-title name match,
 * promoting a substantive exact match to the top while otherwise preserving
 * `search`'s own relevance order. Pure and exported so it's unit-testable
 * without hitting the network — mirrors src/lib/ranking.ts.
 */
export function mergeSearchResults(query: string, searchResults: IgdbGame[], nameMatches: IgdbGame[]): IgdbGame[] {
  const normalizedQuery = query.trim().toLowerCase();
  const searchOrder = new Map(searchResults.map((game, index) => [game.igdbId, index]));

  const byId = new Map<number, IgdbGame>();
  for (const game of [...searchResults, ...nameMatches]) {
    if (!byId.has(game.igdbId)) byId.set(game.igdbId, game);
  }

  function tier(game: IgdbGame): 0 | 1 | 2 {
    const isExactMatch = game.name.trim().toLowerCase() === normalizedQuery;
    if (isExactMatch && isSubstantive(game)) return 0;
    if (searchOrder.has(game.igdbId)) return 1;
    return 2;
  }

  return Array.from(byId.values()).sort((a, b) => {
    const tierDiff = tier(a) - tier(b);
    if (tierDiff !== 0) return tierDiff;

    const aOrder = searchOrder.get(a.igdbId);
    const bOrder = searchOrder.get(b.igdbId);
    if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;

    // Tiers 0 and 2 (no search order to fall back on): higher rating count first.
    return b.totalRatingCount - a.totalRatingCount;
  });
}

function hasSubstantiveExactMatch(query: string, results: IgdbGame[]): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return results.some((game) => game.name.trim().toLowerCase() === normalizedQuery && isSubstantive(game));
}

export async function searchGames(query: string): Promise<IgdbGame[]> {
  const escaped = escapeApicalypseString(query);
  const searchBody = `search "${escaped}"; ${GAME_FIELDS} where version_parent = null; limit ${SEARCH_FETCH_LIMIT};`;
  const searchResults = (await igdbRequest<RawIgdbGame[]>("games", searchBody)).map(normalizeGame);

  // The re-rank (promoting a substantive exact match to the top) always runs
  // over whatever we have. Only the second IGDB request is conditional: skip
  // it when `search` already contains a substantive exact match somewhere in
  // its results — even buried, mergeSearchResults will surface it — so the
  // common case (popular titles) stays at one IGDB call.
  if (hasSubstantiveExactMatch(query, searchResults)) {
    return mergeSearchResults(query, searchResults, []);
  }

  const nameBody = `${GAME_FIELDS} where name ~ "${escaped}" & version_parent = null & game_type = ${NAME_MATCH_GAME_TYPES}; limit ${NAME_MATCH_FETCH_LIMIT};`;
  const nameMatches = (await igdbRequest<RawIgdbGame[]>("games", nameBody)).map(normalizeGame);

  return mergeSearchResults(query, searchResults, nameMatches);
}

export async function getGameByIgdbId(igdbId: number): Promise<IgdbGame | null> {
  if (!Number.isInteger(igdbId) || igdbId <= 0) {
    throw new Error(`getGameByIgdbId: igdbId must be a positive integer, got ${igdbId}`);
  }
  const body = `${GAME_FIELDS} where id = ${igdbId}; limit 1;`;
  const results = await igdbRequest<RawIgdbGame[]>("games", body);
  return results.length > 0 ? normalizeGame(results[0]) : null;
}
