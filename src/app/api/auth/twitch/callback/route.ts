import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getDb, users } from "@/db";
import { fetchTwitchUser, getTwitchClient } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/session";

const STATE_COOKIE_NAME = "twitch_oauth_state";

function oauthErrorRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/sign-in?error=oauth", request.url));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  // One-time use: clear the state cookie as soon as we've read it, whether
  // or not the flow ultimately succeeds.
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!code || !state || !storedState || state !== storedState) {
    return oauthErrorRedirect(request);
  }

  try {
    const twitch = getTwitchClient();
    const tokens = await twitch.validateAuthorizationCode(code);
    const twitchUser = await fetchTwitchUser(tokens.accessToken());

    const db = await getDb();
    const [user] = await db
      .insert(users)
      .values({
        twitchId: twitchUser.id,
        username: twitchUser.login,
        displayName: twitchUser.display_name,
        avatarUrl: twitchUser.profile_image_url,
      })
      .onConflictDoUpdate({
        target: users.twitchId,
        set: {
          username: twitchUser.login,
          displayName: twitchUser.display_name,
          avatarUrl: twitchUser.profile_image_url,
        },
      })
      .returning();

    const { token, session } = await createSession(user.id);
    await setSessionCookie(token, session.expiresAt);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    // Don't leak provider/internal error details to the client.
    console.error("Twitch OAuth callback failed:", err);
    return oauthErrorRedirect(request);
  }
}
