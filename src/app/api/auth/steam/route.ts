import { generateState } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { buildSteamAuthUrl, getAppUrl } from "@/lib/steam";

// Short-lived, single-use cookie that ties the callback request back to the
// request that started it (CSRF protection). Steam's OpenID flow has no
// `state` param of its own, so we carry one in the `return_to` URL instead
// and stash the expected value here — same pattern as `twitch_oauth_state`.
const STATE_COOKIE_NAME = "steam_openid_state";
const STATE_COOKIE_MAX_AGE_SECONDS = 60 * 10; // 10 minutes

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

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
