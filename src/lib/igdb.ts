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
    throw new Error(
      `Failed to obtain Twitch OAuth token (status ${res.status}): ${text}`
    );
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
};

type RawIgdbGame = {
  id: number;
  name: string;
  cover?: { image_id: string } | null;
  first_release_date?: number | null;
  platforms?: { abbreviation?: string }[] | null;
  summary?: string | null;
};

const GAME_FIELDS =
  "fields name, cover.image_id, first_release_date, platforms.abbreviation, summary;";

function normalizeGame(raw: RawIgdbGame): IgdbGame {
  return {
    igdbId: raw.id,
    name: raw.name,
    coverImageId: raw.cover?.image_id ?? null,
    firstReleaseDate:
      typeof raw.first_release_date === "number"
        ? new Date(raw.first_release_date * 1000)
        : null,
    platforms: (raw.platforms ?? [])
      .map((p) => p.abbreviation)
      .filter((abbr): abbr is string => Boolean(abbr)),
    summary: raw.summary ?? null,
  };
}

function escapeApicalypseString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function searchGames(query: string): Promise<IgdbGame[]> {
  const escaped = escapeApicalypseString(query);
  const body = `search "${escaped}"; ${GAME_FIELDS} where version_parent = null; limit 20;`;
  const results = await igdbRequest<RawIgdbGame[]>("games", body);
  return results.map(normalizeGame);
}

export async function getGameByIgdbId(igdbId: number): Promise<IgdbGame | null> {
  if (!Number.isInteger(igdbId) || igdbId <= 0) {
    throw new Error(`getGameByIgdbId: igdbId must be a positive integer, got ${igdbId}`);
  }
  const body = `${GAME_FIELDS} where id = ${igdbId}; limit 1;`;
  const results = await igdbRequest<RawIgdbGame[]>("games", body);
  return results.length > 0 ? normalizeGame(results[0]) : null;
}
