import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Next.js 16's replacement for middleware.ts (see node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).

// Keep in sync with SESSION_COOKIE_NAME in src/lib/session.ts — duplicated so this file stays free of DB/Node-only imports.
const SESSION_COOKIE_NAME = "session";

// Keep in sync with AUTH_DISABLED in src/lib/session.ts.
const AUTH_DISABLED = process.env.NODE_ENV !== "production" && process.env.DISABLE_AUTH === "true";

// Cheap cookie-presence check only; real session validation happens in getCurrentUser()/requireUser() (src/lib/session.ts).
export function proxy(request: NextRequest): NextResponse {
  if (AUTH_DISABLED) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);

  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Every path except /sign-in, /u/*, /api/auth/*, Next internals, and favicon.ico.
    "/((?!sign-in|u/|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
