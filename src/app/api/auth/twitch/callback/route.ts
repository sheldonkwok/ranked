import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { type Db, getDb, users } from "@/db";
import { fetchTwitchUser, getTwitchClient, type TwitchHelixUser } from "@/lib/auth";
import { createSession, getCurrentUser, setSessionCookie } from "@/lib/session";

const STATE_COOKIE_NAME = "twitch_oauth_state";

function oauthErrorRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL("/sign-in?error=oauth", request.url));
}

function settingsRedirect(request: NextRequest, twitch: "linked" | "error" | "taken"): NextResponse {
  const url = new URL("/settings", request.url);
  url.searchParams.set("twitch", twitch);
  return NextResponse.redirect(url);
}

/** True when err is a Postgres unique-violation on the given constraint (both prod and dev drivers surface it as an error whose message names the constraint). */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  return err instanceof Error && err.message.includes(constraint);
}

/** Signs a Twitch user in via upsert by twitchId; on a username collision (only possible against an unrelated Steam-only account's steam-<id> default) keeps the existing username for a returning user or disambiguates a new signup, since a cosmetic collision must never block sign-in. */
async function upsertTwitchSignIn(db: Db, twitchUser: TwitchHelixUser) {
  const baseValues = {
    twitchId: twitchUser.id,
    username: twitchUser.login,
    displayName: twitchUser.display_name,
    avatarUrl: twitchUser.profile_image_url,
  };

  try {
    const [user] = await db
      .insert(users)
      .values(baseValues)
      .onConflictDoUpdate({
        target: users.twitchId,
        set: {
          username: twitchUser.login,
          displayName: twitchUser.display_name,
          avatarUrl: twitchUser.profile_image_url,
        },
      })
      .returning();
    return user;
  } catch (err) {
    if (!isUniqueViolation(err, "users_username_lower_unique")) throw err;

    // Row already exists (hit the ON CONFLICT path) — update everything except the colliding username.
    const [existing] = await db
      .update(users)
      .set({ displayName: twitchUser.display_name, avatarUrl: twitchUser.profile_image_url })
      .where(eq(users.twitchId, twitchUser.id))
      .returning();
    if (existing) return existing;

    // No existing row — brand-new signup colliding with an unrelated username; disambiguate rather than fail.
    const [inserted] = await db
      .insert(users)
      .values({ ...baseValues, username: `${twitchUser.login}-${twitchUser.id}` })
      .returning();
    return inserted;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  // One-time use: clear the state cookie immediately, regardless of whether the flow succeeds.
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!code || !state || !storedState || state !== storedState) {
    return oauthErrorRedirect(request);
  }

  try {
    const twitch = getTwitchClient();
    const tokens = await twitch.validateAuthorizationCode(code);
    const twitchUser = await fetchTwitchUser(tokens.accessToken());

    const db = await getDb();

    // A signed-in Steam-only account here is linking Twitch, not switching accounts — otherwise this would silently upsert a new account and orphan their Steam-ranked entries.
    const current = await getCurrentUser();
    if (current && !current.twitchId) {
      const taken = await db.select({ id: users.id }).from(users).where(eq(users.twitchId, twitchUser.id));
      if (taken.length > 0 && taken[0].id !== current.id) {
        return settingsRedirect(request, "taken");
      }

      try {
        // Promote the username from the Steam-derived default to the Twitch login, now that a human-chosen handle exists.
        await db
          .update(users)
          .set({
            twitchId: twitchUser.id,
            username: twitchUser.login,
            displayName: current.displayName ?? twitchUser.display_name,
            avatarUrl: twitchUser.profile_image_url,
          })
          .where(eq(users.id, current.id));
      } catch (err) {
        if (!isUniqueViolation(err, "users_username_lower_unique")) throw err;
        // Desired username belongs to an unrelated account — link Twitch without renaming rather than failing.
        await db
          .update(users)
          .set({ twitchId: twitchUser.id, avatarUrl: twitchUser.profile_image_url })
          .where(eq(users.id, current.id));
      }

      return settingsRedirect(request, "linked");
    }

    const user = await upsertTwitchSignIn(db, twitchUser);

    const { token, session } = await createSession(user.id);
    await setSessionCookie(token, session.expiresAt);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    // Don't leak provider/internal error details to the client.
    console.error("Twitch OAuth callback failed:", err);
    return oauthErrorRedirect(request);
  }
}
