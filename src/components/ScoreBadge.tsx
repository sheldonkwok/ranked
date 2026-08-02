import type { Tier } from "@/db/schema";

const TIER_STYLES: Record<Tier, string> = {
  liked: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  fine: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  disliked: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function ScoreBadge({
  score,
  tier,
}: {
  score: number;
  tier: Tier;
}) {
  return (
    <span
      className={`inline-flex min-w-10 items-center justify-center rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${TIER_STYLES[tier]}`}
    >
      {score.toFixed(1)}
    </span>
  );
}
