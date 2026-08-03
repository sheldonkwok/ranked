"use client";

import { useState } from "react";
import EntryDialog, { type EntryDialogGame } from "@/components/EntryDialog";
import type { Tier } from "@/db/schema";

export default function EntryActions({ entryId, game, tier }: { entryId: number; game: EntryDialogGame; tier: Tier }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={() => setOpen(true)} className="pixel-btn-ghost">
        EDIT
      </button>

      {open && <EntryDialog entryId={entryId} game={game} currentTier={tier} onCloseAction={() => setOpen(false)} />}
    </div>
  );
}
