"use client";

import { useId, useRef } from "react";
import type { Tier } from "@/db/schema";
import { TIER_LABEL } from "@/lib/tiers";

const TIER_OPTIONS: { tier: Tier; className: string }[] = [
  { tier: "liked", className: "tier-bar-liked" },
  { tier: "fine", className: "tier-bar-fine" },
  { tier: "disliked", className: "tier-bar-disliked" },
];

export default function TierPicker({
  onPickAction,
  prompt,
  onBackAction,
  backLabel = "BACK TO RESULTS",
  selected = null,
}: {
  onPickAction: (tier: Tier) => void;
  /** Heading above the bars. The add flow labels the group ("HOW WAS IT?"); the
      edit dialog omits it, since its own <h2> already frames the choice. */
  prompt?: string;
  /** Back affordance below the bars. The edit dialog omits it — ModalShell's X
      is its way out. */
  onBackAction?: () => void;
  backLabel?: string;
  /** The tier the user just committed to. While it's set that bar keeps the
      pressed look, the other two dim, and the whole group — back button
      included — stops accepting input until the caller moves on. Locking the
      back button matters: without it, backing out mid-fetch would let the
      in-flight candidate request resolve and drag the user into comparisons for
      a game they just abandoned. */
  selected?: Tier | null;
}) {
  const promptId = useId();
  const barsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const locked = selected !== null;

  // Up/down move focus only. Committing stays on Enter/Space, which native
  // buttons already handle — arrowing must not fire a tier, because picking one
  // is a one-way commit that kicks off a fetch and leaves this screen.
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;

    e.preventDefault(); // otherwise the page scrolls under the group
    const delta = e.key === "ArrowDown" ? 1 : -1;
    barsRef.current[(index + delta + TIER_OPTIONS.length) % TIER_OPTIONS.length]?.focus();
  }

  return (
    // A labelled set of three buttons — deliberately not a radiogroup or
    // toolbar, since neither arrow-key selection nor a single tab stop is
    // implemented here.
    // biome-ignore lint/a11y/useSemanticElements: <fieldset> drags in legend and form-reset semantics for a widget that isn't a form control — these bars fire actions, they don't hold a value
    <div
      className="tier-picker"
      role="group"
      aria-labelledby={prompt ? promptId : undefined}
      aria-label={prompt ? undefined : "Rate this game"}
    >
      {prompt && (
        <p id={promptId} className="tier-prompt">
          {prompt}
        </p>
      )}

      <div className="tier-bars">
        {TIER_OPTIONS.map((option, index) => (
          <button
            key={option.tier}
            ref={(el) => {
              barsRef.current[index] = el;
            }}
            type="button"
            // aria-disabled rather than `disabled`: the browser blurs a disabled
            // element, so committing with the keyboard would drop focus to
            // <body> at the exact moment the next screen mounts.
            aria-disabled={locked || undefined}
            data-state={!locked ? "idle" : option.tier === selected ? "selected" : "dimmed"}
            onClick={() => {
              if (!locked) onPickAction(option.tier);
            }}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`tier-bar ${option.className}`}
          >
            {TIER_LABEL[option.tier].toUpperCase()}
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
          className="tier-back"
        >
          <span className="tier-back-chevron" aria-hidden="true">
            &#8249;
          </span>
          {backLabel}
        </button>
      )}
    </div>
  );
}
