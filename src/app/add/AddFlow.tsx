"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import GameSearch, { type GameSearchResult } from "@/components/GameSearch";
import TierPicker from "@/components/TierPicker";
import ComparisonModal from "@/components/ComparisonModal";
import CoverImage from "@/components/CoverImage";
import {
  useComparisonRanking,
  type ComparisonCandidate,
} from "@/hooks/useComparisonRanking";
import type { Tier } from "@/db/schema";

type Phase =
  | "search"
  | "tier"
  | "loading-candidates"
  | "comparing"
  | "submitting"
  | "failed";

type FailureKind = "conflict" | "igdb" | "generic";

const TIER_LABEL: Record<Tier, string> = {
  liked: "Liked it",
  fine: "It was fine",
  disliked: "Didn't like it",
};

export default function AddFlow() {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("search");
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(
    null
  );
  const [tier, setTier] = useState<Tier | null>(null);
  const [candidates, setCandidates] = useState<ComparisonCandidate[] | null>(
    null
  );
  const [tierError, setTierError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailureKind | null>(null);

  const comparison = useComparisonRanking(candidates);

  // Guards against re-submitting on every re-render once we've already
  // kicked off a submit for the current comparison round (e.g. after a
  // failed submit sets `failure` but leaves comparison.status === "done").
  const submittedForRef = useRef<ComparisonCandidate[] | null>(null);

  function backToSearch() {
    setSelectedGame(null);
    setTier(null);
    setCandidates(null);
    setTierError(null);
    setFailure(null);
    submittedForRef.current = null;
    setPhase("search");
  }

  function backToTier() {
    setTier(null);
    setCandidates(null);
    setTierError(null);
    setFailure(null);
    submittedForRef.current = null;
    setPhase("tier");
  }

  function handleSelectGame(game: GameSearchResult) {
    setSelectedGame(game);
    setPhase("tier");
  }

  async function handlePickTier(pickedTier: Tier) {
    setTier(pickedTier);
    setTierError(null);
    setPhase("loading-candidates");

    try {
      const res = await fetch(
        `/api/entries?tier=${encodeURIComponent(pickedTier)}`
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
    if (!selectedGame || !tier) return;

    setFailure(null);
    setPhase("submitting");

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          igdbId: selectedGame.igdbId,
          tier,
          position,
        }),
      });

      if (res.status === 201) {
        router.push("/");
        router.refresh();
        return;
      }

      if (res.status === 409) {
        setFailure("conflict");
        setPhase("failed");
        return;
      }

      if (res.status === 502) {
        setFailure("igdb");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, comparison.status, comparison.finalPosition, candidates]);

  function handleSkip() {
    // Skipping a too-close comparison counts as the new game LOSING that
    // comparison, nudging it toward the middle of the ranking rather than
    // assuming it's better than the candidate.
    comparison.choose(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {phase === "search" && (
        <GameSearch onSelectAction={handleSelectGame} />
      )}

      {(phase === "tier" ||
        phase === "loading-candidates" ||
        phase === "comparing" ||
        phase === "submitting" ||
        phase === "failed") &&
        selectedGame && (
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <CoverImage
              coverImageId={selectedGame.coverImageId}
              size="cover_small"
              className="h-16 w-12 shrink-0 rounded"
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{selectedGame.name}</span>
              {selectedGame.releaseYear && (
                <span className="text-xs text-zinc-500">
                  {selectedGame.releaseYear}
                </span>
              )}
              {tier && (
                <span className="text-xs text-zinc-500">
                  {TIER_LABEL[tier]}
                </span>
              )}
            </div>
          </div>
        )}

      {phase === "tier" && (
        <div className="flex flex-col gap-4">
          {tierError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
              {tierError}
            </p>
          )}
          <TierPicker onPick={handlePickTier} />
          <button
            type="button"
            onClick={backToSearch}
            className="self-start text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Back
          </button>
        </div>
      )}

      {phase === "loading-candidates" && (
        <div className="flex items-center gap-2 py-4 text-sm text-zinc-500">
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300"
          />
          Loading your {tier ? TIER_LABEL[tier].toLowerCase() : ""} games…
        </div>
      )}

      {phase === "comparing" && selectedGame && comparison.currentCandidate && (
        <div className="flex flex-col gap-4">
          <ComparisonModal
            newGame={selectedGame}
            candidate={comparison.currentCandidate.game}
            onChooseAction={comparison.choose}
            onSkipAction={handleSkip}
            comparisonsDone={comparison.comparisonsDone}
            maxComparisons={comparison.maxComparisons}
          />
          <button
            type="button"
            onClick={backToTier}
            className="self-start text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            ← Back
          </button>
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
          {failure === "conflict" && (
            <div className="flex flex-col gap-3 rounded-md bg-amber-50 px-3 py-3 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <p>You&apos;ve already ranked this game.</p>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Go to home
              </button>
            </div>
          )}

          {failure === "igdb" && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
              Game search is unavailable (IGDB credentials not configured).
            </p>
          )}

          {failure === "generic" && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400">
              Something went wrong saving this game. Try again.
            </p>
          )}

          <div className="flex gap-3">
            {failure !== "conflict" && comparison.finalPosition !== null && (
              <button
                type="button"
                onClick={() => submit(comparison.finalPosition as number)}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Try again
              </button>
            )}
            <button
              type="button"
              onClick={backToTier}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
