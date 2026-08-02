import type { Tier } from "@/db/schema";

const TIER_OPTIONS: { tier: Tier; label: string; className: string }[] = [
  {
    tier: "liked",
    label: "Liked it",
    className: "bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-600",
  },
  {
    tier: "fine",
    label: "It was fine",
    className: "bg-amber-500 hover:bg-amber-600 text-white dark:bg-amber-600 dark:hover:bg-amber-500",
  },
  {
    tier: "disliked",
    label: "Didn't like it",
    className: "bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-600",
  },
];

export default function TierPicker({ onPick }: { onPick: (tier: Tier) => void }) {
  return (
    <div className="flex flex-col gap-3">
      {TIER_OPTIONS.map((option) => (
        <button
          key={option.tier}
          type="button"
          onClick={() => onPick(option.tier)}
          className={`w-full rounded-lg px-6 py-4 text-base font-semibold transition-colors ${option.className}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
