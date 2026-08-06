// Server-only session management: hand-rolled DB sessions following the Lucia pattern (https://lucia-auth.com/sessions/basic-api/).
if (typeof window !== "undefined") {
  throw new Error("session.ts is server-only");
}

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { getDb, type Session, sessions, type User, users } from "@/db";
import { withResolvedAvatar } from "@/lib/avatar";

/** Name of the cookie holding the raw session token. */
export const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // 15 days

// Opt-in dev-only auth bypass, gated on NODE_ENV !== "production" in code so it's inert if accidentally set in prod. See .env.example.
const AUTH_DISABLED = process.env.NODE_ENV !== "production" && process.env.DISABLE_AUTH === "true";
const DEV_USER_TWITCH_ID = "dev-user";

// Upserts a fixed synthetic "dev" user, used in place of real auth when AUTH_DISABLED. Mirrors the upsert in scripts/dev-session.ts.
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
  return withResolvedAvatar(user);
}

/** Generates a fresh, cryptographically random session token for the client cookie — never stored server-side directly, see `hashToken`. */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64url");
}

/** The session's DB id is the SHA-256 hex digest of its token, so a stolen DB row can't be replayed as a valid session cookie. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a new session for `userId`, valid for 30 days; returns both the raw token (for the cookie) and the DB row. */
export async function createSession(userId: string): Promise<{ token: string; session: Session }> {
  const token = generateSessionToken();
  const sessionId = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const db = await getDb();
  const [session] = await db.insert(sessions).values({ id: sessionId, userId, expiresAt }).returning();

  return { token, session };
}

/** Validates a token against the DB: unknown -> null, expired -> deletes row and returns null, within 15 days of expiry -> renews. Does not touch cookies. */
export async function validateSessionToken(token: string): Promise<{ user: User; session: Session } | null> {
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
    await db.update(sessions).set({ expiresAt: session.expiresAt }).where(eq(sessions.id, sessionId));
  }

  return { user: withResolvedAvatar(user), session };
}

/** Deletes a session row by its (hashed) id, logging it out everywhere. */
export async function invalidateSession(sessionId: string): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** Sets the `session` cookie (httpOnly, sameSite=lax, secure-in-prod), with `expires` mirroring the DB row's `expiresAt`. */
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

// Resolves the current request's authenticated user (or null), wrapped in React's `cache()` so one request hits the DB once. When AUTH_DISABLED, short-circuits to a fixed synthetic dev user.
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
    // Called from a Server Component render, where cookies can't be set — safe to ignore, it'll refresh on a later request.
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

/** Like `getCurrentUser()` but throws `UnauthorizedError` instead of returning null; for API routes — pages should prefer `getCurrentUser()` + `redirect`. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}
