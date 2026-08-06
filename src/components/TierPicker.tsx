"use client";

import { useId, useRef } from "react";
import type { Tier } from "@/db/schema";
import { cva } from "@/lib/cva";
import { TIER_LABEL } from "@/lib/tiers";

// Tier picker's flat-fill bars use `data-state` (idle | selected | dimmed) rather than stacking modifier classes, so a committed bar's pressed look can't be undone by a stray hover.
const TIER_BAR = [
  "flex w-full min-h-[78px] items-center border-0 bg-(--tier-fill) px-[26px] text-left font-pixel text-[20px] leading-none tracking-[0.08em] text-(--tier-ink) uppercase",
  "shadow-[inset_0_-6px_0_rgba(0,0,0,0.22),0_4px_0_rgba(0,0,0,0.45)]",
  // Chunky by design: two discrete frames, never a smooth ease.
  "transition-[background-color,transform,box-shadow,filter] duration-[80ms] ease-[steps(2)]",
  "focus-visible:outline-4 focus-visible:outline-white focus-visible:-outline-offset-4",
  "data-[state=idle]:cursor-pointer",
  "data-[state=idle]:hover:-translate-y-0.5 data-[state=idle]:hover:bg-[color-mix(in_oklab,white_8%,var(--tier-fill))] data-[state=idle]:hover:shadow-[inset_0_-6px_0_rgba(0,0,0,0.22),0_6px_0_rgba(0,0,0,0.45)]",
  "data-[state=idle]:focus-visible:-translate-y-0.5 data-[state=idle]:focus-visible:bg-[color-mix(in_oklab,white_8%,var(--tier-fill))] data-[state=idle]:focus-visible:shadow-[inset_0_-6px_0_rgba(0,0,0,0.22),0_6px_0_rgba(0,0,0,0.45)]",
  "data-[state=idle]:active:translate-y-1 data-[state=idle]:active:shadow-[inset_0_-6px_0_rgba(0,0,0,0.22),0_0_0_rgba(0,0,0,0.45)] data-[state=idle]:active:transition-none",
  "data-[state=selected]:translate-y-1 data-[state=selected]:cursor-default data-[state=selected]:shadow-[inset_0_-6px_0_rgba(0,0,0,0.22),0_0_0_rgba(0,0,0,0.45)] data-[state=selected]:transition-none",
  "data-[state=dimmed]:cursor-default data-[state=dimmed]:saturate-[45%] data-[state=dimmed]:brightness-[70%]",
  // Keep the press readable without motion — the drop shadow still collapses even though the bar doesn't travel.
  "motion-reduce:transition-none",
  "motion-reduce:data-[state=idle]:hover:translate-y-0 motion-reduce:data-[state=idle]:focus-visible:translate-y-0 motion-reduce:data-[state=idle]:active:translate-y-0 motion-reduce:data-[state=selected]:translate-y-0",
  // Matches EntryRow's breakpoint. 64px still clears the 44px touch-target floor.
  "mobile:min-h-16 mobile:text-[16px]",
].join(" ");

const tierBar = cva(TIER_BAR, {
  variants: {
    tier: {
      liked: "[--tier-fill:#4fd48a] [--tier-ink:#08160e]",
      fine: "[--tier-fill:#f2c94c] [--tier-ink:#1a1305]",
      disliked: "[--tier-fill:#ff6b8b] [--tier-ink:#1c0810]",
    },
  },
});

const TIER_OPTIONS: Tier[] = ["liked", "fine", "disliked"];

export default function TierPicker({
  onPickAction,
  prompt,
  onBackAction,
  backLabel = "BACK TO RESULTS",
  selected = null,
}: {
  onPickAction: (tier: Tier) => void;
  /** Heading above the bars; the add flow labels the group, the edit dialog omits it since its own <h2> already frames the choice. */
  prompt?: string;
  /** Back affordance below the bars — the edit dialog omits it, since ModalShell's X is its way out. */
  onBackAction?: () => void;
  backLabel?: string;
  /** The committed tier — its bar stays pressed, the others dim, and the whole group (including back) locks so backing out mid-fetch can't resolve into comparisons for an abandoned game. */
  selected?: Tier | null;
}) {
  const promptId = useId();
  const barsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const locked = selected !== null;

  // Up/down move focus only — arrowing must not commit a tier, since picking one is a one-way commit that kicks off a fetch and leaves this screen.
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    e.preventDefault(); // otherwise the page scrolls under the group
    const delta = e.key === "ArrowDown" ? 1 : -1;
    barsRef.current[(index + delta + TIER_OPTIONS.length) % TIER_OPTIONS.length]?.focus();
  }

  return (
    // A labelled set of three buttons — deliberately not a radiogroup or toolbar, since neither arrow-key selection nor a single tab stop is implemented here.
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> drags in legend and form-reset semantics for a widget that isn't a form control — these bars fire actions, they don't hold a value
    <div
      className="flex flex-col items-stretch"
      role="group"
      aria-labelledby={prompt ? promptId : undefined}
      aria-label={prompt ? undefined : "Rate this game"}
    >
      {prompt && (
        <p
          id={promptId}
          className="mb-[22px] font-pixel text-[12px] leading-none tracking-[0.18em] text-[#dce7f7] uppercase [text-shadow:2px_2px_0_rgba(0,0,0,0.55)]"
        >
          {prompt}
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {TIER_OPTIONS.map((tier, index) => (
          <button
            key={tier}
            ref={(el) => {
              barsRef.current[index] = el;
            }}
            type="button"
            // aria-disabled rather than `disabled`: a disabled element blurs on click, dropping keyboard focus to <body> right as the next screen mounts.
            aria-disabled={locked || undefined}
            data-state={!locked ? "idle" : tier === selected ? "selected" : "dimmed"}
            onClick={() => {
              if (!locked) onPickAction(tier);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={tierBar({ tier })}
          >
            {TIER_LABEL[tier].toUpperCase()}
          </button>
        ))}
      </div>

      {onBackAction && (
        <button
          type="button"
          aria-disabled={locked || undefined}
          onClick={() => {
            if (!locked) onBackAction();
          }}
          className="mt-[26px] inline-flex w-fit items-center gap-2.5 border-0 bg-[#0e1420] px-4 py-2.5 font-pixel text-[13px] leading-none tracking-[0.12em] text-[#dce7f7] uppercase shadow-[0_3px_0_rgba(0,0,0,0.45)] transition-[background-color] duration-[80ms] ease-[steps(2)] hover:bg-[#162031] active:translate-y-[3px] active:shadow-[0_0_0_rgba(0,0,0,0.45)] active:transition-none focus-visible:outline-4 focus-visible:outline-white focus-visible:-outline-offset-4 aria-disabled:cursor-default aria-disabled:opacity-55 aria-disabled:hover:bg-[#0e1420] motion-reduce:transition-none motion-reduce:active:translate-y-0"
        >
          <span className="text-[13px] text-[#7fa8de]" aria-hidden="true">
            &#8249;
          </span>
          {backLabel}
        </button>
      )}
    </div>
  );
}
