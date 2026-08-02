import type { Tier } from "@/db/schema";

// Tints the numeral itself, since the badge is the only per-row tier signal
// in the pixel design (there's no colored pill background anymore).
const TIER_STYLES: Record<Tier, string> = {
  liked: "text-liked-edge",
  fine: "text-fine-edge",
  disliked: "text-disliked-edge",
};

// Renders nothing when locked — RankedList's nudge banner already explains
// why, and the grid column collapses instead of showing a placeholder dash.
export default function ScoreBadge({ score, tier }: { score: number | null; tier: Tier }) {
  if (score === null) {
    return null;
  }

  return (
    <span
      className={`font-pixel min-w-[78px] border-b-2 border-edge/50 pb-[5px] text-right text-[15px] tabular-nums ${TIER_STYLES[tier]}`}
    >
      {score.toFixed(1)}
    </span>
  );
}
