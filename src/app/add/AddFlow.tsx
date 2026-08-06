"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ComparisonModal from "@/components/ComparisonModal";
import CoverImage from "@/components/CoverImage";
import GameSearch, { type GameSearchResult } from "@/components/GameSearch";
import TierPicker from "@/components/TierPicker";
import Banner from "@/components/ui/Banner";
import { button } from "@/components/ui/button";
import PixelLoader from "@/components/ui/PixelLoader";
import type { Tier } from "@/db/schema";
import { type ComparisonCandidate, useComparisonRanking } from "@/hooks/useComparisonRanking";
import { scoresUnlocked } from "@/lib/ranking";
import { TIER_LABEL } from "@/lib/tiers";

type Phase = "search" | "tier" | "loading-candidates" | "comparing" | "submitting" | "failed";

type FailureKind = "conflict" | "igdb" | "generic";

type SerializedEntry = {
  id: number;
  tier: Tier;
  position: number;
  score: number;
  globalRank: number;
  game: { id: number; igdbId: number; name: string; coverImageId: string | null; releaseYear: number | null };
};

export default function AddFlow({ steamLinked, relatedTo }: { steamLinked: boolean; relatedTo: string | null }) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("search");
  const [selectedGame, setSelectedGame] = useState<GameSearchResult | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [candidates, setCandidates] = useState<ComparisonCandidate[] | null>(null);
  const [tierError, setTierError] = useState<string | null>(null);
  const [failure, setFailure] = useState<FailureKind | null>(null);

  const comparison = useComparisonRanking(candidates);

  // Guards against re-submitting every re-render once a submit has been kicked off for this comparison round (e.g. after a failed submit leaves comparison.status === "done").
  const submittedForRef = useRef<ComparisonCandidate[] | null>(null);

  const backToSearch = useCallback(() => {
    setSelectedGame(null);
    setTier(null);
    setCandidates(null);
    setTierError(null);
    setFailure(null);
    submittedForRef.current = null;
    setPhase("search");
  }, []);

  const backToTier = useCallback(() => {
    setTier(null);
    setCandidates(null);
    setTierError(null);
    setFailure(null);
    submittedForRef.current = null;
    setPhase("tier");
  }, []);

  function handleSelectGame(game: GameSearchResult) {
    setSelectedGame(game);
    setPhase("tier");
  }

  async function handlePickTier(pickedTier: Tier) {
    setTier(pickedTier);
    setTierError(null);
    setPhase("loading-candidates");

    try {
      const res = await fetch(`/api/entries?tier=${encodeURIComponent(pickedTier)}`);

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
        const data = (await res.json()) as { entries: SerializedEntry[] };
        const newEntry = data.entries.find((entry) => entry.game.igdbId === selectedGame.igdbId);
        const unlocked = scoresUnlocked(data.entries.length);
        const ranked = unlocked && newEntry ? newEntry.score.toFixed(1) : "hidden";
        router.push(`/?ranked=${ranked}`);
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

  // Esc steps back a screen (mirroring the on-screen back buttons), only leaving for home from search or a conflict failure (the only phases with no back destination); ignored while `submitting` so a keystroke can't yank the user away mid-write.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape" || e.metaKey || e.ctrlKey || e.altKey) return;

      if (phase === "search") {
        e.preventDefault();
        router.push("/");
      } else if (phase === "tier" || phase === "loading-candidates") {
        e.preventDefault();
        backToSearch();
      } else if (phase === "comparing") {
        e.preventDefault();
        backToTier();
      } else if (phase === "failed") {
        e.preventDefault();
        if (failure === "conflict") {
          router.push("/");
        } else {
          backToTier();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [phase, failure, router, backToSearch, backToTier]);

  function handleSkip() {
    // Skipping counts as the new game LOSING that comparison, nudging it toward the middle rather than assuming it's better.
    comparison.choose(false);
  }

  return (
    <div className="flex flex-col gap-5">
      {phase === "search" && (
        <GameSearch onSelectAction={handleSelectGame} steamLinked={steamLinked} relatedTo={relatedTo} />
      )}

      {(phase === "tier" ||
        phase === "loading-candidates" ||
        phase === "comparing" ||
        phase === "submitting" ||
        phase === "failed") &&
        selectedGame && (
          <div
            className="flex items-center gap-[18px] border border-edge/70 px-[18px] py-4 mobile:gap-3 mobile:px-3 mobile:py-2.5"
            style={{ background: "linear-gradient(90deg, rgba(46,104,220,1) 0%, rgba(6,12,28,0.96) 72%)" }}
          >
            <CoverImage
              coverImageId={selectedGame.coverImageId}
              size="cover_small"
              className="h-[70px] w-[52px] shrink-0 border border-edge/65 mobile:h-14 mobile:w-10"
            />
            <div className="flex flex-col gap-2">
              <span className="text-[19px] text-ink" style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}>
                {selectedGame.name}
              </span>
              <span className="text-xs tracking-[1px] text-ink-muted">
                {[selectedGame.releaseYear, tier ? TIER_LABEL[tier] : null].filter(Boolean).join("  ·  ")}
              </span>
            </div>
          </div>
        )}

      {(phase === "tier" || phase === "loading-candidates") && (
        <div className="flex flex-col gap-4">
          {tierError && <Banner variant="error">{tierError}</Banner>}
          {/* `selected` comes off phase, not `tier`, so a failed candidate fetch (which leaves `tier` set) doesn't strand the picker in the committed look under the retry banner. */}
          <TierPicker
            prompt="HOW WAS IT?"
            selected={phase === "loading-candidates" ? tier : null}
            onPickAction={handlePickTier}
            onBackAction={backToSearch}
          />
          {phase === "loading-candidates" && (
            <div role="status">
              <PixelLoader label={`Loading your ${tier ? TIER_LABEL[tier].toLowerCase() : ""} games…`} />
            </div>
          )}
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
          <button type="button" onClick={backToTier} className="scrim-shadow self-start text-sm text-ink">
            &lt; BACK
          </button>
        </div>
      )}

      {(phase === "submitting" || (phase === "comparing" && !comparison.currentCandidate)) && (
        <PixelLoader className="py-4" label="Saving…" />
      )}

      {phase === "failed" && (
        <div className="flex flex-col gap-4">
          {failure === "conflict" && (
            <div className="flex flex-col gap-3">
              <Banner variant="warn">You&apos;ve already ranked this game.</Banner>
              <button
                type="button"
                onClick={() => router.push("/")}
                className={button({ variant: "ghost", className: "self-start" })}
              >
                GO TO HOME
              </button>
            </div>
          )}

          {failure === "igdb" && (
            <Banner variant="error">Game search is unavailable (IGDB credentials not configured).</Banner>
          )}

          {failure === "generic" && <Banner variant="error">Something went wrong saving this game. Try again.</Banner>}

          <div className="flex items-center gap-4">
            {failure !== "conflict" && comparison.finalPosition !== null && (
              <button
                type="button"
                onClick={() => submit(comparison.finalPosition as number)}
                className={button({ variant: "ghost" })}
              >
                TRY AGAIN
              </button>
            )}
            {failure !== "conflict" && (
              <button type="button" onClick={backToTier} className={button({ variant: "ghost" })}>
                ← BACK
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
