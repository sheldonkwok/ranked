import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Joins conditional classNames and dedupes conflicting Tailwind utilities
    (last one wins by property, not by source order) — for components that
    accept a `className` prop and need a caller's override to actually stick. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
