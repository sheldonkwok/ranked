import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getTwitchClient } from "@/lib/auth";

// Short-lived, single-use cookie that ties the callback request back to the
// authorization request it started from (CSRF protection for the OAuth
// flow). Not the same cookie as the actual session cookie.
const STATE_COOKIE_NAME = "twitch_oauth_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

// We only need enough scope to read the authenticated user's basic Helix
// profile (id/login/display_name/profile_image_url), which requires no
// specific OAuth scope beyond a valid user access token.
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
