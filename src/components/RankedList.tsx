import EntryRow from "@/components/EntryRow";
import type { RankedEntry } from "@/lib/ranking";

export default function RankedList({ entries }: { entries: RankedEntry[] }) {
  return (
    <ol className="divide-y divide-zinc-200 dark:divide-zinc-800">
      {entries.map((entry, index) => (
        <EntryRow
          key={entry.id}
          id={entry.id}
          rank={index + 1}
          name={entry.game.name}
          coverImageId={entry.game.coverImageId}
          releaseYear={
            entry.game.firstReleaseDate
              ? entry.game.firstReleaseDate.getFullYear()
              : null
          }
          score={entry.score}
          tier={entry.tier}
        />
      ))}
    </ol>
  );
}
