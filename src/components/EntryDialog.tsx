"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ComparisonModal from "@/components/ComparisonModal";
import TierPicker from "@/components/TierPicker";
import Banner from "@/components/ui/Banner";
import { button } from "@/components/ui/button";
import ModalShell from "@/components/ui/ModalShell";
import PixelLoader from "@/components/ui/PixelLoader";
import { heading } from "@/components/ui/surface";
import type { Tier } from "@/db/schema";
import { type ComparisonCandidate, useComparisonRanking } from "@/hooks/useComparisonRanking";
import { TIER_LABEL } from "@/lib/tiers";

type Phase = "tier" | "loading-candidates" | "comparing" | "submitting" | "confirm-remove" | "removing" | "failed";
type FailureKind = "not_found" | "generic";

export type EntryDialogGame = {
  name: string;
  coverImageId: string | null;
  releaseYear: number | null;
};

export default function EntryDialog({
  entryId,
  game,
  currentTier,
  onCloseAction,
}: {
  entryId: number;
  game: EntryDialogGame;
  currentTier: Tier;
  onCloseAction: () => void;
}) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("tier");
  const [tier, setTier] = useState<Tier | null>(null);
  const [candidates, setCandidates] = useState<ComparisonCandidate[] | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailureKind | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const comparison = useComparisonRanking(candidates);

  // Guards against re-submitting on every re-render once a submit has already kicked off for this comparison round (mirrors AddFlow's pattern for the same effect below).
  const submittedForRef = useRef<ComparisonCandidate[] | null>(null);

  function backToTier() {
    setTier(null);
    setCandidates(null);
    setTierError(null);
    setFailure(null);
    setRemoveError(null);
    submittedForRef.current = null;
    setPhase("tier");
  }

  function askToRemove() {
    setRemoveError(null);
    setPhase("confirm-remove");
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

  async function handleRemove() {
    setRemoveError(null);
    setPhase("removing");

    try {
      const res = await fetch(`/api/entries/${entryId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.refresh();
        // Leave phase as "removing" — the row disappears once refreshed server data lands, so there's no stale phase to reset to.
        return;
      }

      if (res.status === 404) {
        setFailure("not_found");
        setPhase("failed");
        return;
      }

      setRemoveError("Couldn't remove. Try again.");
      setPhase("confirm-remove");
    } catch {
      setRemoveError("Couldn't remove. Try again.");
      setPhase("confirm-remove");
    }
  }

  // Auto-submit once the comparison loop lands on a final position (including the empty-tier case, which completes immediately with zero comparisons).
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
    // Skipping a too-close comparison counts as the re-ranked game LOSING that comparison, same rationale as AddFlow.
    comparison.choose(false);
  }

  // During the comparing phase, ComparisonModal renders its own shell, so we pass our cancel handler straight through to it instead of rendering a second modal.
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
    <ModalShell onCloseAction={onCloseAction} closeDisabled={phase === "submitting" || phase === "removing"}>
      <div className="flex flex-col gap-1">
        <h2 className={heading({ className: "text-[13px]" })}>EDIT {game.name.toUpperCase()}</h2>
        <p className="text-xs tracking-[1px] text-ink-dim">CURRENTLY: {TIER_LABEL[currentTier].toUpperCase()}</p>
      </div>

      {(phase === "tier" || phase === "loading-candidates") && (
        <div className="flex flex-col gap-4">
          {tierError && <Banner variant="error">{tierError}</Banner>}
          {/* No prompt/back button here since <h2> and ModalShell's X cover those; `currentTier` is deliberately NOT passed as `selected`, since that state dims the other two bars — the ones the user came to click. */}
          <TierPicker selected={phase === "loading-candidates" ? tier : null} onPickAction={handlePickTier} />
          {phase === "loading-candidates" ? (
            <div role="status">
              <PixelLoader label={`Loading your ${tier ? TIER_LABEL[tier].toLowerCase() : ""} games…`} />
            </div>
          ) : (
            <div className="border-t border-edge/45 pt-4">
              <button type="button" onClick={askToRemove} className={button({ variant: "outline" })}>
                REMOVE
              </button>
            </div>
          )}
        </div>
      )}

      {(phase === "submitting" || (phase === "comparing" && !comparison.currentCandidate)) && (
        <PixelLoader className="py-4" label="Saving…" />
      )}

      {phase === "confirm-remove" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink">REMOVE {game.name.toUpperCase()} FROM YOUR LIST?</p>
          {removeError && <Banner variant="error">{removeError}</Banner>}
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleRemove} className={button({ variant: "outline" })}>
              YES, REMOVE
            </button>
            <button type="button" onClick={() => setPhase("tier")} className={button({ variant: "ghost" })}>
              CANCEL
            </button>
          </div>
        </div>
      )}

      {phase === "removing" && <PixelLoader className="py-4" label="Removing…" />}

      {phase === "failed" && (
        <div className="flex flex-col gap-4">
          {failure === "not_found" && (
            <Banner variant="warn">This entry no longer exists — it may have been removed.</Banner>
          )}
          {failure === "generic" && (
            <Banner variant="error">Something went wrong saving this change. Try again.</Banner>
          )}

          <div className="flex items-center gap-4">
            {failure === "generic" && comparison.finalPosition !== null && (
              <button
                type="button"
                onClick={() => submit(comparison.finalPosition as number)}
                className={button({ variant: "ghost" })}
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
                className={button({ variant: "ghost" })}
              >
                CLOSE
              </button>
            ) : (
              <button type="button" onClick={backToTier} className={button({ variant: "ghost" })}>
                ← BACK
              </button>
            )}
          </div>
        </div>
      )}
    </ModalShell>
  );
}
