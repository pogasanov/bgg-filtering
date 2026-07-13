# BGG Player Recommendation Finder

A local Next.js app for filtering top BoardGameGeek games by categories, mechanics, and player-count recommendation polls.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add a BoardGameGeek XML API application token as `BGG_TOKEN`.
3. Run `npm run dev`.
4. Open the local URL printed by Next.js.
5. Click `Sync BGG` to populate `data/bgg-cache.sqlite`.

The SQLite cache is the source of truth. Keep `data/` outside `.next` and preserve it across redeploys if you want cached BGG data to survive.

## Scripts

- `npm run dev` starts the local site.
- `npm test` runs parser, filter, and SQLite cache tests.
- `npm run typecheck` checks TypeScript.
- `npm run build` creates a production build.
