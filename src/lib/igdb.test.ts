import { describe, expect, it } from "vitest";
import {
  type IgdbGame,
  looseKey,
  mergeSearchResults,
  normalizeSteamName,
  pickBestMatch,
  stripEditionSuffix,
} from "./igdb";

function game(overrides: Partial<IgdbGame> & { igdbId: number; name: string }): IgdbGame {
  return {
    coverImageId: "cover",
    firstReleaseDate: null,
    platforms: [],
    summary: null,
    totalRatingCount: 0,
    ...overrides,
  };
}

// Fixtures modeled on real IGDB responses for a single wildcard `where` query (see searchGames): exact-title matches can land anywhere or lack a cover/rating, and must be re-ranked accordingly.
describe("mergeSearchResults", () => {
  it("promotes a substantive exact match to the top", () => {
    const results = [
      game({ igdbId: 399, name: "Final Fantasy IV", totalRatingCount: 99 }),
      game({ igdbId: 398, name: "Final Fantasy XII", totalRatingCount: 329 }),
      game({ igdbId: 214417, name: "The Finals", totalRatingCount: 289 }),
    ];

    const merged = mergeSearchResults("The Finals", results);

    expect(merged[0].igdbId).toBe(214417);
    expect(merged.slice(1).map((g) => g.igdbId)).toEqual([399, 398]);
  });

  it("is case-insensitive and trims whitespace when matching the query", () => {
    const results = [
      game({ igdbId: 1, name: "Unrelated" }),
      game({ igdbId: 2, name: "the finals", totalRatingCount: 5 }),
    ];

    const merged = mergeSearchResults("  The Finals  ", results);

    expect(merged[0].igdbId).toBe(2);
  });

  it("does not promote an exact match with no cover or no ratings (not substantive)", () => {
    // Regression: IGDB has an obscure game literally titled "Zelda" with no cover/ratings — it must not outrank a real result.
    const results = [
      game({ igdbId: 1022, name: "The Legend of Zelda", totalRatingCount: 730 }),
      game({ igdbId: 152362, name: "Zelda", coverImageId: null, totalRatingCount: 0 }),
    ];

    const merged = mergeSearchResults("Zelda", results);

    expect(merged[0].igdbId).toBe(1022);
    expect(merged.map((g) => g.igdbId)).toContain(152362);
    expect(merged[merged.length - 1].igdbId).toBe(152362);
  });

  it("promotes a substantive exact match that's buried in the API's result order", () => {
    // Regression: "Metroid Prime" (id 1105, rc 884) comes back 6th, behind ports/sequels with no ratings.
    const results = [
      game({ igdbId: 134257, name: "Metroid Prime", totalRatingCount: 0 }),
      game({ igdbId: 134258, name: "Metroid Prime 2: Echoes", totalRatingCount: 0 }),
      game({ igdbId: 37136, name: "Metroid Prime 4: Beyond", totalRatingCount: 40 }),
      game({ igdbId: 1108, name: "Metroid Prime 2: Echoes", totalRatingCount: 193 }),
      game({ igdbId: 360405, name: "Metroid Prime", coverImageId: null, totalRatingCount: 0 }),
      game({ igdbId: 1105, name: "Metroid Prime", totalRatingCount: 884 }),
    ];

    const merged = mergeSearchResults("Metroid Prime", results);

    expect(merged[0].igdbId).toBe(1105);
    // The rest keep the API's relative order, including the other exact-named (but non-substantive) entries.
    expect(merged.slice(1).map((g) => g.igdbId)).toEqual([134257, 134258, 37136, 1108, 360405]);
  });

  it("ranks multiple substantive exact matches by rating count", () => {
    const results = [
      game({ igdbId: 1, name: "Foo", totalRatingCount: 10 }),
      game({ igdbId: 2, name: "Foo", totalRatingCount: 200 }),
    ];

    const merged = mergeSearchResults("Foo", results);

    expect(merged.map((g) => g.igdbId)).toEqual([2, 1]);
  });

  it("preserves the API's own result order for non-exact-match results", () => {
    const results = [
      game({ igdbId: 1, name: "Warcraft III: Reign of Chaos", totalRatingCount: 1654 }),
      game({ igdbId: 2, name: "Warcraft III: The Frozen Throne", totalRatingCount: 583 }),
      game({ igdbId: 3, name: "Warcraft II: Beyond the Dark Portal", totalRatingCount: 116 }),
    ];

    const merged = mergeSearchResults("Warcraft", results);

    expect(merged.map((g) => g.igdbId)).toEqual([1, 2, 3]);
  });

  it("returns an empty list unchanged", () => {
    expect(mergeSearchResults("anything", [])).toEqual([]);
  });
});

// Derived from live IGDB responses captured building the /add Steam library import, locking in two failure modes: trademark symbols/case defeating an exact match, and an unverified wildcard match confidently picking the wrong sibling game.
describe("normalizeSteamName", () => {
  it("strips trademark/copyright/registered symbols", () => {
    expect(normalizeSteamName("Sid Meier's Civilization® VI")).toBe("Sid Meier's Civilization VI");
    expect(normalizeSteamName("Call of Duty®: Modern Warfare® II")).toBe("Call of Duty: Modern Warfare II");
    expect(normalizeSteamName("Sekiro™: Shadows Die Twice")).toBe("Sekiro: Shadows Die Twice");
  });

  it("collapses whitespace left behind by stripped symbols", () => {
    expect(normalizeSteamName("Foo®  Bar")).toBe("Foo Bar");
  });
});

describe("stripEditionSuffix", () => {
  it("strips common store-page edition suffixes", () => {
    expect(stripEditionSuffix("Sekiro: Shadows Die Twice - GOTY Edition")).toBe("Sekiro: Shadows Die Twice");
    expect(stripEditionSuffix("Fallout 3: Game of the Year Edition")).toBe("Fallout 3");
    expect(stripEditionSuffix("Hitman 3 - Deluxe Edition")).toBe("Hitman 3");
    expect(stripEditionSuffix("Dying Light Enhanced Edition")).toBe("Dying Light");
  });

  it("leaves titles alone that are distinct IGDB entries, not edition wrappers", () => {
    expect(stripEditionSuffix("Dark Souls: Remastered")).toBe("Dark Souls: Remastered");
    expect(stripEditionSuffix("Deus Ex: Human Revolution - Director's Cut")).toBe(
      "Deus Ex: Human Revolution - Director's Cut"
    );
  });
});

describe("looseKey", () => {
  it("makes punctuation/spacing-only differences compare equal", () => {
    expect(looseKey("NieR: Automata")).toBe(looseKey("NieR:Automata"));
    expect(looseKey("The Elder Scrolls V: Skyrim - Special Edition")).toBe(
      looseKey("The Elder Scrolls V: Skyrim Special Edition")
    );
  });

  it("still distinguishes different titles", () => {
    expect(looseKey("Civilization V")).not.toBe(looseKey("Civilization VI"));
  });
});

describe("pickBestMatch", () => {
  it("rejects a same-franchise sibling even when it's the top-ranked candidate", () => {
    // Regression: wildcard search for "Civilization VI" ranks "Civilization V" first by rating count; a loose-key mismatch must reject it rather than blindly accepting the top result.
    const candidates = [
      game({ igdbId: 1, name: "Sid Meier's Civilization V", totalRatingCount: 900 }),
      game({ igdbId: 2, name: "Sid Meier's Civilization VI", totalRatingCount: 643 }),
    ];
    expect(pickBestMatch("Sid Meier's Civilization® VI", candidates)?.igdbId).toBe(2);
  });

  it("rejects Modern Warfare III for a Modern Warfare II query", () => {
    const candidates = [
      game({ igdbId: 1, name: "Call of Duty: Modern Warfare III", totalRatingCount: 500 }),
      game({ igdbId: 2, name: "Call of Duty: Modern Warfare II", totalRatingCount: 300 }),
    ];
    expect(pickBestMatch("Call of Duty®: Modern Warfare® II", candidates)?.igdbId).toBe(2);
  });

  it("returns null rather than guessing when no candidate loosely matches", () => {
    // Regression: wildcard search for "F.E.A.R. 3" surfaced only unrelated "3"-suffixed games — a miss must stay a miss, not silently become a wrong pick.
    const candidates = [
      game({ igdbId: 1, name: "Call of Duty: Modern Warfare 3", totalRatingCount: 500 }),
      game({ igdbId: 2, name: "Gears of War 3", totalRatingCount: 200 }),
    ];
    expect(pickBestMatch("F.E.A.R. 3", candidates)).toBeNull();
  });

  it("matches through an edition suffix", () => {
    const candidates = [game({ igdbId: 1, name: "Fallout 3", totalRatingCount: 400 })];
    expect(pickBestMatch("Fallout 3: Game of the Year Edition", candidates)?.igdbId).toBe(1);
  });
});
