import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { getDb, users } from "@/db";
import { getCurrentUser } from "@/lib/session";
import { fetchSteamPlayerSummary, getAppUrl, verifySteamCallback } from "@/lib/steam";

const STATE_COOKIE_NAME = "steam_openid_state";

function redirectToSettings(request: NextRequest, steam: "linked" | "error" | "taken"): NextResponse {
  const url = new URL("/settings", request.url);
  url.searchParams.set("steam", steam);
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const queryState = request.nextUrl.searchParams.get("state");

  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value ?? null;
  // One-time use: clear the state cookie as soon as we've read it, whether
  // or not the flow ultimately succeeds.
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!queryState || !storedState || queryState !== storedState) {
    return redirectToSettings(request, "error");
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
      return redirectToSettings(request, "error");
    }

    const db = await getDb();

    // A SteamID can only be linked to one Ranked account (unique constraint
    // on users.steamId). Check up front so we can send a friendly
    // "already linked elsewhere" redirect instead of a generic error.
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.steamId, steamId), ne(users.id, user.id)));
    if (existing.length > 0) {
      return redirectToSettings(request, "taken");
    }

    const summary = await fetchSteamPlayerSummary(steamId);

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
  } catch (err) {
    // Don't leak provider/internal error details to the client. Also covers
    // the unique-constraint race if two accounts link the same SteamID
    // concurrently.
    console.error("Steam OpenID callback failed:", err);
    return redirectToSettings(request, "error");
  }
}
