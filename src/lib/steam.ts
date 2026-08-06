// Server-only Steam account linking — hand-rolled OpenID 2.0 flow (Steam has no OAuth2, and Arctic only speaks OAuth2/OIDC).
if (typeof window !== "undefined") {
  throw new Error("steam.ts is server-only");
}

/** Same env var the Twitch OAuth redirect URI is built from (`src/lib/auth.ts`); read lazily so the app builds without it configured. */
export function getAppUrl(): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error(
      "Missing APP_URL environment variable required for Steam sign-in. Set it in .env.local (see .env.example)."
    );
  }
  return appUrl;
}

const STEAM_OPENID_LOGIN_URL = "https://steamcommunity.com/openid/login";
const STEAM_OPENID_NS = "http://specs.openid.net/auth/2.0";
const STEAM_IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const STEAM_CLAIMED_ID_PATTERN = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;
const STEAM_API_BASE = "https://api.steampowered.com";

/** Builds the redirect URL to start a Steam OpenID sign-in (`checkid_setup`); `returnTo` must exactly match what's later passed to `check_authentication`. */
export function buildSteamAuthUrl(returnTo: string, realm: string): string {
  const url = new URL(STEAM_OPENID_LOGIN_URL);
  url.searchParams.set("openid.ns", STEAM_OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo);
  url.searchParams.set("openid.realm", realm);
  // We don't know the user's SteamID up front — let Steam ask which account to sign in with.
  url.searchParams.set("openid.identity", STEAM_IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", STEAM_IDENTIFIER_SELECT);
  return url.toString();
}

/** Builds the `check_authentication` body: every `openid.*` param copied byte-for-byte with `openid.mode` swapped to `check_authentication`. */
export function buildVerificationBody(params: URLSearchParams): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (!key.startsWith("openid.")) continue;
    body.set(key, key === "openid.mode" ? "check_authentication" : value);
  }
  return body;
}

/** Extracts a SteamID64 from a callback's params structurally (no network call) — callers MUST still call `verifySteamCallback` before trusting it. */
export function extractSteamId(params: URLSearchParams, expectedReturnTo: string): string | null {
  const claimedId = params.get("openid.claimed_id");
  const returnTo = params.get("openid.return_to");
  if (!claimedId || !returnTo || returnTo !== expectedReturnTo) return null;

  const match = claimedId.match(STEAM_CLAIMED_ID_PATTERN);
  return match ? match[1] : null;
}

/** Verifies a Steam OpenID callback (structural check + `check_authentication` confirmation) and returns the SteamID64, or null. */
export async function verifySteamCallback(params: URLSearchParams, expectedReturnTo: string): Promise<string | null> {
  const steamId = extractSteamId(params, expectedReturnTo);
  if (!steamId) return null;

  const res = await fetch(STEAM_OPENID_LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildVerificationBody(params).toString(),
    cache: "no-store",
  });

  if (!res.ok) return null;

  const text = await res.text();
  return /^is_valid:true$/m.test(text) ? steamId : null;
}

export type SteamPlayerSummary = {
  personaName: string;
  avatarUrl: string;
};

type SteamPlayerSummariesResponse = {
  response: {
    players: Array<{ steamid: string; personaname: string; avatarfull: string }>;
  };
};

/** Fetches a Steam account's public persona name + avatar for display; best-effort, returns null rather than throwing so linking still succeeds. */
export async function fetchSteamPlayerSummary(steamId: string): Promise<SteamPlayerSummary | null> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL(`${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/`);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("steamids", steamId);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const body = (await res.json()) as SteamPlayerSummariesResponse;
    const player = body.response.players[0];
    if (!player) return null;

    return { personaName: player.personaname, avatarUrl: player.avatarfull };
  } catch (err) {
    console.error("Steam GetPlayerSummaries failed:", err);
    return null;
  }
}

/** Public Steam profile URL for a SteamID64. */
export function steamProfileUrl(steamId: string): string {
  return `https://steamcommunity.com/profiles/${steamId}`;
}

/** Default `users.username` for Steam sign-in accounts — the `steam-` prefix's hyphen can't collide with a Twitch-derived username ([A-Za-z0-9_] only). */
export function steamUsername(steamId: string): string {
  return `steam-${steamId}`;
}

/** Thrown by `fetchSteamLibrary` when `STEAM_API_KEY` isn't set — unlike the persona lookup, a library import has nothing to fall back to. */
export class SteamNotConfiguredError extends Error {
  constructor() {
    super("STEAM_API_KEY is not configured");
  }
}

export type SteamOwnedGame = {
  appId: number;
  name: string;
  playtimeForever: number; // minutes
};

type SteamOwnedGamesResponse = {
  response: {
    game_count?: number;
    games?: Array<{ appid: number; name?: string; playtime_forever?: number }>;
  };
};

/** Fetches owned games via `GetOwnedGames`, sorted by playtime desc; returns `[]` for a private profile, throws on any other failure (no silent degrade). */
export async function fetchSteamLibrary(steamId: string): Promise<SteamOwnedGame[]> {
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) {
    console.error("fetchSteamLibrary: STEAM_API_KEY is not configured");
    throw new SteamNotConfiguredError();
  }

  const url = new URL(`${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/`);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "true");
  url.searchParams.set("include_played_free_games", "true");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Steam GetOwnedGames failed (status ${res.status})`);
  }

  const body = (await res.json()) as SteamOwnedGamesResponse;
  const games = body.response.games ?? [];

  return games
    .map((game) => ({
      appId: game.appid,
      name: game.name ?? "",
      playtimeForever: game.playtime_forever ?? 0,
    }))
    .filter((game) => game.name.length > 0)
    .sort((a, b) => b.playtimeForever - a.playtimeForever);
}
