// Server-only Steam account linking (OpenID 2.0).
//
// Steam has no OAuth2 — the only sign-in it offers is OpenID 2.0 against
// https://steamcommunity.com/openid. There's no Arctic provider for it (Arctic
// only speaks OAuth2/OIDC), so this flow is hand-rolled: build a
// `checkid_setup` redirect, then on the way back echo the exact params Steam
// sent us to `check_authentication` to verify they weren't forged, and pull
// the SteamID64 out of the (now-verified) `claimed_id`.
//
// This file must never be imported from client components/bundles.
if (typeof window !== "undefined") {
  throw new Error("steam.ts is server-only");
}

/**
 * `APP_URL` is the same env var the Twitch OAuth redirect URI is built from
 * (see `src/lib/auth.ts`). Read lazily (only when a Steam route actually
 * runs) so the app still builds/typechecks without it configured.
 */
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

/**
 * Builds the URL to redirect the user to in order to start a Steam OpenID
 * sign-in (`checkid_setup` mode). `returnTo` is where Steam sends the user
 * back to (must exactly match what we later pass to `check_authentication`);
 * `realm` is the trust root Steam displays on its login page (our app's
 * origin).
 */
export function buildSteamAuthUrl(returnTo: string, realm: string): string {
  const url = new URL(STEAM_OPENID_LOGIN_URL);
  url.searchParams.set("openid.ns", STEAM_OPENID_NS);
  url.searchParams.set("openid.mode", "checkid_setup");
  url.searchParams.set("openid.return_to", returnTo);
  url.searchParams.set("openid.realm", realm);
  // We don't know the user's SteamID up front — ask Steam to let the user
  // pick/confirm which account to sign in with.
  url.searchParams.set("openid.identity", STEAM_IDENTIFIER_SELECT);
  url.searchParams.set("openid.claimed_id", STEAM_IDENTIFIER_SELECT);
  return url.toString();
}

/**
 * Builds the body for the `check_authentication` verification request: every
 * `openid.*` param from the callback, copied through byte-for-byte (Steam
 * signed the exact values it sent), with `openid.mode` swapped from
 * `id_res` to `check_authentication`. Non-`openid.*` params (e.g. our own
 * `state`) are dropped — Steam doesn't know about them and would reject an
 * unrecognized param.
 */
export function buildVerificationBody(params: URLSearchParams): URLSearchParams {
  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (!key.startsWith("openid.")) continue;
    body.set(key, key === "openid.mode" ? "check_authentication" : value);
  }
  return body;
}

/**
 * Extracts a SteamID64 from a callback's params, structurally — without
 * contacting Steam. Requires `openid.claimed_id` to be a well-formed Steam
 * identity URL and `openid.return_to` to match what we sent (guards against a
 * replayed/mismatched callback). Callers MUST still call
 * `verifySteamCallback` before trusting the result — this only checks shape.
 */
export function extractSteamId(params: URLSearchParams, expectedReturnTo: string): string | null {
  const claimedId = params.get("openid.claimed_id");
  const returnTo = params.get("openid.return_to");
  if (!claimedId || !returnTo || returnTo !== expectedReturnTo) return null;

  const match = claimedId.match(STEAM_CLAIMED_ID_PATTERN);
  return match ? match[1] : null;
}

/**
 * Verifies a Steam OpenID callback and returns the signed-in SteamID64, or
 * null if the callback is malformed or Steam rejects it.
 *
 * Two checks, both required: the callback params must structurally claim a
 * well-formed Steam identity for the return_to we issued (`extractSteamId`),
 * and Steam itself must confirm the signed assertion is genuine
 * (`check_authentication` — otherwise anyone could forge a callback request
 * with an arbitrary `claimed_id`).
 */
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

/**
 * Fetches a Steam account's public persona name + avatar for display.
 * Best-effort: returns null (never throws) when `STEAM_API_KEY` is unset or
 * the request fails, so account linking still succeeds without it — the
 * linked SteamID is what matters, the persona display is a nice-to-have.
 */
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

/** Thrown by `fetchSteamLibrary` when `STEAM_API_KEY` isn't set — unlike the
 * persona lookup, a library import has nothing useful to fall back to. */
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

/**
 * Fetches a Steam account's owned games via `IPlayerService/GetOwnedGames`,
 * sorted by all-time playtime descending (most-played first).
 *
 * Returns `[]` for a private/friends-only profile — Steam answers with an
 * empty `response` object (no `games` key) rather than an error in that
 * case, so there's nothing to distinguish from "no games" here.
 *
 * Throws `SteamNotConfiguredError` if `STEAM_API_KEY` is unset, and rethrows
 * on any other fetch/parse failure — unlike `fetchSteamPlayerSummary`, this
 * is the whole point of the call, so there's no silent degrade.
 */
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
