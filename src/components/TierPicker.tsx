import type { Tier } from "@/db/schema";
import { TIER_LABEL } from "@/lib/tiers";

const TIER_OPTIONS: { tier: Tier; className: string }[] = [
  { tier: "liked", className: "tier-btn-liked" },
  { tier: "fine", className: "tier-btn-fine" },
  { tier: "disliked", className: "tier-btn-disliked" },
];

export default function TierPicker({ onPick }: { onPick: (tier: Tier) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {TIER_OPTIONS.map((option) => (
        <button
          key={option.tier}
          type="button"
          onClick={() => onPick(option.tier)}
          className={`tier-btn ${option.className}`}
        >
          {TIER_LABEL[option.tier].toUpperCase()}
        </button>
      ))}
    </div>
  );
}
