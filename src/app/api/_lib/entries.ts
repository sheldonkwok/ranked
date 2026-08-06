// Shared response serialization for the entries API surface — all entry mutation routes return the same ranked-entry list shape so the client can refresh in one round trip.
import type { RankedEntry } from "@/lib/ranking";
import { releaseYearOf } from "./handler";

export type SerializedEntry = {
  id: number;
  tier: RankedEntry["tier"];
  position: number;
  score: number;
  globalRank: number;
  game: {
    id: number;
    igdbId: number;
    name: string;
    coverImageId: string | null;
    releaseYear: number | null;
  };
};

/** Serializes an ordered list of ranked entries, assigning a 1-based `globalRank` by list order. */
export function serializeEntries(entries: RankedEntry[]): SerializedEntry[] {
  return entries.map((entry, index) => ({
    id: entry.id,
    tier: entry.tier,
    position: entry.position,
    score: entry.score,
    globalRank: index + 1,
    game: {
      id: entry.game.id,
      igdbId: entry.game.igdbId,
      name: entry.game.name,
      coverImageId: entry.game.coverImageId,
      releaseYear: releaseYearOf(entry.game.firstReleaseDate),
    },
  }));
}
