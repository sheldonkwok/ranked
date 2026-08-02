// Server-only session management: hand-rolled DB sessions following the
// Lucia-guide pattern (https://lucia-auth.com/sessions/basic-api/) —
// a random token is given to the client, only its SHA-256 hash is stored
// server-side, and the row is looked up by that hash on every request.
//
// This file must never be imported from client components/bundles.
if (typeof window !== "undefined") {
  throw new Error("session.ts is server-only");
}

import { createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { getDb, sessions, users, type Session, type User } from "@/db";

/** Name of the cookie holding the raw session token. */
export const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

/**
 * Opt-in dev-only auth bypass. Gated on NODE_ENV !== "production" in code
 * (not just convention), so DISABLE_AUTH is inert even if it's accidentally
 * set in a prod environment. See DISABLE_AUTH in .env.example.
 */
const AUTH_DISABLED =
  process.env.NODE_ENV !== "production" && process.env.DISABLE_AUTH === "true";
const DEV_USER_TWITCH_ID = "dev-user";

/**
 * Upserts a fixed synthetic "dev" user, used in place of real auth when
 * AUTH_DISABLED. Mirrors the upsert in scripts/dev-session.ts.
 */
async function getOrCreateDevUser(): Promise<User> {
  const db = await getDb();
  const [user] = await db
    .insert(users)
    .values({
      twitchId: DEV_USER_TWITCH_ID,
      username: "dev",
      displayName: "Dev User",
      avatarUrl: null,
    })
    .onConflictDoUpdate({
      target: users.twitchId,
      set: { username: "dev" },
    })
    .returning();
  return user;
}

/**
 * Generates a fresh, cryptographically random session token to hand to the
 * client (as the cookie value). Never stored server-side directly — see
 * `hashToken`.
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/**
 * The session's DB id is the SHA-256 hex digest of its token, so that a
 * stolen DB row (e.g. via a read-only SQL injection) can't be replayed as a
 * valid session cookie.
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Creates a new session for `userId`, valid for 30 days from now.
 * Returns both the raw token (to set as a cookie) and the DB row.
 */
export async function createSession(
  userId: string
): Promise<{ token: string; session: Session }> {
  const token = generateSessionToken();
  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const db = await getDb();
  const [session] = await db
    .insert(sessions)
    .values({ id: sessionId, userId, expiresAt })
    .returning();

  return { token, session };
}

/**
 * Validates a raw session token against the DB.
 *
 * - Unknown token -> null.
 * - Expired session -> deletes the row, returns null.
 * - Session within 15 days of expiry -> slides the expiry forward to 30
 *   days from now (renewal-on-use), persisted to the DB.
 *
 * Does NOT touch cookies — callers that can set cookies (route handlers,
 * server functions) should refresh the cookie's expiry themselves when the
 * returned session's `expiresAt` differs from what's currently set.
 */
export async function validateSessionToken(
  token: string
): Promise<{ user: User; session: Session } | null> {
  const sessionId = hashToken(token);
  const db = await getDb();

  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId));

  const row = rows[0];
  if (!row) return null;

  const { user, session } = row;
  const now = Date.now();

  if (now >= session.expiresAt.getTime()) {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  if (now >= session.expiresAt.getTime() - SESSION_RENEWAL_THRESHOLD_MS) {
    session.expiresAt = new Date(now + SESSION_DURATION_MS);
    await db
      .update(sessions)
      .set({ expiresAt: session.expiresAt })
      .where(eq(sessions.id, sessionId));
  }

  return { user, session };
}

/** Deletes a session row by its (hashed) id, logging it out everywhere. */
export async function invalidateSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Sets the `session` cookie. httpOnly + sameSite=lax + secure-in-prod, with
 * `expires` mirroring the DB row's `expiresAt` so the client-side cookie
 * lifetime always matches server-side session validity.
 */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  });
}

/** Clears the `session` cookie (immediate expiry). */
export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

/** Reads the raw session token from the incoming request's cookies, if any. */
async function getSessionTokenFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Resolves the current request's authenticated user, or null.
 *
 * Wrapped in React's `cache()` so multiple calls within the same request
 * (e.g. a layout and a page both calling this) only hit the DB once.
 *
 * Opportunistically refreshes the session cookie's expiry when
 * `validateSessionToken` slides the session forward. That `cookies().set`
 * call is only legal in a route handler or server function — when
 * `getCurrentUser` is called from a Server Component render, Next.js throws;
 * we swallow that specific case since the cookie will simply get refreshed
 * on a subsequent request that *can* set cookies (e.g. the next
 * navigation's route handler, or middleware/proxy re-issuing it isn't
 * needed since presence-only checks don't care about the exact expiry).
 *
 * When AUTH_DISABLED, short-circuits to a fixed synthetic dev user — no
 * cookie, no DB session row, no Twitch calls involved.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (AUTH_DISABLED) {
    return getOrCreateDevUser();
  }

  const token = await getSessionTokenFromCookie();
  if (!token) return null;

  const result = await validateSessionToken(token);
  if (!result) return null;

  try {
    await setSessionCookie(token, result.session.expiresAt);
  } catch {
    // Called from a Server Component render, where cookies can't be set.
    // Safe to ignore — see JSDoc above.
  }

  return result.user;
});

/** Thrown by `requireUser()` when there is no authenticated user. */
export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Like `getCurrentUser()`, but throws `UnauthorizedError` instead of
 * returning null.
 *
 * Intended for API route handlers, which can do:
 *
 * ```ts
 * try {
 *   const user = await requireUser();
 *   // ...
 * } catch (err) {
 *   if (err instanceof UnauthorizedError) {
 *     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 *   }
 *   throw err;
 * }
 * ```
 *
 * Pages and Server Components should generally prefer `getCurrentUser()`
 * plus an explicit `redirect('/sign-in')`, since a thrown error there would
 * surface as a 500 error page rather than a friendly redirect.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
