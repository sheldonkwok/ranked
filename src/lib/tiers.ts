import type { Tier } from "@/db/schema";

/** Shared display copy for each tier — used by TierPicker, AddFlow, and RerankDialog. */
export const TIER_LABEL: Record<Tier, string> = {
  liked: "Liked it",
  fine: "It was fine",
  disliked: "Didn't like it",
};
