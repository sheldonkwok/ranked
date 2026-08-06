import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getDb, users } from "@/db";
import { createSession, getCurrentUser, setSessionCookie } from "@/lib/session";
import { fetchSteamPlayerSummary, getAppUrl, steamUsername, verifySteamCallback } from "@/lib/steam";

const STATE_COOKIE_NAME = "steam_openid_state";

/** A link attempt (session already existed) failed or was rejected — back to
 * /settings with a reason banner. "linked"/"taken" only ever happen here. */
function redirectToSettings(request: NextRequest, steam: "linked" | "error" | "taken"): NextResponse {
  const url = new URL("/settings", request.url);
  url.searchParams.set("steam", steam);
  return NextResponse.redirect(url);
}

/** A sign-in attempt (no session yet) failed — back to /sign-in, same error
 * banner the Twitch flow uses. */
function redirectToSignIn(request: NextRequest): NextResponse {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", "oauth");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  // Whether a session already exists is the signal for "link to my account"
  // vs. "sign in as whoever owns this Steam account" — there's no separate
  // intent cookie, since the semantics fall out of this one check.
  const user = await getCurrentUser();

  const queryState = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  // One-time use: clear the state cookie as soon as we've read it, whether
  // or not the flow ultimately succeeds.
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!queryState || !storedState || queryState !== storedState) {
    return user ? redirectToSettings(request, "error") : redirectToSignIn(request);
  }

  try {
    // Must exactly match the `return_to` we sent Steam in the initial
    // redirect (src/app/api/auth/steam/route.ts) — Steam echoes it back
    // signed, and `verifySteamCallback` checks it matches before trusting
    // the callback.
    const expectedReturnTo = new URL("/api/auth/steam/callback", getAppUrl());
    expectedReturnTo.searchParams.set("state", queryState);

    const steamId = await verifySteamCallback(request.nextUrl.searchParams, expectedReturnTo.toString());
    if (!steamId) {
      return user ? redirectToSettings(request, "error") : redirectToSignIn(request);
    }

    const db = await getDb();
    const summary = await fetchSteamPlayerSummary(steamId);

    if (user) {
      // Linking to the account already signed in. A SteamID can only be
      // linked to one Ranked account (unique constraint on users.steamId) —
      // check up front so we can send a friendly "already linked elsewhere"
      // redirect instead of a generic error.
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.steamId, steamId), ne(users.id, user.id)));
      if (existing.length > 0) {
        return redirectToSettings(request, "taken");
      }

      await db
        .update(users)
        .set({
          steamId,
          steamPersonaName: summary?.personaName ?? null,
          steamAvatarUrl: summary?.avatarUrl ?? null,
          steamLinkedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      return redirectToSettings(request, "linked");
    }

    // Signed out: sign in. `onConflictDoUpdate` on the unique `steamId`
    // makes this an atomic find-or-create — if this SteamID already belongs
    // to an account (Steam-created, or linked from /settings), that row
    // comes back and we sign into it rather than forking a second one. Only
    // the persona snapshot is refreshed on an existing row; username,
    // displayName, twitchId and steamLinkedAt are left alone so signing in
    // never rewrites an established profile.
    const [account] = await db
      .insert(users)
      .values({
        steamId,
        username: steamUsername(steamId),
        displayName: summary?.personaName ?? null,
        steamPersonaName: summary?.personaName ?? null,
        steamAvatarUrl: summary?.avatarUrl ?? null,
        steamLinkedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.steamId,
        set: { steamPersonaName: summary?.personaName ?? null, steamAvatarUrl: summary?.avatarUrl ?? null },
      })
      .returning();

    const { token, session } = await createSession(account.id);
    await setSessionCookie(token, session.expiresAt);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    // Don't leak provider/internal error details to the client. Also covers
    // the unique-constraint race if two accounts link the same SteamID
    // concurrently.
    console.error("Steam OpenID callback failed:", err);
    return user ? redirectToSettings(request, "error") : redirectToSignIn(request);
  }
}
