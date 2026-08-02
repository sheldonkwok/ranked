import EntryRow from "@/components/EntryRow";
import { type RankedEntry, SCORE_UNLOCK_THRESHOLD, scoresUnlocked } from "@/lib/ranking";

export default function RankedList({ entries }: { entries: RankedEntry[] }) {
  const unlocked = scoresUnlocked(entries.length);

  return (
    <>
      {!unlocked && (
        <p className="pixel-panel mb-4 px-4 py-3 text-[13px] tracking-[1px] text-ink-dim">
          RANK {SCORE_UNLOCK_THRESHOLD} GAMES TO UNLOCK SCORES — {entries.length} OF {SCORE_UNLOCK_THRESHOLD} SO FAR.
        </p>
      )}
      <ol className="pixel-panel p-1.5">
        {entries.map((entry, index) => (
          <EntryRow
            key={entry.id}
            id={entry.id}
            rank={index + 1}
            name={entry.game.name}
            coverImageId={entry.game.coverImageId}
            releaseYear={entry.game.firstReleaseDate ? entry.game.firstReleaseDate.getFullYear() : null}
            score={unlocked ? entry.score : null}
            tier={entry.tier}
          />
        ))}
      </ol>
    </>
  );
}
