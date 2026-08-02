"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RerankDialog, { type RerankGame } from "@/components/RerankDialog";
import PixelLoader from "@/components/ui/PixelLoader";
import type { Tier } from "@/db/schema";

type Mode = "idle" | "confirm-remove" | "removing" | "rerank";

export default function EntryActions({ entryId, game, tier }: { entryId: number; game: RerankGame; tier: Tier }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleConfirmRemove() {
    setRemoveError(null);
    setMode("removing");

    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setRemoveError("Couldn't remove. Try again.");
        setMode("confirm-remove");
        return;
      }

      router.refresh();
      // Leave mode as "removing" — the row disappears once the refreshed
      // server data lands, so there's no stale "idle" flash to reset to.
    } catch {
      setRemoveError("Couldn't remove. Try again.");
      setMode("confirm-remove");
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      {mode === "idle" && (
        <>
          <button type="button" onClick={() => setMode("rerank")} className="pixel-btn-ghost">
            RE-RANK
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-remove")}
            className="pixel-btn-ghost pixel-btn-ghost-danger"
          >
            DEL
          </button>
        </>
      )}

      {mode === "confirm-remove" && (
        <>
          <span className="text-[11px] tracking-[1px] text-ink-dim">SURE?</span>
          <button
            type="button"
            onClick={handleConfirmRemove}
            className="pixel-btn-ghost pixel-btn-ghost-danger border-danger/50 text-danger-ink"
          >
            YES
          </button>
          <button type="button" onClick={() => setMode("idle")} className="pixel-btn-ghost">
            NO
          </button>
          {removeError && <span className="text-[11px] text-danger-ink">{removeError}</span>}
        </>
      )}

      {mode === "removing" && <PixelLoader />}

      {mode === "rerank" && (
        <RerankDialog entryId={entryId} game={game} currentTier={tier} onCloseAction={() => setMode("idle")} />
      )}
    </div>
  );
}
