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

// Fixtures modeled on the real IGDB responses observed for "The Finals":
// `search` never surfaces the base game at all, burying it under the Final
// Fantasy catalog, while the exact-name query finds only it.
describe("mergeSearchResults", () => {
  it("promotes a substantive exact match search never found", () => {
    const searchResults = [
      game({ igdbId: 399, name: "Final Fantasy IV", totalRatingCount: 99 }),
      game({ igdbId: 398, name: "Final Fantasy XII", totalRatingCount: 329 }),
    ];
    const nameMatches = [game({ igdbId: 214417, name: "The Finals", totalRatingCount: 289 })];

    const merged = mergeSearchResults("The Finals", searchResults, nameMatches);

    expect(merged[0].igdbId).toBe(214417);
    expect(merged.slice(1).map((g) => g.igdbId)).toEqual([399, 398]);
  });

  it("is case-insensitive and trims whitespace when matching the query", () => {
    const searchResults = [game({ igdbId: 1, name: "Unrelated" })];
    const nameMatches = [game({ igdbId: 2, name: "the finals", totalRatingCount: 5 })];

    const merged = mergeSearchResults("  The Finals  ", searchResults, nameMatches);

    expect(merged[0].igdbId).toBe(2);
  });

  it("does not promote an exact match with no cover or no ratings (not substantive)", () => {
    // Regression case: IGDB has an obscure game literally titled "Zelda" with
    // no cover and no ratings. It must not outrank a real search result.
    const searchResults = [game({ igdbId: 1022, name: "The Legend of Zelda", totalRatingCount: 730 })];
    const noCover = game({ igdbId: 152362, name: "Zelda", coverImageId: null, totalRatingCount: 0 });

    const merged = mergeSearchResults("Zelda", searchResults, [noCover]);

    expect(merged[0].igdbId).toBe(1022);
    expect(merged.map((g) => g.igdbId)).toContain(152362);
    expect(merged[merged.length - 1].igdbId).toBe(152362);
  });

  it("promotes a substantive exact match that search found but buried, with no name-match input", () => {
    // Regression case: "Metroid Prime" (id 1105, rc 884) is IGDB search's 6th
    // result, behind ports/sequels with no ratings. Since the caller skips the
    // second fetch whenever search already contains a substantive exact
    // match, nameMatches is empty here — the promotion must come purely from
    // re-ranking searchResults itself.
    const searchResults = [
      game({ igdbId: 134257, name: "Metroid Prime", totalRatingCount: 0 }),
      game({ igdbId: 134258, name: "Metroid Prime 2: Echoes", totalRatingCount: 0 }),
      game({ igdbId: 37136, name: "Metroid Prime 4: Beyond", totalRatingCount: 40 }),
      game({ igdbId: 1108, name: "Metroid Prime 2: Echoes", totalRatingCount: 193 }),
      game({ igdbId: 360405, name: "Metroid Prime", coverImageId: null, totalRatingCount: 0 }),
      game({ igdbId: 1105, name: "Metroid Prime", totalRatingCount: 884 }),
    ];

    const merged = mergeSearchResults("Metroid Prime", searchResults, []);

    expect(merged[0].igdbId).toBe(1105);
    // The rest keep search's relative order, including the other exact-named
    // (but non-substantive) entries.
    expect(merged.slice(1).map((g) => g.igdbId)).toEqual([134257, 134258, 37136, 1108, 360405]);
  });

  it("preserves search's own relevance order for non-exact-match results", () => {
    const searchResults = [
      game({ igdbId: 1, name: "Warcraft III: Reign of Chaos", totalRatingCount: 1654 }),
      game({ igdbId: 2, name: "Warcraft III: The Frozen Throne", totalRatingCount: 583 }),
      game({ igdbId: 3, name: "Warcraft II: Beyond the Dark Portal", totalRatingCount: 116 }),
    ];

    const merged = mergeSearchResults("Warcraft", searchResults, []);

    expect(merged.map((g) => g.igdbId)).toEqual([1, 2, 3]);
  });

  it("dedupes an id present in both search and name-match results, keeping the search copy", () => {
    const searchResults = [game({ igdbId: 72, name: "Portal 2", totalRatingCount: 500 })];
    const nameMatches = [game({ igdbId: 72, name: "Portal 2", totalRatingCount: 500 })];

    const merged = mergeSearchResults("Portal 2", searchResults, nameMatches);

    expect(merged).toHaveLength(1);
  });

  it("sorts leftover name-match-only results by rating count when there's no search order to fall back on", () => {
    const nameMatches = [
      game({ igdbId: 1, name: "Foo: Remastered", totalRatingCount: 10 }),
      game({ igdbId: 2, name: "Foo: Deluxe Edition", totalRatingCount: 200 }),
    ];

    const merged = mergeSearchResults("unrelated query", [], nameMatches);

    expect(merged.map((g) => g.igdbId)).toEqual([2, 1]);
  });
});
