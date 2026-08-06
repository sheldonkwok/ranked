// Shared helpers for the /api/entries/[id] and /api/entries/[id]/rerank dynamic routes.
import { badRequest } from "./handler";

/** Parses a route's `[id]` param into a positive integer entry id, or throws a 400 ApiError. */
export function parseEntryId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw badRequest(`invalid entry id "${raw}"`);
  }
  return Number(raw);
}

/** True when err is the "not found for user" Error moveEntry/removeEntry throw for a missing or unowned entry — the one case that should map to 404 instead of 500. */
export function isEntryNotFoundError(err: unknown): boolean {
  return err instanceof Error && /not found for user/.test(err.message);
}
