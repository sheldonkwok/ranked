// Server-only Twitch OAuth client (Arctic).
//
// This file must never be imported from client components/bundles.
if (typeof window !== "undefined") {
  throw new Error("auth.ts is server-only");
}

import { Twitch } from "arctic";

let twitchClient: Twitch | null = null;

/**
 * Lazily constructs (and memoizes) the Arctic Twitch OAuth2 client.
 *
 * Lazy on purpose: constructing eagerly at module-eval time would throw as
 * soon as this file is imported whenever TWITCH_CLIENT_ID/
 * TWITCH_CLIENT_SECRET/APP_URL aren't set (e.g. during `tsc --noEmit`, CI,
 * or any route that merely imports a sibling module). Deferring the env
 * check to first call means the app still builds/typechecks without
 * `.env.local`, and only the actual OAuth routes fail (loudly) if
 * misconfigured.
 */
export function getTwitchClient(): Twitch {
  if (twitchClient) return twitchClient;

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const appUrl = process.env.APP_URL;

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Missing TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, or APP_URL environment variables required for Twitch OAuth sign-in. Set them in .env.local (see .env.example)."
    );
  }

  const redirectURI = `${appUrl}/api/auth/twitch/callback`;
  twitchClient = new Twitch(clientId, clientSecret, redirectURI);
  return twitchClient;
}

export type TwitchHelixUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
};

/**
 * Fetches the authenticated user's profile from the Twitch Helix API using
 * an Arctic-issued OAuth access token.
 *
 * Helix requires both the bearer token *and* the app's Client-Id header —
 * the access token alone isn't enough to identify which app is calling.
 */
export async function fetchTwitchUser(accessToken: string): Promise<TwitchHelixUser> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing TWITCH_CLIENT_ID environment variable");
  }

  const res = await fetch("https://api.twitch.tv/helix/users", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch Helix /users request failed (status ${res.status}): ${text}`);
  }

  const body = (await res.json()) as { data: TwitchHelixUser[] };
  const user = body.data[0];
  if (!user) {
    throw new Error("Twitch Helix /users response contained no user data");
  }

  return user;
}
