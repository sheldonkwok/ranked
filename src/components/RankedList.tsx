import EntryRow from "@/components/EntryRow";
import { panel } from "@/components/ui/surface";
import { type RankedEntry, SCORE_UNLOCK_THRESHOLD, scoresUnlocked } from "@/lib/ranking";

export default function RankedList({ entries, readOnly = false }: { entries: RankedEntry[]; readOnly?: boolean }) {
  const unlocked = scoresUnlocked(entries.length);

  return (
    <>
      {!unlocked && (
        <p className={panel({ className: "mb-4 px-4 py-3 text-[13px] tracking-[1px] text-ink-dim" })}>
          {readOnly
            ? `SCORES UNLOCK AT ${SCORE_UNLOCK_THRESHOLD} RANKED GAMES — ${entries.length} SO FAR.`
            : `RANK ${SCORE_UNLOCK_THRESHOLD} GAMES TO UNLOCK SCORES — ${entries.length} OF ${SCORE_UNLOCK_THRESHOLD} SO FAR.`}
        </p>
      )}
      <ol className={panel({ className: "p-1.5" })}>
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
            readOnly={readOnly}
          />
        ))}
      </ol>
      {/* Mobile-only: on a phone the header isn't always in view, so the
          list needs its own explicit end marker rather than relying on
          "no more rows" being obvious. */}
      <p className="scrim-shadow mt-3.5 hidden text-center text-[15px] tracking-[1px] text-ink-faint mobile:block">
        END OF LIST — RANK ANOTHER GAME TO ADD
      </p>
    </>
  );
}
