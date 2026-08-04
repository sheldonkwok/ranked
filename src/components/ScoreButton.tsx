"use client";

import { useState } from "react";
import EntryDialog, { type EntryDialogGame } from "@/components/EntryDialog";
import { scoreChipClass, scoreChipLabel } from "@/components/ScoreChip";
import type { Tier } from "@/db/schema";

// The score chip doubles as the row's edit trigger — clicking it opens the
// re-rank/remove dialog. Locked scores (below SCORE_UNLOCK_THRESHOLD) still
// render a dim placeholder chip rather than nothing, so entries stay
// editable before scores unlock.
export default function ScoreButton({
  entryId,
  game,
  tier,
  score,
}: {
  entryId: number;
  game: EntryDialogGame;
  tier: Tier;
  score: number | null;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${game.name}`}
        className={`score-chip ${scoreChipClass(tier, score)}`}
      >
        <span className="score-chip-face">{scoreChipLabel(score)}</span>
      </button>

      {open && <EntryDialog entryId={entryId} game={game} currentTier={tier} onCloseAction={() => setOpen(false)} />}
    </>
  );
}
