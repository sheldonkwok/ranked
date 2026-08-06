import { sql } from "drizzle-orm";
import { cache } from "react";
import { type Db, type User, users } from "@/db";
import { withResolvedAvatar } from "@/lib/avatar";

/**
 * Looks up a user by `users.username` — either their Twitch login, or
 * `steam-<SteamID64>` for a Steam-only account (see the callbacks in
 * src/app/api/auth/{twitch,steam}/callback/route.ts). Used to resolve the
 * /u/[username] public profile route.
 *
 * `users_username_lower_unique` (src/db/schema.ts) guarantees at most one
 * match, but this still compares case-insensitively and takes the first row
 * rather than assuming the index exists — cheap insurance against a future
 * migration that drops it.
 */
export const getUserByUsername = cache(async (db: Db, username: string): Promise<User | null> => {
  const rows = await db.select().from(users).where(sql`lower(${users.username}) = ${username.toLowerCase()}`).limit(1);

  return rows[0] ? withResolvedAvatar(rows[0]) : null;
});
