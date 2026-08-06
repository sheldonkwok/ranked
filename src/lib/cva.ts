import { cva as baseCva, cx } from "class-variance-authority";
import { twMerge } from "tailwind-merge";

type Cva = typeof baseCva;

/** class-variance-authority has no built-in Tailwind conflict resolution, so a
    variant like `tone: "danger"` or a caller's `className` override can lose to
    an earlier utility purely on source order. Wrapping every recipe's output
    through tailwind-merge fixes that — same call signature as `cva`, just
    deduped by CSS property before it reaches the DOM. */
export const cva: Cva = ((base, config) => {
  const variants = baseCva(base, config as never);
  return (props?: Parameters<typeof variants>[0]) => twMerge(variants(props));
}) as Cva;

export type { VariantProps } from "class-variance-authority";
export { cx };
