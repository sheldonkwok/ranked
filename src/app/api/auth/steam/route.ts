import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { buildSteamAuthUrl, getAppUrl } from "@/lib/steam";

// Short-lived, single-use cookie for CSRF protection — Steam's OpenID has no state param, so we carry one in return_to and stash the expected value here (same pattern as twitch_oauth_state).
const STATE_COOKIE_NAME = "steam_openid_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

// No auth guard — Steam is now a sign-in method too; sign-in vs. link-to-account is decided in the callback by whether a session already exists.
export async function GET() {
  const appUrl = getAppUrl();
  const state = generateState();

  const returnTo = new URL("/api/auth/steam/callback", appUrl);
  returnTo.searchParams.set("state", state);

  const authorizationUrl = buildSteamAuthUrl(returnTo.toString(), appUrl);

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
