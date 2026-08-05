@AGENTS.md

# Ranked — "Beli for video games"

Signed-in users build a personal, fully ordered ranking of games. Adding a game:
pick a tier (Liked / Fine / Didn't like), then answer pairwise "which did you like
more?" prompts — a client-side binary search that finds the insertion position in
O(log n) comparisons. Scores (0–10) are derived from position within per-tier bands,
never entered by hand.

## Rules
- Never git commit


## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4
- Drizzle ORM — PGlite file DB in dev (`./dev-db`), Postgres/Supabase in prod
- Twitch OAuth via Arctic; hand-rolled DB sessions (Lucia pattern)
- IGDB API for game search/metadata https://api-docs.igdb.com/
- Steam API for linking library and searching games. Refer to @docs/steam.md
- Vitest for unit tests
- pnpm instead of npm

## Commands

- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm test`
- `pnpm lint` runs Biome (`biome check`, lint + format check); `pnpm format` applies fixes
- `pnpm db:generate` — drizzle-kit generate after editing `src/db/schema.ts`
- `pnpm db:migrate:prod` — apply migrations (needs direct `POSTGRES_URL_NON_POOLING`)
- `pnpm db:reset` — delete the local PGlite data dir

## Layout

- `src/app/` — pages: `/` (ranked list), `/add` (search → tier → compare), `/sign-in`, `/settings`
- `src/app/api/` — `auth/twitch[/callback]`, `auth/sign-out`, `games/search`,
  `entries` (+ `[id]`, `[id]/rerank`); shared helpers in `api/_lib/`
- `src/components/` — RankedList, ComparisonModal, TierPicker, GameSearch, etc.
- `src/db/` — `schema.ts` (users, sessions, games, entries), `index.ts` (driver switch)
- `src/lib/` — `ranking.ts` (core domain logic), `session.ts`, `auth.ts`, `igdb.ts`, `cover.ts`
- `src/hooks/useComparisonRanking.ts` — client binary-search state machine
- `src/proxy.ts` — Next 16's replacement for `middleware.ts` (auth redirect gate)
- `drizzle/` — generated SQL migrations; `scripts/` — prod migrate + dev-session minting

## Data model (src/db/schema.ts)

- `users` — text UUID PK, unique `twitchId`, Twitch profile fields.
- `sessions` — PK is the SHA-256 hex of the client token; FK to users (cascade).
- `games` — IGDB cache: unique `igdbId`, name, cover, release date, platforms (jsonb).
- `entries` — one per user+game (unique index), with `tier`, `position`, `score`.

## API conventions (src/app/api/)

- Route handlers wrap logic in `withErrorHandling` from `api/_lib/handler.ts`; throw
  `ApiError`/`badRequest` for client errors, `requireUser()` for auth (401 on failure).
- Entry mutations return the full refreshed serialized list (`serializeEntries`) so the
  client updates in one round trip.

## Ranking model (src/lib/ranking.ts)

- `entries` rows: `(userId, tier, position)` — dense 0-based position per user+tier, 0 = best.
- Tier score bands: liked 6.7–10.0, fine 3.4–6.6, disliked 0.0–3.3. Scores are linear
  interpolation of position within the band, recomputed after every mutation.
- All mutations (`insertEntry`, `moveEntry`, `removeEntry`) run in a transaction, shift
  positions to open/close gaps, then `recomputeTierScores`. Never write `score`/`position`
  directly — always go through these helpers.
- Global rank = tier order (liked > fine > disliked) then position; computed at
  serialization time (`api/_lib/entries.ts`), not stored.

## Auth flow

- `/api/auth/twitch` sets a state cookie and redirects to Twitch; callback validates state,
  upserts the user, creates a session. Session token is random; only its SHA-256 is stored.
- `getCurrentUser()` (React cache) for pages; `requireUser()` for API routes.
- `src/proxy.ts` does a presence-only cookie check for redirects — real validation is in
  `src/lib/session.ts`.

## Gotchas

- **Next 16 breaking changes** — see AGENTS.md; read `node_modules/next/dist/docs/` before
  writing framework code. `middleware.ts` is now `proxy.ts` exporting `proxy()`.
- **PGlite allows one process per data dir** — don't run tsx scripts against `./dev-db`
  while `next dev` is running. Dev DB auto-migrates on first access.
- Prod runtime uses the Supabase **pooler** (`prepare: false` required); migrations use the
  **direct** connection.
- Leave `POSTGRES_URL` unset locally to get PGlite. Required env: `TWITCH_CLIENT_ID`,
  `TWITCH_CLIENT_SECRET`, `APP_URL` (see `.env.example`).
- Set `DISABLE_AUTH=true` locally to skip Twitch auth entirely — every page/API route
  acts as a fixed synthetic dev user (`src/lib/session.ts`). Ignored unless
  `NODE_ENV !== "production"`, so it can't leak into prod even if set by accident.
- Tests exist for `ranking.ts` and `useComparisonRanking.ts` — run `npm test` after touching
  ranking logic.
