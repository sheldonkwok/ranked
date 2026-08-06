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
// Scoped to these game_types: main games, DLC, expansions, bundles,
// standalone/expanded editions, ports, remakes, and remasters — deliberately
// excluding episode/season/mod/pack, which is what floods a naive name search
// for anything with a live-service tie-in (e.g. "Super Mario Odyssey
// F.L.U.D.D.", a mod).
const GAME_TYPES = "(0,1,2,3,4,8,9,10,11)";
const MAX_QUERY_TOKENS = 8;

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
 * Promotes a substantive exact title match to the top (rating count desc
 * among exact matches), otherwise preserves the API's own result order. Pure
 * and exported so it's unit-testable without hitting the network — mirrors
 * src/lib/ranking.ts.
 */
export function mergeSearchResults(query: string, results: IgdbGame[]): IgdbGame[] {
  const normalizedQuery = query.trim().toLowerCase();

  function isExactSubstantiveMatch(game: IgdbGame): boolean {
    return game.name.trim().toLowerCase() === normalizedQuery && isSubstantive(game);
  }

  const exact = results.filter(isExactSubstantiveMatch).sort((a, b) => b.totalRatingCount - a.totalRatingCount);
  const rest = results.filter((game) => !isExactSubstantiveMatch(game));

  return [...exact, ...rest];
}

/**
 * Tokenizes a raw search query into the individual words used to build the
 * per-token infix match — lowercased, whitespace-split, empties and stray
 * `*` (which would otherwise produce a malformed `**"..."*` clause) dropped,
 * and capped so a pathological query can't blow up the request body.
 */
function tokenize(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/\*/g, ""))
    .filter((token) => token.length > 0)
    .slice(0, MAX_QUERY_TOKENS);
}

export async function searchGames(query: string): Promise<IgdbGame[]> {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  // IGDB's `search` endpoint is a fuzzy relevance index, but it can't be
  // combined with `sort` and isn't usable inside /multiquery (a sub-query
  // containing `search` silently makes the *whole* multiquery return `200
  // []`, no error, killing sibling sub-queries too — confirmed against the
  // live API, not documented). It also has no typo tolerance, so nothing is
  // lost by dropping it.
  //
  // Instead we do what IGDB recommends for autocomplete: a per-token infix
  // match on `name` (handles token gaps like "zelda breath" -> "...Breath of
  // the Wild" and mid-word truncation like "hollow kni" -> "Hollow Knight",
  // neither of which `search` does), OR'd with an infix match on
  // `alternative_names` (handles abbreviations: "cod" -> Call of Duty, "botw"
  // -> Breath of the Wild). `sort total_rating_count desc` replaces `search`'s
  // relevance ordering and is illegal to combine with `search` but fine with
  // `where`. One IGDB request per search, always.
  const nameClause = tokens.map((token) => `name ~ *"${escapeApicalypseString(token)}"*`).join(" & ");
  const altNameClause = `alternative_names.name ~ *"${escapeApicalypseString(query.trim())}"*`;
  const body = `${GAME_FIELDS} where ((${nameClause}) | ${altNameClause}) & version_parent = null & game_type = ${GAME_TYPES}; sort total_rating_count desc; limit ${SEARCH_FETCH_LIMIT};`;

  const results = (await igdbRequest<RawIgdbGame[]>("games", body)).map(normalizeGame);
  return mergeSearchResults(query, results);
}

export async function getGameByIgdbId(igdbId: number): Promise<IgdbGame | null> {
  if (!Number.isInteger(igdbId) || igdbId <= 0) {
    throw new Error(`getGameByIgdbId: igdbId must be a positive integer, got ${igdbId}`);
  }
  const body = `${GAME_FIELDS} where id = ${igdbId}; limit 1;`;
  const results = await igdbRequest<RawIgdbGame[]>("games", body);
  return results.length > 0 ? normalizeGame(results[0]) : null;
}

// Wider than SIMILAR_RESULT_LIMIT in the API route, since already-ranked
// games are filtered out server-side after this fetch.
const SIMILAR_FETCH_LIMIT = 20;

type RawSimilarGames = { id: number; similar_games?: number[] | null };

/**
 * Restores `games` to the order of `ids` (IGDB's own `similar_games`
 * relevance ordering) — a `where id = (...)` fetch returns rows in
 * arbitrary order. Ids with no matching game (filtered out by game_type,
 * or simply absent from the response) are skipped. Pure and exported so
 * it's unit-testable without hitting the network.
 */
export function sortByIdOrder(games: IgdbGame[], ids: number[]): IgdbGame[] {
  const byId = new Map(games.map((game) => [game.igdbId, game]));
  return ids.map((id) => byId.get(id)).filter((game): game is IgdbGame => game !== undefined);
}

/**
 * Games IGDB considers similar to `igdbId`, in IGDB's own relevance order.
 * `similar_games` only returns bare ids, so this is two requests: one for
 * the id list, one to fetch full records for those ids (filtered by the
 * same game_type allowlist as search, and re-sorted to match the id order).
 */
export async function getSimilarGames(igdbId: number): Promise<IgdbGame[]> {
  if (!Number.isInteger(igdbId) || igdbId <= 0) {
    throw new Error(`getSimilarGames: igdbId must be a positive integer, got ${igdbId}`);
  }

  const idRows = await igdbRequest<RawSimilarGames[]>("games", `fields similar_games; where id = ${igdbId}; limit 1;`);
  const ids = idRows[0]?.similar_games ?? [];
  if (ids.length === 0) return [];

  const body = `${GAME_FIELDS} where id = (${ids.join(",")}) & version_parent = null & game_type = ${GAME_TYPES}; limit ${SIMILAR_FETCH_LIMIT};`;
  const games = (await igdbRequest<RawIgdbGame[]>("games", body)).map(normalizeGame);
  return sortByIdOrder(games, ids);
}

// --- Steam library name resolution -----------------------------------------
//
// Steam library titles and IGDB titles frequently disagree — trademark
// symbols, roman-numeral vs. arabic-numeral sequels, and store-page edition
// suffixes are all common. Resolving a batch of Steam names to IGDB games is
// a two-pass process, tuned against the live API (see the /add Steam library
// plan for the raw test transcript this is derived from):
//
//   1. An exact-ish pass: `name ~ "..."` (case-insensitive equality, not a
//      substring match) OR'd with an `alternative_names` hit, which recovers
//      most renames ("PLAYERUNKNOWN'S BATTLEGROUNDS" -> "PUBG: Battlegrounds",
//      "Baldur's Gate 3" -> "Baldur's Gate III"). ~17/18 real Steam titles
//      matched this way in testing.
//   2. A wildcard fallback, but ONLY as a *candidate generator* re-verified
//      by `pickBestMatch` — token-wildcard search alone silently picks the
//      wrong sibling game far too often (`sort total_rating_count desc` will
//      confidently return "Civilization V" for a "Civilization VI" query,
//      "Modern Warfare III" for "Modern Warfare II", etc.), so an unverified
//      top-1 wildcard match is worse than no match at all here.

/** IGDB's /multiquery endpoint rejects request bodies with more than 10 sub-queries. */
export const IGDB_MULTIQUERY_MAX = 10;

const TRADEMARK_SYMBOL_PATTERN = /[™®©]/g;

/** Strips trademark/copyright symbols and collapses whitespace left behind. */
export function normalizeSteamName(name: string): string {
  return name.replace(TRADEMARK_SYMBOL_PATTERN, "").replace(/\s+/g, " ").trim();
}

// Store-page edition suffixes that wrap an otherwise-identical base game on
// IGDB. Deliberately excludes "Remastered" / "Remake" / "Director's Cut" —
// those are distinct IGDB entries from the base game, not the same one
// (verified: "Dark Souls: Remastered" and "Deus Ex: Human Revolution -
// Director's Cut" both resolve fine as their full titles).
const EDITION_SUFFIX_PATTERN =
  /\s*[-–:]?\s*\b(game of the year|goty|definitive|enhanced|complete|deluxe|ultimate|gold|anniversary|standard)\b\s*edition\s*$/i;

/** Strips a trailing store-page edition suffix, e.g. "Fallout 3: Game of the Year Edition" -> "Fallout 3". */
export function stripEditionSuffix(name: string): string {
  return name.replace(EDITION_SUFFIX_PATTERN, "").trim();
}

/** Lowercased, non-alphanumeric-stripped comparison key — "NieR: Automata" and "NieR:Automata" collapse to the same key. */
export function looseKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Picks the candidate (already sorted by relevance/rating by the caller's
 * query) whose loose key exactly matches the Steam name — either as given or
 * with its edition suffix stripped. Returns null rather than guessing when
 * no candidate loosely matches, since a wrong match here is worse than a
 * miss (it would silently rank the wrong game).
 */
export function pickBestMatch(steamName: string, candidates: IgdbGame[]): IgdbGame | null {
  const normalized = normalizeSteamName(steamName);
  const acceptableKeys = new Set([looseKey(normalized), looseKey(stripEditionSuffix(normalized))]);
  return candidates.find((candidate) => acceptableKeys.has(looseKey(candidate.name))) ?? null;
}

type MultiquerySubResult = { name: string; result: RawIgdbGame[] };

/**
 * Resolves a batch of Steam library titles to IGDB games in at most two
 * `/multiquery` round trips total, regardless of batch size. `names.length`
 * must not exceed `IGDB_MULTIQUERY_MAX` — batch upstream of this call.
 *
 * Returns a Map keyed by the *original* input string (not normalized), with
 * unresolved names simply absent — callers should treat a missing entry as
 * "no confident IGDB match", not as an error.
 */
export async function resolveGamesByName(names: string[]): Promise<Map<string, IgdbGame>> {
  if (names.length === 0) return new Map();
  if (names.length > IGDB_MULTIQUERY_MAX) {
    throw new Error(`resolveGamesByName: got ${names.length} names, max is ${IGDB_MULTIQUERY_MAX}`);
  }

  const resolved = new Map<string, IgdbGame>();

  // Pass 1: exact-ish (case-insensitive) name/alternative_names match.
  const exactQueries = names.map((name, i) => {
    const escaped = escapeApicalypseString(normalizeSteamName(name));
    return `query games "q${i}" { ${GAME_FIELDS} where (name ~ "${escaped}" | alternative_names.name ~ "${escaped}") & version_parent = null & game_type = ${GAME_TYPES}; sort total_rating_count desc; limit 1; };`;
  });
  const exactResults = await igdbRequest<MultiquerySubResult[]>("multiquery", exactQueries.join("\n"));

  const missIndexes: number[] = [];
  for (let i = 0; i < names.length; i++) {
    const raw = exactResults.find((r) => r.name === `q${i}`)?.result ?? [];
    if (raw.length > 0) {
      resolved.set(names[i], normalizeGame(raw[0]));
    } else {
      missIndexes.push(i);
    }
  }

  if (missIndexes.length === 0) {
    return resolved;
  }

  // Pass 2: wildcard candidate generation + verified pick, for pass-1 misses only.
  const fallbackQueries = missIndexes.map((i) => {
    const base = stripEditionSuffix(normalizeSteamName(names[i]));
    const tokens = tokenize(base);
    const nameClause =
      tokens.length > 0
        ? tokens.map((token) => `name ~ *"${escapeApicalypseString(token)}"*`).join(" & ")
        : `name ~ *"${escapeApicalypseString(base)}"*`;
    const altClause = `alternative_names.name ~ *"${escapeApicalypseString(base)}"*`;
    return `query games "q${i}" { ${GAME_FIELDS} where ((${nameClause}) | ${altClause}) & version_parent = null & game_type = ${GAME_TYPES}; sort total_rating_count desc; limit 8; };`;
  });
  const fallbackResults = await igdbRequest<MultiquerySubResult[]>("multiquery", fallbackQueries.join("\n"));

  for (const i of missIndexes) {
    const raw = fallbackResults.find((r) => r.name === `q${i}`)?.result ?? [];
    const candidates = raw.map(normalizeGame);
    const best = pickBestMatch(names[i], candidates);
    if (best) resolved.set(names[i], best);
  }

  return resolved;
}
