import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
// (functionality is unchanged, see node_modules/next/dist/docs/01-app/
// 01-getting-started/16-proxy.md). This file lives at src/proxy.ts, the
// same level as src/app, per that doc's "Convention" section.

// Keep in sync with SESSION_COOKIE_NAME in src/lib/session.ts. Duplicated
// (rather than imported) so this file stays free of the DB/Node-only
// imports that src/lib/session.ts pulls in — proxy should stay light and
// must not do slow data fetching (see the "Proxy is not intended for slow
// data fetching" note in the docs above).
const SESSION_COOKIE_NAME = "session";

// Keep in sync with AUTH_DISABLED in src/lib/session.ts. Duplicated for the
// same reason as SESSION_COOKIE_NAME above — see that comment.
const AUTH_DISABLED =
  process.env.NODE_ENV !== "production" && process.env.DISABLE_AUTH === "true";

/**
 * Optimistic auth gate: redirects to /sign-in whenever the `session` cookie
 * is absent. This is a cheap presence check only — it does NOT validate the
 * session against the DB (no DB access is available/appropriate here).
 * Real session validation happens in `getCurrentUser()` / `requireUser()`
 * (src/lib/session.ts), which pages and API routes must still call.
 */
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
    /*
     * Run on every path except:
     * - /sign-in (the page we redirect unauthenticated users to)
     * - /api/auth/* (OAuth start/callback/sign-out routes)
     * - Next.js internals (_next/static, _next/image)
     * - favicon.ico
     */
    "/((?!sign-in|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
