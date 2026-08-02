import EntryRow from "@/components/EntryRow";
import { type RankedEntry, SCORE_UNLOCK_THRESHOLD, scoresUnlocked } from "@/lib/ranking";

export default function RankedList({ entries }: { entries: RankedEntry[] }) {
  const unlocked = scoresUnlocked(entries.length);

  return (
    <>
      {!unlocked && (
        <p className="border-b border-zinc-200 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Rank {SCORE_UNLOCK_THRESHOLD} games to unlock scores — {entries.length} of {SCORE_UNLOCK_THRESHOLD} so far.
        </p>
      )}
      <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
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
