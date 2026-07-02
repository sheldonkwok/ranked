import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, deleteSessionCookie, hashToken, invalidateSession } from "@/lib/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await invalidateSession(hashToken(token));
  }

  await deleteSessionCookie();

  return NextResponse.redirect(new URL("/sign-in", request.url), { status: 303 });
}
