import { describe, expect, it } from "vitest";
import { type IgdbGame, mergeSearchResults } from "./igdb";

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

// Fixtures modeled on real IGDB responses for a single wildcard `where` query
// (see searchGames): exact-title matches can land anywhere in the result set,
// or not have a cover/rating at all, and must be re-ranked accordingly.
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
    // Regression case: IGDB has an obscure game literally titled "Zelda" with
    // no cover and no ratings. It must not outrank a real search result.
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
    // Regression case: "Metroid Prime" (id 1105, rc 884) comes back 6th,
    // behind ports/sequels with no ratings.
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
    // The rest keep the API's relative order, including the other exact-named
    // (but non-substantive) entries.
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
