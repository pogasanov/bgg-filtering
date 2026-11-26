# Russian Shop Prices Design

## Goal

Show, for each game in the list, what it costs today in Russian board game shops, and let the owner see how that price has moved over time. Prices refresh automatically once a day.

The owner's picture: click a game in the results, a panel slides open below the row, and a chart shows the price history with one line per shop.

A later step, not this one, will notify the owner when a game goes on sale. This design must store enough history to make that possible without rework.

## Depends on

This design builds on two pieces of work that live in other worktrees and are not merged yet. Build this after both.

- **Production deployment** (`docs/superpowers/specs/2026-11-26-production-deployment-design.md` in the `feat/hosting-research-site-0026a6` worktree). It moves the app to Vercel, Postgres on Neon, a scheduled worker on Modal, and Sentry. Its constraints and anti-goals apply here unchanged.
- **Redesign** (branch `feat/website-design-requirements-38be50`). It replaces the game cards with a dense results table (`components/results/results-table.tsx`), a phone list (`components/results/results-list.tsx`) and Russian UI labels. The price UI is added to those components, not to the old cards.

Sequencing (designer's call): the work is split in two.

- **Part 1, no dependencies:** shop adapters, game names, matching rules and a local dry run that reports how many games match. Plan: `docs/superpowers/plans/2026-11-26-shop-prices-collectors.md`.
- **Part 2, after both branches are merged to `main`:** database tables, the daily Modal job, the review command and the UI. Its plan is written against the real worker, schema, migration runner and caching code; today the deployment work exists only as a spec, so a plan written now would be guesswork.

The reachability spike below needs only a Modal account and can run at any time.

## Decisions made by the owner

- **Interaction:** clicking a game opens a panel below its row with a price chart.
- **Chart:** one line per shop. Only shops that carry the game appear, on the chart and in the shop list.
- **Cadence:** prices are collected automatically once a day.
- **Where it runs:** on the server, on the hosting set up by the deployment design.
- **A wrong price is worse than no price.** A price is shown only when the link between a game and a shop product is certain.
- **Uncertain matches:** the owner will confirm them by hand from time to time.
- **Sale notifications:** wanted, but later.
- **Only Russian editions.** A shop's English-language import of a game is not that game's price and is not tracked, shown or offered for review. A product whose title has no Russian in it counts as the Russian edition only in the shop of the game's Russian publisher.
- **Where to look.** BoardGameGeek lists each game's publishers, including the Russian ones, so a game is expected first of all in its Russian publisher's own shop.
- **Game titles stay as they are today**, from BoardGameGeek. Russian names are used only for matching and are not shown on the site. The mockup shows a Russian title; ignore that detail.

## Decisions made by the designer (owner may override)

These were not discussed with the owner, or only shown in a mockup.

- **Shops in the first version:** CrowdGames, Lavka Igr and GaGa. Hobby Games is the next one and must be addable as one more shop adapter without touching the rest.
- **Which games:** only games in the stored top-N list (500 today). Shop products that match no listed game are not tracked.
- **Row click:** in the redesign the whole row is a link to BoardGameGeek. With this change the row toggles the panel instead, and the BGG link moves inside the panel. The owner saw this in the mockup and did not object, but did not explicitly agree.
- **Price column:** the results table gets a sortable "Цена" column showing the lowest current price among shops that have the game in stock. Games with no confirmed match show a dash.
- **One product per game per shop.** If a shop sells a standard and a deluxe edition, the owner confirms one of them. Expansions, promos and accessories are never matched to a base game.
- **Store only changes.** A price row is written when price, old price or availability differs from the last stored row for that product. A separate "last checked" time records that the product was seen today.
- **Sale marker:** a product is "on sale" when the shop itself reports a higher old price, or when its price is at least 10% below the highest price it had in the previous 30 days. The marker is display-only in this version.
- **Stale data:** if a shop has not been fetched successfully for 3 days, its prices are shown greyed in the panel with the date of the last successful check, and they no longer count towards the "Цена" column or its sorting.
- **Undoing a link:** the review command can also list confirmed links and remove one. When the automatic rules change, automatically confirmed links are checked again and those that no longer qualify drop back to candidates. Links the owner confirmed are never touched by the rules.
- **Games that leave the list:** names, links, rejections and price history are kept, keyed by BGG ID with no cascading delete, so a game that returns has its history. Its products are not fetched while it is off the list.
- **Products with several variants:** a shop product with more than one purchasable variant is not tracked in this version, because picking a variant risks a wrong price.
- **Candidate limits:** see Matching. At most 5 candidates per game per shop.
- **Review tool:** a command on the owner's machine, not a page on the site. The deployment design rules out an admin UI.
- **Bot identity:** requests use an honest User-Agent that names the project and links to the site.
- **Language of the document and code:** English, like the other specs. UI copy is Russian, matching the redesign.

## What was learned about the shops

Checked on 2026-11-26 from the owner's machine with plain HTTP requests and a browser User-Agent. No shop publishes a price feed for bots: no YML feed at the usual addresses, no `llms.txt`, no documented API.

- **CrowdGames** (`www.crowdgames.ru`, InSales platform)
  - `GET /collection/all.json?page=N` returns JSON: `count`, and 100 `products` per page. 176 products on 2 pages.
  - Each product has `id`, `title`, `permalink`, `available`, and `variants[]` with `price`, `old_price`, `quantity`, `sku`, `barcode`.
  - Not disallowed by `robots.txt`.
  - The sitemap lists 680 `/product/` URLs, so the `all` collection is not the whole catalogue. Not investigated.
- **Lavka Igr** (`www.lavkaigr.ru`)
  - `GET /shop/?page=N` lists about 35 products per page, 130 pages. Each buy button carries `data-id` and `data-price`.
  - Product pages carry `<meta itemprop="price">`, `priceCurrency` and `<link itemprop="availability">`.
  - `robots.txt` allows `/shop/` and disallows `/ajax*` and `/games*`. A handful of individual product URLs are disallowed.
  - The sitemap lists about 4,780 `/shop/` URLs.
- **GaGa** (`gaga.ru`)
  - Product pages `/game/<slug>/` carry `<span itemprop="price">` and a button with `data-gid`, `data-price`, `data-name`, `data-vendor`. Pages are encoded in cp1251.
  - `robots.txt` disallows every URL with a query string (`Disallow: *?*`), so paging through the catalogue with `?page=` is off limits.
  - The sitemap lists 5,714 `/game/` URLs.
  - The site shows region-dependent prices and a lower "registered user" price. Not investigated.
- **Hobby Games** (`hobbygames.ru`): product pages carry a JSON-LD `Product` block; product sitemaps exist. For later.
- **Tesera** (`api.tesera.ru`, open, has Swagger at `/swagger/v1/swagger.json`)
  - `GET /games/{alias}` returns `bggId`, `title` (Russian), `title2` (original) and `title3` (other names). `GET /search/games?query=` searches by name.
  - `GET /games/{alias}/offers` exists but returned an empty list for every game tried. Do not rely on it.
  - No way to look a game up by BGG ID was found.

Not checked: the shops' terms of use, their rate limits, and whether they answer requests from Modal's IP addresses.

## Constraints

- Everything in the deployment design's Constraints and Anti-goals sections.
- **Modal:** 5 cron schedules on the Starter plan; the BGG sync uses one. Prices use one more.
- **Neon:** 1 GB in total. Price data must stay a small part of it (see Storage).
- **Vercel Hobby:** the site stays non-commercial. Links to shops are plain links: no affiliate parameters, no referral codes.
- **Shops:**
  - Obey each shop's `robots.txt`.
  - One request at a time per shop, at least 2 seconds apart.
  - Plain HTTP only. No headless browser, no proxy rotation, no CAPTCHA solving. If a shop blocks the collector, that shop is dropped and the owner is told.

## First step: reachability spike

Before anything else is built, run a throwaway Modal function that fetches one catalogue page and one product page from each of the three shops and from Tesera, with the honest User-Agent, and reports the status codes and whether a price was found.

- If a shop refuses Modal's addresses or the honest User-Agent, stop and ask the owner. Do not work around it.
- If all three refuse, this design does not hold and needs to come back to the owner.

## Architecture

### Daily job

One scheduled Modal function, daily (designer's default: 03:00 UTC, which is 06:00 Moscow time). It lives next to the BGG sync worker and shares its Node/TypeScript setup, secrets, lock pattern and Sentry reporting. It does these steps in order, per shop, with shops independent of each other so one failing shop does not stop the others.

1. **Refresh the shop catalogue.** Record every product the shop lists: shop product ID, URL, title, and vendor and barcode where the shop gives them.
2. **Match.** Propose links between newly seen products and games on the list (see Matching).
3. **Collect prices.** For every product with a confirmed link, read price, old price and availability, and store a row if anything changed.
4. **Finish.** Record the run, then call the site's revalidation endpoint.

### Shop adapters

Each shop is one module with the same small interface: list the catalogue, and read the current offer for a product. The rest of the job does not know which shop it is talking to.

- **CrowdGames:** the catalogue and the prices both come from `collection/all.json`. Two requests a day cover everything. Whether products outside the `all` collection can be reached is for the builder to find out; if not, they are simply not tracked.
- **Lavka Igr:** the catalogue and the prices both come from the paged shop listing, about 130 requests a day. If the listing does not carry product titles and URLs in a parseable form, fall back to product pages for confirmed products only.
- **GaGa:** the catalogue comes from the sitemap. Titles need a product page fetch, so the first run reads every `/game/` page once (about 5,700 requests, a little over 3 hours at the required spacing) and later runs read only URLs that are new in the sitemap. Daily prices come from the product pages of confirmed products only. Use the price a visitor sees without cookies or login.

Parsers are written against saved copies of real responses, kept as test fixtures.

### Matching

The aim is to never show a price for the wrong product, at the cost of showing fewer prices.

- **Russian names.** For each game on the list, find its Tesera entry by searching Tesera for the BGG primary name and accepting only a result whose `bggId` equals the game's BGG ID. Store its Russian and alternative titles. Refresh rarely (the list changes about monthly). The BGG XML API also returns alternate names, some of them Cyrillic; the builder may use them as a second source.
- **Automatic confirmation.** A product is confirmed without the owner only when all of these hold:
  - after normalising case, punctuation, quotes, `ё`/`е` and whitespace, the product title equals one of the game's known names, or equals "Russian name (Original name)" in either order;
  - the title contains none of the stop words that mark a different product: дополнение, доп, expansion, промо, promo, протекторы, органайзер, плеймат, коврик, предзаказ, набор, миниатюры, and the like. The builder extends this list from what the catalogues actually contain;
  - it is the only product in that shop meeting the two conditions above for that game;
  - no other game on the list claims the same product.
- **Candidates.** Weaker evidence is stored as a candidate and never shown on the site. A product becomes a candidate for a game when one of these holds:
  - it meets the title condition but fails one of the other three conditions (for example several qualifying products, or a deluxe or anniversary edition);
  - its title contains one of the game's names as whole words, the name is at least 5 characters long, and the title has no stop word. Short names such as Root, Azul or Go therefore produce candidates only through an exact title;
  - its barcode equals the barcode of a product already confirmed for that game in another shop. Neither BGG nor Tesera supplies barcodes, so this is the only barcode rule.
- **Candidate cap.** At most 5 candidates per game per shop, preferring the shortest titles. The rest are dropped, not queued.
- **Rejected stays rejected.** A candidate the owner rejects is never proposed again.
- **A confirmed link is pinned to the shop's product ID.** A later title change in the shop does not break it. If the product disappears from the shop, the link stays and the product is treated as unavailable.

### Review command

A package script on the owner's machine, for example `pnpm prices:review`, connected to the database through `DATABASE_URL`.

- Shows candidates one at a time: the game (name, year, BGG link), the shop product (title, price, link), and why it was not confirmed automatically.
- The owner answers yes, no, or skip. Yes confirms the link, replacing any previously confirmed product for that game in that shop. No rejects it for good.
- Shows how many candidates are waiting, so the owner knows when a session is done.

### Database

Added to the Postgres schema from the deployment design, through its migration mechanism. Names are suggestions.

- **Shop products:** one row per product per shop, with the shop's own ID, URL, title, vendor, barcode, first seen, last seen.
- **Game names:** the Tesera ID and the Russian and alternative names for each listed game.
- **Links:** game, shop product, status (candidate, confirmed, rejected), how it was decided (automatic or owner), when.
- **Price history:** shop product, date, price in whole rubles, old price if the shop shows one, in stock or not. Written only on change.
- **Last check:** per shop product, when it was last read successfully.
- **Runs:** per shop per day: started, finished, products seen, prices changed, errors.

### Storage

500 games in up to 4 shops is at most 2,000 tracked products. Prices change rarely, so change-only history is a few thousand rows a year. The shop catalogues are the larger part: roughly 11,000 product rows of a few hundred bytes each. All of it together should stay in the low tens of megabytes. The worker's existing database-size warning covers this.

### Site

- **Current prices with the list.** The cached game list gains, per game, the current offers from confirmed links: shop, price, old price, in stock, product URL, last checked. This rides on the same cache tag and revalidation as the rest of the data.
- **History on demand.** Opening a row requests that game's history from a route such as `GET /api/games/[id]/prices`. The response is cached under the same tag, so repeated opens do not reach the database.
- **No database query on an ordinary page view**, as the deployment design requires.

### UI

The mockup the owner chose is saved at `docs/superpowers/specs/2026-11-26-russian-shop-prices-mockup.html` (option B).

- **Table column "Цена".** Lowest in-stock price among confirmed shops, in rubles, monospaced like the other numbers. When that offer is on sale: old price struck through above it, current price in the green used for poll "best". Sortable in both directions like the other numeric columns; games without a price sort last either way.
- **Opening a row.** Clicking a row opens a panel directly beneath it; clicking again closes it. A chevron by the title shows the state. Several rows may be open at once. It must be reachable and operable from the keyboard.
- **Panel, left: the chart.**
  - One stepped line per shop that has a confirmed link for this game. Prices move in steps, so the line is not smoothed.
  - A line breaks while the product is out of stock and ends at the last successful check.
  - A range switch: 30 days, 90 days, a year, everything. Default 90 days.
  - Each shop has a fixed colour, the same in every panel and in light and dark themes.
  - Hovering or focusing a point shows shop, date and price.
- **Panel, right: shops now.** One line per shop with a confirmed link: colour dot, shop name linking to the product page, current price, sale badge with the percentage if on sale, or "нет в наличии". Below: the lowest price ever recorded, when prices were last updated, and the link to BoardGameGeek.
- **No confirmed shop.** The panel says the game was not found in the tracked shops and still shows the BGG link.
- **Too little history.** With a single data point the chart shows that point and a note that history is still being collected.
- **Phone list.** The same panel opens under the list item, with the chart above the shop list. The list item shows the lowest price next to the rating.

## Non-goals

- Sale notifications of any kind.
- Shops beyond the three named, including Hobby Games and Mosigra.
- Tracking games outside the stored top-N list.
- Tracking more than one edition of a game per shop.
- Delivery costs, regional prices, loyalty or registered-user prices.
- An admin page on the site.
- Importing price history from before the first run.

## Anti-goals

These would make the result a failure even if it technically works:

- A price shown for a product that is not the game: an expansion, an accessory, a different game with a similar name.
- Collecting in a way a shop has said no to: ignoring `robots.txt`, disguising the collector, or getting around a block.
- Request volume a small shop would notice.
- A shop failure that takes down the page, or that silently freezes prices with no visible sign they are old.
- Anything the deployment design lists as an anti-goal, in particular a database query per page view or anything that can bill money.
- Affiliate or referral links.

## Testing and verification

- **Adapters:** each parser is tested against saved real responses, including a product that is out of stock, one on sale, and for GaGa a cp1251 page.
- **Matching:** an exact title confirms; a title with a stop word does not; two qualifying products become candidates; a rejected candidate is not proposed again; a product is never linked to two games.
- **History:** an unchanged price writes no new row but updates the last check; a change in price, old price or stock writes one row.
- **Isolation:** one shop throwing does not stop the others, and the failure is reported.
- **Site:** the price column sorts with priceless games last; the history route returns only confirmed links.
- **By hand after deploy:**
  - a manual Modal run fills catalogues and candidates;
  - the owner reviews some candidates and their prices appear after revalidation;
  - the owner spot-checks twenty automatically confirmed links against the shops and finds no wrong product. If any is wrong, tighten the rules before going further.

## Left to the builder

- The charting approach, within what the redesign already uses (shadcn/Radix). No dependency that pulls in a large runtime for one chart.
- Table and column names, and the exact shape of the adapter interface.
- Whether catalogue refresh runs every day or less often than price collection, as long as it fits one Modal schedule.
- Retry policy for shop requests.
- The exact normalisation and stop-word list, as long as the anti-goal holds.
- The shop colours.
