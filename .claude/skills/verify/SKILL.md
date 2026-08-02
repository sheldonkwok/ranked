---
name: verify
description: Build/launch/drive recipe for verifying Ranked changes end-to-end in a real browser.
---

# Verifying Ranked

## Launch

- Check for an existing dev server first: `pgrep -af "next dev"`. PGlite allows
  **one process** per `./dev-db`, so if a server is already running, drive it —
  don't start a second one or run tsx scripts against the DB.
- Otherwise: `npm run dev` (background). `.env` already has Twitch/IGDB creds,
  `DISABLE_AUTH=true`, and unset `DATABASE_URL` (→ PGlite), so all pages/APIs
  work as a synthetic dev user with real IGDB search. App at http://localhost:3000.

## Drive (headless browser)

No Playwright in the repo. Install `playwright-core` in the scratchpad and use
the system browser:

```js
import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "/usr/bin/chromium", headless: true });
const ctx = await browser.newContext({ colorScheme: "dark" }); // or "light"
```

Dark mode is media-query based (`prefers-color-scheme`), so `colorScheme` on the
context is how you flip themes.

## Flows worth driving

- `/` — ranked list renders, body colors follow the color scheme.
- `/add` — type 2+ chars in the search box → debounced (300ms) IGDB autocomplete,
  max 8 results, already-ranked games excluded; Enter fires the search
  immediately. Select a result → tier picker → pairwise comparison flow.
- API directly: `curl 'http://localhost:3000/api/games/search?q=zelda'` works
  under DISABLE_AUTH.

## Gotchas

- IGDB search hits the real API — needs network + the Twitch creds in `.env`.
- Screenshots right after results appear may show unloaded cover images; wait
  for `networkidle` or an extra beat if covers matter.
