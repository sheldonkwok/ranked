// Pure helper for resolving which avatar a user should be shown with — no env access, importable from server and client.

import type { User } from "@/db";

// Twitch serves a generic placeholder from this path for accounts with no uploaded profile picture.
const TWITCH_DEFAULT_AVATAR_MARKER = "user-default-pictures";

export function isDefaultTwitchAvatar(url: string | null): boolean {
  return url?.includes(TWITCH_DEFAULT_AVATAR_MARKER) ?? false;
}

/** Overrides `avatarUrl` with the linked Steam avatar when the Twitch one is missing/default. Display-only — never write the result back to the DB. */
export function withResolvedAvatar(user: User): User {
  if (user.avatarUrl && !isDefaultTwitchAvatar(user.avatarUrl)) return user;
  return { ...user, avatarUrl: user.steamAvatarUrl ?? user.avatarUrl };
}
