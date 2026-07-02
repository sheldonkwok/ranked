// Shared helpers for the `/api/entries/[id]` and `/api/entries/[id]/rerank`
// dynamic routes.
import { badRequest } from "./handler";

/** Parses a route's `[id]` param into a positive integer entry id, or throws a 400 ApiError. */
export function parseEntryId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw badRequest(`invalid entry id "${raw}"`);
  }
  return Number(raw);
}

/**
 * `moveEntry`/`removeEntry` (src/lib/ranking.ts) throw a plain `Error` with
 * this message shape when the entry doesn't exist or isn't owned by the
 * requesting user — the only case route handlers should map to 404 rather
 * than letting `withErrorHandling` treat it as an unexpected 500.
 */
export function isEntryNotFoundError(err: unknown): boolean {
  return err instanceof Error && /not found for user/.test(err.message);
}
