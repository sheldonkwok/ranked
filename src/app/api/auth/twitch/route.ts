import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTwitchClient } from "@/lib/auth";

// Short-lived, single-use cookie tying the callback back to this authorization request (CSRF protection) — distinct from the session cookie.
const STATE_COOKIE_NAME = "twitch_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

// No scopes needed — basic Helix profile fields require only a valid user access token.
const TWITCH_SCOPES: string[] = [];

export async function GET() {
  const twitch = getTwitchClient();
  const state = generateState();
  const authorizationUrl = twitch.createAuthorizationURL(state, TWITCH_SCOPES);

  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  });

  return NextResponse.redirect(authorizationUrl);
}
