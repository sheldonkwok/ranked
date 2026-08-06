import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, users } from "@/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  // Steam may be this account's only identity (a Steam sign-up that never
  // linked Twitch). Stripping it would violate the users_identity_required
  // check (src/db/schema.ts) and, worse, lock the user out entirely — refuse
  // before that instead of surfacing a 500.
  if (!user.twitchId) {
    return NextResponse.redirect(new URL("/settings?steam=last_identity", request.url), { status: 303 });
  }

  const db = await getDb();
  await db
    .update(users)
    .set({
      steamId: null,
      steamPersonaName: null,
      steamAvatarUrl: null,
      steamLinkedAt: null,
    })
    .where(eq(users.id, user.id));

  return NextResponse.redirect(new URL("/settings", request.url), {
    status: 303,
  });
}
