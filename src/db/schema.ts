import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const tierEnum = pgEnum("tier", ["liked", "fine", "disliked"]);

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  twitchId: text("twitch_id").notNull().unique(),
  username: text("username").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  // SteamID64, verified via Steam OpenID sign-in. Nullable — not every user
  // links Steam. Unique so two Ranked accounts can't claim the same Steam
  // account.
  steamId: text("steam_id").unique(),
  steamPersonaName: text("steam_persona_name"),
  steamAvatarUrl: text("steam_avatar_url"),
  steamLinkedAt: timestamp("steam_linked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  // sha256 hex digest of the session token, computed app-side
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
});

export const games = pgTable(
  "games",
  {
    id: serial("id").primaryKey(),
    igdbId: integer("igdb_id").notNull().unique(),
    name: text("name").notNull(),
    coverImageId: text("cover_image_id"),
    firstReleaseDate: timestamp("first_release_date"),
    platforms: jsonb("platforms").$type<string[]>(),
    summary: text("summary"),
    // The Steam appid this row was resolved from, cached so the /add Steam
    // library list can skip the IGDB round trip next time. Nullable — games
    // added via search have never been joined against Steam. Deliberately NOT
    // unique: a base game and its edition are distinct appids that can resolve
    // to the same IGDB game, and a unique constraint would turn that into a
    // 500 on upsert.
    steamAppId: integer("steam_app_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("games_steam_app_id_idx").on(table.steamAppId)]
);

// Negative cache of Steam appids that don't resolve to any IGDB game (tools,
// SDKs, dedicated servers, soundtracks, etc.) — without this, an unresolvable
// app sitting high in a user's playtime would cost an IGDB round trip on
// every single /add Steam library request, forever. `checkedAt` drives a TTL
// (see STEAM_MISS_TTL_MS in the steam-library route) so an app IGDB adds
// later eventually gets retried instead of being cached as a miss forever.
export const steamAppMisses = pgTable("steam_app_misses", {
  steamAppId: integer("steam_app_id").primaryKey(),
  checkedAt: timestamp("checked_at").notNull().defaultNow(),
});

export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: integer("game_id")
      .notNull()
      .references(() => games.id),
    tier: tierEnum("tier").notNull(),
    // 0-based dense rank per (user_id, tier); 0 = best
    position: integer("position").notNull(),
    // derived 0-10 score, stored
    score: numeric("score", { precision: 3, scale: 1 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("entries_user_game_unique").on(table.userId, table.gameId),
    index("entries_user_tier_position_idx").on(table.userId, table.tier, table.position),
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  entries: many(entries),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const gamesRelations = relations(games, ({ many }) => ({
  entries: many(entries),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  user: one(users, {
    fields: [entries.userId],
    references: [users.id],
  }),
  game: one(games, {
    fields: [entries.gameId],
    references: [games.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;

export type SteamAppMiss = typeof steamAppMisses.$inferSelect;
export type NewSteamAppMiss = typeof steamAppMisses.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export type Tier = "liked" | "fine" | "disliked";
