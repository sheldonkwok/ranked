// Pure helper for resolving which avatar a user should be shown with.
// No env access here — importable from both server and client components.

import type { User } from "@/db";

/**
 * Twitch serves a generic placeholder from this path for accounts that never
 * uploaded a profile picture, e.g.
 * https://static-cdn.jtvnw.net/user-default-pictures-uv/<uuid>-300x300.png
 */
const TWITCH_DEFAULT_AVATAR_MARKER = "user-default-pictures";

export function isDefaultTwitchAvatar(url: string | null): boolean {
  return url?.includes(TWITCH_DEFAULT_AVATAR_MARKER) ?? false;
}

/**
 * Overrides `avatarUrl` with the linked Steam avatar when the Twitch one is
 * missing or is Twitch's default placeholder. Applied to every user row as it
 * is loaded (see src/lib/session.ts, src/lib/users.ts) so that consumers can
 * render `user.avatarUrl` without knowing about the fallback.
 *
 * The result is display-only — never write a resolved row back to the DB, or
 * the Steam URL would be persisted into `users.avatar_url`.
 */
export function withResolvedAvatar(user: User): User {
  if (user.avatarUrl && !isDefaultTwitchAvatar(user.avatarUrl)) return user;
  return { ...user, avatarUrl: user.steamAvatarUrl ?? user.avatarUrl };
}
