"use client";

import { useState } from "react";
import EntryDialog, { type EntryDialogGame } from "@/components/EntryDialog";
import { scoreChip, scoreChipFace, scoreChipLabel, scoreChipPalette } from "@/components/ScoreChip";
import type { Tier } from "@/db/schema";

// The score chip doubles as the row's edit trigger; locked scores (below SCORE_UNLOCK_THRESHOLD) still render a dim placeholder chip rather than nothing so entries stay editable.
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
        className={scoreChip(scoreChipPalette(tier, score))}
      >
        <span className={scoreChipFace({})}>{scoreChipLabel(score)}</span>
      </button>

      {open && <EntryDialog entryId={entryId} game={game} currentTier={tier} onCloseAction={() => setOpen(false)} />}
    </>
  );
}
