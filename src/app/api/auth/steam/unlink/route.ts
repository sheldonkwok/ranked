import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, users } from "@/db";
import { getCurrentUser } from "@/lib/session";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
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
