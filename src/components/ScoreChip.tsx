import type { Tier } from "@/db/schema";
import { cva, type VariantProps } from "@/lib/cva";

// Two-layer chip (outline + inset face, each with its own chamfer so clip-path doesn't slice a real border) that hides its ring until hover flips the face to reveal it; palette lives on the outer element as CSS custom properties and reaches the face purely via inheritance.
export const scoreChip = cva(
  "group inline-block min-w-[66px] chamfer-[5px] cursor-pointer bg-(--chip-bg) p-0.5 drop-shadow-[0_3px_0_var(--chip-shade)] focus-visible:outline-none mobile:min-w-[62px] mobile-xs:min-w-[54px]",
  {
    variants: {
      tier: {
        liked: "[--chip-bg:#6ee787] [--chip-fg:#07160d] [--chip-shade:#2f8b52]",
        fine: "[--chip-bg:#efc85c] [--chip-fg:#170f03] [--chip-shade:#8b6b2f]",
        disliked: "[--chip-bg:#f0889b] [--chip-fg:#17060a] [--chip-shade:#8b3345]",
      },
      // Scores stay hidden until SCORE_UNLOCK_THRESHOLD entries but the chip still renders (editable); `locked`'s custom-property names deliberately overlap `tier`'s so tailwind-merge lets whichever is passed last win.
      locked: {
        true: "[--chip-bg:#4a5570] [--chip-fg:#0a0e18] [--chip-shade:#2a3145]",
      },
      // Read-only chip (public profiles) — same look, no interactive affordances (press, hover inversion).
      interactive: {
        true: "active:translate-y-0.5 active:drop-shadow-[0_1px_0_var(--chip-shade)]",
        false: "cursor-default",
      },
    },
    defaultVariants: { interactive: true },
  }
);

export const scoreChipFace = cva(
  "chamfer-[4px] flex items-center justify-center bg-(--chip-bg) p-[2px_10px] font-pixel text-[26px] leading-none text-(--chip-fg) transition-[background-color,color] duration-100 mobile:p-[11px_8px_10px] mobile:text-[21px] mobile-xs:p-[12px_6px_11px] mobile-xs:text-[19px]",
  {
    variants: {
      interactive: {
        true: "group-hover:bg-(--chip-fg) group-hover:text-(--chip-bg) group-focus-visible:bg-(--chip-fg) group-focus-visible:text-(--chip-bg)",
      },
    },
    defaultVariants: { interactive: true },
  }
);

/** Shared between the interactive ScoreButton and read-only ScoreChip; `tier` and `locked` are mutually exclusive — only ever pass one. */
export function scoreChipPalette(tier: Tier, score: number | null): VariantProps<typeof scoreChip> {
  return score === null ? { locked: true } : { tier };
}

export function scoreChipLabel(score: number | null): string {
  return score === null ? "——" : score.toFixed(1);
}

/** Non-interactive score chip for read-only views — same markup as ScoreButton's chip minus the <button>/click handler; `interactive: false` strips pointer/hover/active affordances. */
export default function ScoreChip({ tier, score }: { tier: Tier; score: number | null }) {
  return (
    <span className={scoreChip({ ...scoreChipPalette(tier, score), interactive: false })}>
      <span className={scoreChipFace({ interactive: false })}>{scoreChipLabel(score)}</span>
    </span>
  );
}
