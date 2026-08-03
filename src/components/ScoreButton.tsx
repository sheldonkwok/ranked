"use client";

import { useState } from "react";
import EntryDialog, { type EntryDialogGame } from "@/components/EntryDialog";
import type { Tier } from "@/db/schema";

// Tints the chip itself, since it's the only per-row tier signal in the
// pixel design (there's no colored pill background anymore).
const TIER_CHIPS: Record<Tier, string> = {
  liked: "", // base .score-chip is already the liked green
  fine: "score-chip-fine",
  disliked: "score-chip-disliked",
};

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
  const locked = score === null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Edit ${game.name}`}
        className={`score-chip ${locked ? "score-chip-locked" : TIER_CHIPS[tier]}`}
      >
        <span className="score-chip-face">{locked ? "——" : score.toFixed(1)}</span>
      </button>

      {open && <EntryDialog entryId={entryId} game={game} currentTier={tier} onCloseAction={() => setOpen(false)} />}
    </>
  );
}
