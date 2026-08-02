"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ComparisonModal from "@/components/ComparisonModal";
import TierPicker from "@/components/TierPicker";
import Banner from "@/components/ui/Banner";
import ModalShell from "@/components/ui/ModalShell";
import PixelLoader from "@/components/ui/PixelLoader";
import type { Tier } from "@/db/schema";
import { type ComparisonCandidate, useComparisonRanking } from "@/hooks/useComparisonRanking";
import { TIER_LABEL } from "@/lib/tiers";

type Phase = "tier" | "loading-candidates" | "comparing" | "submitting" | "failed";

type FailureKind = "not_found" | "generic";

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
  const [candidates, setCandidates] = useState<ComparisonCandidate[] | null>(null);
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
      const res = await fetch(`/api/entries?tier=${encodeURIComponent(pickedTier)}&exclude=${entryId}`);

      if (!res.ok) {
        setTierError("Something went wrong loading your existing games. Try again.");
        setPhase("tier");
        return;
      }

      const data = (await res.json()) as { entries: ComparisonCandidate[] };
      setCandidates(data.entries);
      setPhase("comparing");
    } catch {
      setTierError("Something went wrong loading your existing games. Try again.");
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

  // During the comparing phase, ComparisonModal renders its own shell, so we
  // pass our cancel handler straight through to it (with the same
  // submitting-disabled rule) instead of rendering a second modal.
  const showComparisonModal = phase === "comparing" && comparison.currentCandidate !== null;

  if (showComparisonModal && comparison.currentCandidate) {
    return (
      <ComparisonModal
        newGame={game}
        candidate={comparison.currentCandidate.game}
        onChooseAction={comparison.choose}
        onSkipAction={handleSkip}
        comparisonsDone={comparison.comparisonsDone}
        maxComparisons={comparison.maxComparisons}
        onCloseAction={onCloseAction}
      />
    );
  }

  return (
    <ModalShell onCloseAction={onCloseAction} closeDisabled={phase === "submitting"}>
      <div className="flex flex-col gap-1">
        <h2 className="pixel-heading text-[13px]">RE-RANK {game.name.toUpperCase()}</h2>
        <p className="text-xs tracking-[1px] text-ink-dim">CURRENTLY: {TIER_LABEL[currentTier].toUpperCase()}</p>
      </div>

      {phase === "tier" && (
        <div className="flex flex-col gap-4">
          {tierError && <Banner variant="error">{tierError}</Banner>}
          <TierPicker onPick={handlePickTier} />
        </div>
      )}

      {phase === "loading-candidates" && (
        <PixelLoader className="py-4" label={`Loading your ${tier ? TIER_LABEL[tier].toLowerCase() : ""} games…`} />
      )}

      {(phase === "submitting" || (phase === "comparing" && !comparison.currentCandidate)) && (
        <PixelLoader className="py-4" label="Saving…" />
      )}

      {phase === "failed" && (
        <div className="flex flex-col gap-4">
          {failure === "not_found" && (
            <Banner variant="warn">This entry no longer exists — it may have been removed.</Banner>
          )}

          {failure === "generic" && (
            <Banner variant="error">Something went wrong saving this re-rank. Try again.</Banner>
          )}

          <div className="flex items-center gap-4">
            {failure === "generic" && comparison.finalPosition !== null && (
              <button
                type="button"
                onClick={() => submit(comparison.finalPosition as number)}
                className="pixel-btn-ghost"
              >
                TRY AGAIN
              </button>
            )}
            {failure === "not_found" ? (
              <button
                type="button"
                onClick={() => {
                  router.refresh();
                  onCloseAction();
                }}
                className="pixel-btn-ghost"
              >
                CLOSE
              </button>
            ) : (
              <button type="button" onClick={backToTier} className="pixel-btn-ghost">
                ← BACK
              </button>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
