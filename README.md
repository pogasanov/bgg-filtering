# BGG Player Recommendation Finder

A local Next.js app for filtering top BoardGameGeek games by categories, mechanics, and player-count recommendation polls.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add a BoardGameGeek XML API application token as `BGG_TOKEN`.
3. Run `npm run dev`.
4. Open the local URL printed by Next.js.
5. Click `Sync BGG` to populate `data/bgg-cache.sqlite`.

The SQLite cache is the source of truth. Keep `data/` outside `.next` and preserve it across redeploys if you want cached BGG data to survive.

## BoardGameGeek API compliance

- API requests are server-side only. `BGG_TOKEN` stays in `.env.local` and is never exposed to browser code.
- API results are cached in SQLite and refresh is manual, keeping repeat API traffic low.
- Requests use `https://boardgamegeek.com` without a `www` subdomain.
- XML API detail requests are batched at the documented maximum of 20 item IDs and delayed between batches.
- The UI credits BoardGameGeek by name and includes a visible, linked "Powered by BGG" mark.
- The app is intended for non-commercial local browsing only.
- BGG API data must not be used to train AI or LLM systems.
- Game descriptions from the XML API are cached but not rendered in the UI, to avoid displaying modified User Submission text.

## Scripts

- `npm run dev` starts the local site.
- `npm test` runs parser, filter, and SQLite cache tests.
- `npm run typecheck` checks TypeScript.
- `npm run build` creates a production build.
