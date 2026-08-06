import { sql } from "drizzle-orm";
import { cache } from "react";
import { type Db, type User, users } from "@/db";
import { withResolvedAvatar } from "@/lib/avatar";

/** Looks up a user by `users.username` (Twitch login or `steam-<SteamID64>`) for the /u/[username] route, case-insensitively rather than assuming `users_username_lower_unique` still exists. */
export const getUserByUsername = cache(async (db: Db, username: string): Promise<User | null> => {
  const rows = await db.select().from(users).where(sql`lower(${users.username}) = ${username.toLowerCase()}`).limit(1);

  return rows[0] ? withResolvedAvatar(rows[0]) : null;
});
