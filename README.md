# Ranked

Ranked is a Beli-style ranking app for video games: sign in, add the games
you've played, and build a personal, ordered ranking of them instead of
scoring games in isolation.

When you add a game you first place it in one of three tiers — **Liked**,
**Fine**, or **Didn't like**. The app then runs you through a short series
of pairwise "which did you like more?" comparisons against games already in
that tier, using a client-side binary search to find exactly where the new
game slots in. The result is a fully ordered list per tier, not just a
bucket.

Each entry's 0–10 score is derived purely from its position within its
tier's band:

- **Liked** — 6.7 to 10.0
- **Fine** — 3.4 to 6.6
- **Didn't like** — 0.0 to 3.3

The best entry in a tier gets the top of the band, the worst gets the
bottom, and everything in between is interpolated by rank (see
`computeScore` in `src/lib/ranking.ts`). You can re-rank or remove an entry
at any time from the home list, which recomputes scores for the affected
tier(s).

## Local development

Prerequisites:

- Node 20+
- A Twitch developer app, created at https://dev.twitch.tv/console/apps,
  with `http://localhost:3000/api/auth/twitch/callback` added as an OAuth
  redirect URL. The same client ID/secret are used both for Twitch sign-in
  and for IGDB game search (IGDB auth rides on Twitch's app token).

Setup:

```bash
cp .env.example .env
# fill in TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET in .env

npm install
npm run dev
```

Leave `POSTGRES_URL` unset in `.env` for local dev. With it unset,
the app uses a file-backed PGlite database at `./dev-db`; the first request
to the dev server creates and migrates it automatically (see `getDb()` in
`src/db/index.ts`). No separate database setup is needed.

Run the test suite with:

```bash
npm test
```

**PGlite caveat:** PGlite supports only one process per data directory. Don't
run a `tsx` script (e.g. `scripts/dev-session.ts`) against `./dev-db` while
`npm run dev` is also running — stop the dev server first. `npm run
db:reset` deletes `./dev-db` entirely if you want to start over.

`scripts/dev-session.ts` is a helper for exercising the API directly: it
creates a dev user/session in the local PGlite DB and prints a `session=...`
cookie you can pass to `curl`. Run it with the dev server stopped, e.g.:

```bash
npx tsx scripts/dev-session.ts
curl -sI http://localhost:3000/ -H "Cookie: $(npx tsx scripts/dev-session.ts)"
```

## Database & migrations

The schema is defined in `src/db/schema.ts` (Drizzle ORM, Postgres dialect:
`users`, `sessions`, `games`, `entries`). After changing it, generate a new
migration:

```bash
npm run db:generate
```

This writes SQL into `drizzle/`. In dev, migrations are applied
automatically on the first request against `./dev-db` — nothing to run by
hand. In production, apply pending migrations explicitly against a **direct**
(non-pooled) Postgres connection:

```bash
POSTGRES_URL_NON_POOLING="<direct-connection-url>" npm run db:migrate:prod
```

Use Supabase's direct connection string for migrations, not the pooler —
the pooler doesn't support the session-level behavior migrations need.

## Deploying (Vercel + Supabase)

1. Create a Supabase project. From its Database settings, grab both the
   **direct** connection string (for migrations) and the **pooler**
   connection string (for runtime). The transaction pooler is fine — the
   app connects with `prepare: false` (see `src/db/index.ts`), which is
   required for pgbouncer-style transaction pooling.
2. Run migrations against the direct connection:
   ```bash
   POSTGRES_URL_NON_POOLING="<direct-connection-url>" npm run db:migrate:prod
   ```
3. Push the repo to GitHub and import it into Vercel.
4. In the Vercel project's environment variables, set:
   - `POSTGRES_URL` — the Supabase pooler connection string (Vercel's Supabase
     integration sets this, along with `POSTGRES_URL_NON_POOLING`, automatically
     if connected)
   - `APP_URL` — `https://<your-app>.vercel.app` (your production domain)
   - `TWITCH_CLIENT_ID`
   - `TWITCH_CLIENT_SECRET`
5. In the Twitch developer console, add the production redirect URL to the
   same app: `https://<your-app>.vercel.app/api/auth/twitch/callback`.
6. Deploy. Smoke test by signing in, adding and ranking a few games, and
   checking the corresponding rows in the Supabase table editor.

## Project structure

```
src/
  app/
    page.tsx                       Home: signed-in user's ranked list
    sign-in/page.tsx               Sign-in page (Twitch OAuth entry point)
    add/page.tsx, AddFlow.tsx      Add-a-game flow (search, tier, compare)
    settings/page.tsx              Settings page
    api/
      auth/twitch/route.ts         Starts the Twitch OAuth flow
      auth/twitch/callback/route.ts  Twitch OAuth callback, creates session
      auth/sign-out/route.ts       Clears the session
      games/search/route.ts        IGDB game search
      entries/route.ts             Create/list entries
      entries/[id]/route.ts        Update/delete a single entry
      entries/[id]/rerank/route.ts Re-rank an existing entry
      _lib/                        Shared API route helpers
    error.tsx, loading.tsx, not-found.tsx, layout.tsx, globals.css
  components/                      UI: RankedList, EntryRow, EntryActions,
                                    TierPicker, ComparisonModal, RerankDialog,
                                    GameSearch, CoverImage, ScoreBadge, ...
  db/
    schema.ts                      Drizzle schema (users, sessions, games,
                                    entries)
    index.ts                       getDb(): PGlite (dev) or postgres-js
                                    (prod, via POSTGRES_URL) singleton
  lib/
    ranking.ts                     Tier/score/position logic (insert, move,
                                    remove, recompute)
    auth.ts                        Arctic Twitch OAuth client, Helix user
                                    fetch
    session.ts                     Hand-rolled DB-backed session cookies
    igdb.ts                        IGDB API client for game search
    cover.ts                       IGDB cover image URL helpers
  hooks/
    useComparisonRanking.ts        Client-side binary search driving the
                                    pairwise comparison flow
  proxy.ts                         Next.js 16's proxy.ts (formerly
                                    middleware.ts): optimistic session-cookie
                                    redirect to /sign-in
drizzle/                           Generated SQL migrations + metadata
scripts/
  migrate.ts                       Runs migrations against
                                    POSTGRES_URL_NON_POOLING (npm run
                                    db:migrate:prod)
  dev-session.ts                   Mints a dev session cookie for curl/API
                                    testing against the local PGlite DB
```
