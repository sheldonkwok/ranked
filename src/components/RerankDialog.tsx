"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TierPicker from "@/components/TierPicker";
import ComparisonModal from "@/components/ComparisonModal";
import {
  useComparisonRanking,
  type ComparisonCandidate,
} from "@/hooks/useComparisonRanking";
import type { Tier } from "@/db/schema";

type Phase =
  | "tier"
  | "loading-candidates"
  | "comparing"
  | "submitting"
  | "failed";

type FailureKind = "not_found" | "generic";

const TIER_LABEL: Record<Tier, string> = {
  liked: "Liked it",
  fine: "It was fine",
  disliked: "Didn't like it",
};

export type RerankGame = {
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
};

export default function RerankDialog({
  entryId,
  game,
  currentTier,
  onCloseAction,
}: {
  entryId: number;
  game: RerankGame;
  currentTier: Tier;
  onCloseAction: () => void;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("tier");
  const [tier, setTier] = useState<Tier | null>(null);
  const [candidates, setCandidates] = useState<ComparisonCandidate[] | null>(
    null
  );
  const [tierError, setTierError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailureKind | null>(null);

  const comparison = useComparisonRanking(candidates);

  // Guards against re-submitting on every re-render once we've already
  // kicked off a submit for the current comparison round (mirrors
  // AddFlow's pattern for the same auto-submit effect below).
  const submittedForRef = useRef<ComparisonCandidate[] | null>(null);

  function backToTier() {
    setTier(null);
    setCandidates(null);
    setTierError(null);
    setFailure(null);
    submittedForRef.current = null;
    setPhase("tier");
  }

  async function handlePickTier(pickedTier: Tier) {
    setTier(pickedTier);
    setTierError(null);
    setPhase("loading-candidates");

    try {
      const res = await fetch(
        `/api/entries?tier=${encodeURIComponent(pickedTier)}&exclude=${entryId}`
      );

      if (!res.ok) {
        setTierError(
          "Something went wrong loading your existing games. Try again."
        );
        setPhase("tier");
        return;
      }

      const data = (await res.json()) as { entries: ComparisonCandidate[] };
      setCandidates(data.entries);
      setPhase("comparing");
    } catch {
      setTierError(
        "Something went wrong loading your existing games. Try again."
      );
      setPhase("tier");
    }
  }

  async function submit(position: number) {
    if (!tier) return;

    setFailure(null);
    setPhase("submitting");

    try {
      const res = await fetch(`/api/entries/${entryId}/rerank`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, position }),
      });

      if (res.ok) {
        router.refresh();
        onCloseAction();
        return;
      }

      if (res.status === 404) {
        setFailure("not_found");
        setPhase("failed");
        return;
      }

      setFailure("generic");
      setPhase("failed");
    } catch {
      setFailure("generic");
      setPhase("failed");
    }
  }

  // Auto-submit once the comparison loop lands on a final position
  // (including the empty-tier case, where the hook completes immediately
  // with zero comparisons).
  // biome-ignore lint/correctness/useExhaustiveDependencies: submit reads the deps already listed; adding it (redefined every render) would re-fire this effect on every render
  useEffect(() => {
    if (
      phase === "comparing" &&
      comparison.status === "done" &&
      comparison.finalPosition !== null &&
      submittedForRef.current !== candidates
    ) {
      submittedForRef.current = candidates;
      submit(comparison.finalPosition);
    }
  }, [phase, comparison.status, comparison.finalPosition, candidates]);

  function handleSkip() {
    // Skipping a too-close comparison counts as the re-ranked game LOSING
    // that comparison, same rationale as AddFlow.
    comparison.choose(false);
  }

  // During the comparing phase, ComparisonModal already renders its own
  // full-viewport overlay, so we render it standalone (no double overlay)
  // and rely on the persistent close button below for cancel.
  const showComparisonModal =
    phase === "comparing" && comparison.currentCandidate !== null;

  return (
    <>
      <button
        type="button"
        onClick={onCloseAction}
        disabled={phase === "submitting"}
        aria-label="Cancel re-rank"
        title={
          phase === "submitting" ? "Saving…" : "Cancel re-rank"
        }
        className="fixed top-4 right-4 z-[60] rounded-full bg-white px-2.5 py-1 text-sm font-medium text-zinc-500 shadow-md hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ✕
      </button>

      {showComparisonModal && comparison.currentCandidate ? (
        <ComparisonModal
          newGame={game}
          candidate={comparison.currentCandidate.game}
          onChooseAction={comparison.choose}
          onSkipAction={handleSkip}
          comparisonsDone={comparison.comparisonsDone}
          maxComparisons={comparison.maxComparisons}
        />
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
            <div className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold">Re-rank {game.name}</h2>
              <p className="text-xs text-zinc-500">
                Currently: {TIER_LABEL[currentTier]}
              </p>
            </div>

            {phase === "tier" && (
              <div className="flex flex-col gap-4">
                {tierError && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    {tierError}
                  </p>
                )}
                <TierPicker onPick={handlePickTier} />
              </div>
            )}

            {phase === "loading-candidates" && (
              <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300"
                />
                Loading your {tier ? TIER_LABEL[tier].toLowerCase() : ""}{" "}
                games…
              </div>
            )}

            {(phase === "submitting" ||
              (phase === "comparing" && !comparison.currentCandidate)) && (
              <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
                <span
                  aria-hidden
                  className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300"
                />
                Saving…
              </div>
            )}

            {phase === "failed" && (
              <div className="flex flex-col gap-4">
                {failure === "not_found" && (
                  <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    This entry no longer exists — it may have been removed.
                  </p>
                )}

                {failure === "generic" && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
                    Something went wrong saving this re-rank. Try again.
                  </p>
                )}

                <div className="flex gap-3">
                  {failure === "generic" &&
                    comparison.finalPosition !== null && (
                      <button
                        type="button"
                        onClick={() =>
                          submit(comparison.finalPosition as number)
                        }
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        Try again
                      </button>
                    )}
                  {failure === "not_found" ? (
                    <button
                      type="button"
                      onClick={() => {
                        router.refresh();
                        onCloseAction();
                      }}
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      Close
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={backToTier}
                      className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                    >
                      ← Back
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
