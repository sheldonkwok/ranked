"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import RerankDialog, { type RerankGame } from "@/components/RerankDialog";
import type { Tier } from "@/db/schema";

type Mode = "idle" | "confirm-remove" | "removing" | "rerank";

export default function EntryActions({
  entryId,
  game,
  tier,
}: {
  entryId: number;
  game: RerankGame;
  tier: Tier;
}) {
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
    <div className="flex shrink-0 items-center gap-2 text-xs">
      {mode === "idle" && (
        <>
          <button
            type="button"
            onClick={() => setMode("rerank")}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            Re-rank
          </button>
          <button
            type="button"
            onClick={() => setMode("confirm-remove")}
            className="text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
          >
            Remove
          </button>
        </>
      )}

      {mode === "confirm-remove" && (
        <>
          <span className="text-zinc-500">Remove?</span>
          <button
            type="button"
            onClick={handleConfirmRemove}
            className="font-medium text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setMode("idle")}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            No
          </button>
          {removeError && (
            <span className="text-red-600 dark:text-red-400">
              {removeError}
            </span>
          )}
        </>
      )}

      {mode === "removing" && <span className="text-zinc-400">Removing…</span>}

      {mode === "rerank" && (
        <RerankDialog
          entryId={entryId}
          game={game}
          currentTier={tier}
          onCloseAction={() => setMode("idle")}
        />
      )}
    </div>
  );
}
