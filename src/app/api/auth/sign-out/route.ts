import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  deleteSessionCookie,
  hashToken,
  invalidateSession,
  SESSION_COOKIE_NAME,
} from "@/lib/session";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await invalidateSession(hashToken(token));
  }

  await deleteSessionCookie();

  return NextResponse.redirect(new URL("/sign-in", request.url), {
    status: 303,
  });
}
