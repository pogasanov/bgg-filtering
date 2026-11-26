# BGG Player Recommendation Finder

A local Next.js app for filtering top BoardGameGeek games from a local ranks CSV by categories, mechanics, and player-count recommendation polls.

Filters live in a rail on the left with the player-count × verdict matrix on top; results are a sortable table with the poll verdict for every player count shown in each row. The current filters, sort and page are kept in the URL, so a reload or a copied link restores the view. Filtering and sorting run on the server, which renders 100 games per page and keeps the result of each filter combination in memory until the cache database changes. The theme follows the operating system.

## Local Setup

1. Copy `.env.example` to `.env.local`.
2. Add a BoardGameGeek XML API application token as `BGG_TOKEN`.
3. Place the downloaded `boardgames_ranks.csv` in the project root.
4. Run `npm run dev`.
5. Open the local URL printed by Next.js.
6. Click `Синхронизировать` at the bottom of the filter rail to populate `data/bgg-cache.sqlite`.

The SQLite cache is the source of truth. Keep `data/` outside `.next` and preserve it across redeploys if you want cached BGG data to survive.

## BoardGameGeek API compliance

- API requests are server-side only. `BGG_TOKEN` stays in `.env.local` and is never exposed to browser code.
- Ranked game IDs and ratings are loaded from local `boardgames_ranks.csv`; no BGG HTML pages are requested.
- API results are cached in SQLite and refresh is manual, keeping repeat API traffic low.
- Requests use `https://boardgamegeek.com` without a `www` subdomain.
- XML API detail requests are batched at the documented maximum of 20 item IDs and delayed between batches.
- The UI credits BoardGameGeek by name and includes a visible, linked "Powered by BGG" mark: in the filter rail on desktop and in the page footer on phones.
- Game thumbnails are the URLs returned by the XML API. They are stored in the cache during sync and loaded by the browser directly from BoardGameGeek's image host; no extra API requests are made for them. Caches created before thumbnails were stored show placeholder tiles until the next sync.
- The app is intended for non-commercial local browsing only.
- BGG API data must not be used to train AI or LLM systems.
- Game descriptions from the XML API are cached but not rendered in the UI, to avoid displaying modified User Submission text.

## Scripts

- `npm run dev` starts the local site.
- `npm test` runs parser, ranks CSV, filter, and SQLite cache tests.
- `npm run typecheck` checks TypeScript.
- `npm run build` creates a production build.
- `npm run prices:dry-run` checks the Russian shop price collectors (see below).

## Price dry run

`npm run prices:dry-run` fetches a little from CrowdGames, Lavka Igr and GaGa, matches the products against the games in `data/bgg-cache.sqlite`, and prints how many games got a confirmed price, how many only have candidates, and a sample of confirmed links to check by eye. It needs Node 22.15 or newer and a synced BGG cache.

By default it reads only enough to prove the parsers work: the whole CrowdGames catalogue (two requests), two listing pages of Lavka Igr, three GaGa product pages, and Tesera names for three games.

- `--shops crowdgames,lavkaigr,gaga` limits the run to some shops.
- `--lavka-pages N`, `--gaga-limit N`, `--tesera N` change those limits; `--tesera 0` skips Tesera.
- `--full` removes the limits. GaGa alone is about 5,700 pages and three hours.
- `--refresh` ignores cached complete catalogues.

Results and caches are written to `data/price-cache/`. Requests obey each shop's `robots.txt`, run one at a time at least two seconds apart, and identify themselves as `BggPlayerFinderBot`; set `PRICE_BOT_INFO_URL` to add a link to the site. The exit code is 1 if any shop failed.
