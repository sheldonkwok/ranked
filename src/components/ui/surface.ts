import { cva } from "@/lib/cva";

/** Bordered gradient container used for list panels, cards, modals. */
export const panel = cva(
  "border border-edge/50 bg-(image:--gradient-panel) shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_10px_30px_rgba(0,0,0,0.55)]"
);

/** A row inside a `panel()` list — resting sheen + blue sweep on hover. */
export const row = cva("border-b border-edge/12 bg-(image:--gradient-row) hover:bg-(image:--gradient-row-hover)");

/** Section/page headings in the pixel display face. */
export const heading = cva(
  "font-pixel leading-normal text-white [text-shadow:0_3px_6px_rgba(0,0,0,0.95),0_0_18px_rgba(120,170,255,0.35)]"
);
