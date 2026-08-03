import type { Tier } from "@/db/schema";

// Tints the chip itself, since it's the only per-row tier signal in the
// pixel design (there's no colored pill background anymore).
const TIER_CHIPS: Record<Tier, string> = {
  liked: "", // base .score-chip is already the liked green
  fine: "score-chip-fine",
  disliked: "score-chip-disliked",
};

// Renders nothing when locked — RankedList's nudge banner already explains
// why, and the grid column collapses instead of showing a placeholder dash.
export default function ScoreBadge({ score, tier }: { score: number | null; tier: Tier }) {
  if (score === null) {
    return null;
  }

  return <span className={`score-chip ${TIER_CHIPS[tier]}`}>{score.toFixed(1)}</span>;
}
