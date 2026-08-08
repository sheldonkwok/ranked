// Server-only IGDB API client, authenticated via a Twitch app's client-credentials OAuth flow (https://api-docs.igdb.com).
if (typeof window !== "undefined") {
  throw new Error("igdb.ts is server-only");
}

const TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const IGDB_API_BASE = "https://api.igdb.com/v4";

// How long before actual expiry we treat a cached token as stale, so we don't hand IGDB a token that dies mid-flight.
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
    // Token may have been revoked or expired early — invalidate, fetch a fresh one, and retry exactly once.
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
// Wider than the number of results shown client-side, since already-ranked games are filtered out server-side after this fetch.
const SEARCH_FETCH_LIMIT = 30;
// Main games, DLC, expansions, bundles, editions, ports, remakes, remasters — excludes episode/season/mod/pack, which floods naive search.
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

/** A cheap filter for "looks like a real, known game" — requiring a cover and a rating keeps a bare "Zelda" from outranking "The Legend of Zelda". */
function isSubstantive(game: IgdbGame): boolean {
  return game.coverImageId !== null && game.totalRatingCount > 0;
}

/** Promotes a substantive exact title match to the top (rating desc among exact matches), otherwise preserves the API's own order. */
export function mergeSearchResults(query: string, results: IgdbGame[]): IgdbGame[] {
  const normalizedQuery = query.trim().toLowerCase();

  function isExactSubstantiveMatch(game: IgdbGame): boolean {
    return game.name.trim().toLowerCase() === normalizedQuery && isSubstantive(game);
  }

  const exact = results.filter(isExactSubstantiveMatch).sort((a, b) => b.totalRatingCount - a.totalRatingCount);
  const rest = results.filter((game) => !isExactSubstantiveMatch(game));

  return [...exact, ...rest];
}

/** Tokenizes a query into words for the per-token infix match — lowercased, whitespace-split, stray `*` stripped, capped at MAX_QUERY_TOKENS. */
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

  // IGDB's `search` can't combine with `sort` or /multiquery (undocumented — silently kills the whole batch), so instead we do per-token infix matching on `name` OR'd with `alternative_names`, ordered by `sort total_rating_count desc`.
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

// Narrower than GAME_TYPES: main games, remakes, remasters, ports. DLC and bundles dominate a raw franchise listing.
const FRANCHISE_GAME_TYPES = "(0,8,9,11)";
// Wider than FRANCHISE_RESULT_LIMIT in the API route, since already-ranked games are filtered out server-side after this fetch.
const FRANCHISE_FETCH_LIMIT = 30;

type GameGroup = { id: number; name: string };
type RawGameGroups = { id: number; collections?: GameGroup[] | null; franchises?: GameGroup[] | null };

export type FranchiseGames = { franchiseName: string | null; games: IgdbGame[] };

/** Other games in `igdbId`'s series — prefers the tighter `collections` grouping, falling back to the broader `franchises` (which pulls in crossover cameos) only when a game has no collection. */
export async function getFranchiseGames(igdbId: number): Promise<FranchiseGames> {
  if (!Number.isInteger(igdbId) || igdbId <= 0) {
    throw new Error(`getFranchiseGames: igdbId must be a positive integer, got ${igdbId}`);
  }

  const groupRows = await igdbRequest<RawGameGroups[]>(
    "games",
    `fields collections.name, franchises.name; where id = ${igdbId}; limit 1;`
  );
  const collections = groupRows[0]?.collections ?? [];
  const field = collections.length > 0 ? "collections" : "franchises";
  const groups = collections.length > 0 ? collections : (groupRows[0]?.franchises ?? []);
  if (groups.length === 0) return { franchiseName: null, games: [] };

  const ids = groups.map((group) => group.id);
  const body = `${GAME_FIELDS} where ${field} = (${ids.join(",")}) & id != ${igdbId} & version_parent = null & game_type = ${FRANCHISE_GAME_TYPES} & total_rating_count > 0 & cover != null; sort total_rating_count desc; limit ${FRANCHISE_FETCH_LIMIT};`;
  const games = (await igdbRequest<RawIgdbGame[]>("games", body)).map(normalizeGame);
  return { franchiseName: groups[0].name, games };
}

// Steam library name resolution: Steam and IGDB titles frequently disagree, so resolving a Steam name is two passes — an exact-ish `name`/`alternative_names` match, then a wildcard fallback used only as a candidate generator re-verified by `pickBestMatch` (an unverified top-1 pick is worse than no match).

/** IGDB's /multiquery endpoint rejects request bodies with more than 10 sub-queries. */
export const IGDB_MULTIQUERY_MAX = 10;

const TRADEMARK_SYMBOL_PATTERN = /[™®©]/g;

/** Strips trademark/copyright symbols and collapses whitespace left behind. */
export function normalizeSteamName(name: string): string {
  return name.replace(TRADEMARK_SYMBOL_PATTERN, "").replace(/\s+/g, " ").trim();
}

// Store-page edition suffixes that wrap an otherwise-identical base game on IGDB — excludes "Remastered"/"Remake"/"Director's Cut", which are distinct IGDB entries.
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

/** Picks the candidate whose loose key exactly matches the Steam name (as given or edition-stripped); null rather than a risky guess. */
export function pickBestMatch(steamName: string, candidates: IgdbGame[]): IgdbGame | null {
  const normalized = normalizeSteamName(steamName);
  const acceptableKeys = new Set([looseKey(normalized), looseKey(stripEditionSuffix(normalized))]);
  return candidates.find((candidate) => acceptableKeys.has(looseKey(candidate.name))) ?? null;
}

type MultiquerySubResult = { name: string; result: RawIgdbGame[] };

/** Resolves a batch of Steam titles to IGDB games in at most two `/multiquery` round trips; unresolved names are simply absent from the result Map. */
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
