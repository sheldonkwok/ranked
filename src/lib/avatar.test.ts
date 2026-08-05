import { describe, expect, it } from "vitest";
import type { User } from "@/db";
import { isDefaultTwitchAvatar, withResolvedAvatar } from "./avatar";

const TWITCH_AVATAR = "https://static-cdn.jtvnw.net/jtv_user_pictures/abc123-profile_image-300x300.png";
const TWITCH_DEFAULT_AVATAR =
  "https://static-cdn.jtvnw.net/user-default-pictures-uv/ead5c8b2-3f6e-4cb3-b8f0-6d5c3e6a5c9b-300x300.png";
const STEAM_AVATAR = "https://avatars.steamstatic.com/abcdef1234567890abcdef1234567890abcdef12_full.jpg";

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    twitchId: "twitch-1",
    username: "someuser",
    displayName: "Some User",
    avatarUrl: TWITCH_AVATAR,
    steamId: "steam-1",
    steamPersonaName: "SomeSteamUser",
    steamAvatarUrl: STEAM_AVATAR,
    steamLinkedAt: new Date("2024-01-01T00:00:00.000Z"),
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("isDefaultTwitchAvatar", () => {
  it("recognizes Twitch's default placeholder URL", () => {
    expect(isDefaultTwitchAvatar(TWITCH_DEFAULT_AVATAR)).toBe(true);
  });

  it("does not flag a real uploaded avatar", () => {
    expect(isDefaultTwitchAvatar(TWITCH_AVATAR)).toBe(false);
  });

  it("treats null as not-default", () => {
    expect(isDefaultTwitchAvatar(null)).toBe(false);
  });
});

describe("withResolvedAvatar", () => {
  it("keeps a real Twitch avatar even when Steam is linked", () => {
    const user = makeUser({ avatarUrl: TWITCH_AVATAR, steamAvatarUrl: STEAM_AVATAR });

    expect(withResolvedAvatar(user).avatarUrl).toBe(TWITCH_AVATAR);
  });

  it("falls back to the Steam avatar when Twitch's avatar is the default placeholder", () => {
    const user = makeUser({ avatarUrl: TWITCH_DEFAULT_AVATAR, steamAvatarUrl: STEAM_AVATAR });

    expect(withResolvedAvatar(user).avatarUrl).toBe(STEAM_AVATAR);
  });

  it("keeps the default Twitch avatar when no Steam avatar is available", () => {
    const user = makeUser({ avatarUrl: TWITCH_DEFAULT_AVATAR, steamAvatarUrl: null });

    expect(withResolvedAvatar(user).avatarUrl).toBe(TWITCH_DEFAULT_AVATAR);
  });

  it("falls back to the Steam avatar when there is no Twitch avatar at all", () => {
    const user = makeUser({ avatarUrl: null, steamAvatarUrl: STEAM_AVATAR });

    expect(withResolvedAvatar(user).avatarUrl).toBe(STEAM_AVATAR);
  });

  it("stays null when neither avatar is available", () => {
    const user = makeUser({ avatarUrl: null, steamAvatarUrl: null });

    expect(withResolvedAvatar(user).avatarUrl).toBeNull();
  });

  it("leaves the rest of the user row untouched", () => {
    const user = makeUser({ avatarUrl: TWITCH_DEFAULT_AVATAR, steamAvatarUrl: STEAM_AVATAR });

    const resolved = withResolvedAvatar(user);

    expect(resolved.id).toBe(user.id);
    expect(resolved.username).toBe(user.username);
    expect(resolved.steamAvatarUrl).toBe(user.steamAvatarUrl);
  });
});
