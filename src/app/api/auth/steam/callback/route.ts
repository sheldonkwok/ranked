import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getDb, users } from "@/db";
import { createSession, getCurrentUser, setSessionCookie } from "@/lib/session";
import { fetchSteamPlayerSummary, getAppUrl, steamUsername, verifySteamCallback } from "@/lib/steam";

const STATE_COOKIE_NAME = "steam_openid_state";

/** A link attempt (session already existed) failed/was rejected — back to /settings with a reason banner; "linked"/"taken" only happen here. */
function redirectToSettings(request: NextRequest, steam: "linked" | "error" | "taken"): NextResponse {
  const url = new URL("/settings", request.url);
  url.searchParams.set("steam", steam);
  return NextResponse.redirect(url);
}

/** A sign-in attempt (no session yet) failed — back to /sign-in, same error banner as the Twitch flow. */
function redirectToSignIn(request: NextRequest): NextResponse {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("error", "oauth");
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  // Whether a session already exists is the sole signal for link-vs-sign-in — no separate intent cookie needed.
  const user = await getCurrentUser();

  const queryState = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  // One-time use: clear the state cookie immediately, regardless of whether the flow succeeds.
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!queryState || !storedState || queryState !== storedState) {
    return user ? redirectToSettings(request, "error") : redirectToSignIn(request);
  }

  try {
    // Must exactly match the return_to sent in the initial redirect — Steam echoes it back signed, and verifySteamCallback checks it before trusting the callback.
    const expectedReturnTo = new URL("/api/auth/steam/callback", getAppUrl());
    expectedReturnTo.searchParams.set("state", queryState);

    const steamId = await verifySteamCallback(request.nextUrl.searchParams, expectedReturnTo.toString());
    if (!steamId) {
      return user ? redirectToSettings(request, "error") : redirectToSignIn(request);
    }

    const db = await getDb();
    const summary = await fetchSteamPlayerSummary(steamId);

    if (user) {
      // A SteamID can only link to one account (unique constraint) — check up front for a friendly "already linked elsewhere" redirect instead of a generic error.
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

    // Signed out: sign in. onConflictDoUpdate on the unique steamId makes this an atomic find-or-create; only the persona snapshot is refreshed so signing in never rewrites an established profile.
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
    // Don't leak provider/internal error details; also covers the unique-constraint race from concurrent SteamID links.
    console.error("Steam OpenID callback failed:", err);
    return user ? redirectToSettings(request, "error") : redirectToSignIn(request);
  }
}
