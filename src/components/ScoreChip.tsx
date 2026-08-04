import type { Tier } from "@/db/schema";

// Tints the chip itself, since it's the only per-row tier signal in the
// pixel design (there's no colored pill background anymore).
const TIER_CHIPS: Record<Tier, string> = {
  liked: "", // base .score-chip is already the liked green
  fine: "score-chip-fine",
  disliked: "score-chip-disliked",
};

/** Shared between the interactive ScoreButton and the read-only ScoreChip. */
export function scoreChipClass(tier: Tier, score: number | null): string {
  return score === null ? "score-chip-locked" : TIER_CHIPS[tier];
}

export function scoreChipLabel(score: number | null): string {
  return score === null ? "——" : score.toFixed(1);
}

/**
 * Non-interactive score chip for read-only views (public profiles). Same
 * markup/classes as the chip inside ScoreButton, minus the <button> and
 * click handler — `.score-chip-static` (globals.css) strips the pointer
 * cursor and hover/active affordances.
 */
export default function ScoreChip({ tier, score }: { tier: Tier; score: number | null }) {
  return (
    <span className={`score-chip score-chip-static ${scoreChipClass(tier, score)}`}>
      <span className="score-chip-face">{scoreChipLabel(score)}</span>
    </span>
  );
}
