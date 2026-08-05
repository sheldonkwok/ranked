import { sql } from "drizzle-orm";
import { cache } from "react";
import { type Db, type User, users } from "@/db";
import { withResolvedAvatar } from "@/lib/avatar";

/**
 * Looks up a user by their Twitch login (stored as `users.username`, see
 * the callback in src/app/api/auth/twitch/callback/route.ts). Used to
 * resolve the /u/[username] public profile route.
 *
 * `username` has no unique index (only `twitchId` does — src/db/schema.ts),
 * so this compares case-insensitively and takes the first match rather than
 * assuming exactly one row exists.
 */
export const getUserByUsername = cache(async (db: Db, username: string): Promise<User | null> => {
  const rows = await db.select().from(users).where(sql`lower(${users.username}) = ${username.toLowerCase()}`).limit(1);

  return rows[0] ? withResolvedAvatar(rows[0]) : null;
});
