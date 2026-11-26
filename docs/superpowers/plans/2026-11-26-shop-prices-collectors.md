# Shop Prices, Part 1: Collectors and Matching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fetch product catalogues with prices from CrowdGames, Lavka Igr and GaGa, match them to the top-500 BGG games under the "wrong price is worse than no price" rule, and print a local report of how many games matched.

**Architecture:** Pure TypeScript modules under `lib/prices/`: a polite HTTP layer, one adapter per shop that turns responses into a common `ShopProduct`, a name source per game (BGG alternate names plus Tesera), and a matcher that returns confirmed links and candidates. A local script wires them to the existing SQLite cache and writes JSON snapshots to disk. Nothing here touches Postgres, Modal or the UI; part 2 will, after the deployment and redesign branches are merged.

**Tech Stack:** TypeScript, Node 22 built-in `fetch` and `TextDecoder`, `fast-xml-parser` (already a dependency), `node-html-parser` (new), `better-sqlite3` (already a dependency, read-only here), `tsx` (new dev dependency), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-russian-shop-prices-design.md`. Read "What was learned about the shops", "Constraints", "Matching" and "Anti-goals" before starting.

## Global Constraints

- Obey each shop's `robots.txt`. A URL it disallows for `User-agent: *` is never requested.
- One request at a time per shop, at least 2 seconds apart.
- Plain HTTP only. No headless browser, no proxy rotation, no CAPTCHA solving. If a shop blocks the collector, report it and stop collecting from that shop.
- Requests use an honest User-Agent: `BggPlayerFinderBot/0.1 (non-commercial price history; +<URL>)`, where `<URL>` comes from the `PRICE_BOT_INFO_URL` environment variable; without it the `; +<URL>` part is omitted. Never put a personal name or email in it.
- Prices are whole rubles as integers. A price that cannot be read is `null`, never `0`.
- A product is auto-confirmed only under the four conditions in the spec's Matching section. Everything weaker is a candidate. At most 5 candidates per game per shop.
- A shop product with more than one purchasable variant is never matched.
- Do not modify `lib/bgg/*`, `lib/cache/store.ts`, `lib/sync.ts` or anything under `components/` or `app/`. Two other branches are rewriting them; this work must merge cleanly on top.
- Tests never touch the network. Parsers are tested against saved copies of real responses in `tests/fixtures/prices/`.
- Use pnpm. Add dependencies with an exact version (`pnpm add -E`).

## Review Focus

1. **A shop answers 200 with a block page, CAPTCHA or empty listing.** The adapter must throw "catalogue empty or unrecognised", not return zero products that the report then shows as "0 matches". (Tasks 3, 4, 5)
2. **A game whose own name contains a stop word**, e.g. a base game called "… набор …". The stop word must not disqualify a product whose title equals that game's name. (Task 7)
3. **Two listed games share a name** after normalisation (reprints, "Brass", same-title different years). A product equal to that name must become a candidate for both, confirmed for neither. (Task 7)
4. **Price text in unexpected shapes:** non-breaking or thin spaces between thousands, "от 990", "990.0", an empty string, a zero. Only a positive whole number of rubles is a price; "от …" and zero give `null`. (Task 1)
5. **One shop fails mid-run** (network error, 403, parse failure). The other shops still finish, the report names the failed shop and its error, and the process exits non-zero. (Task 8)

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/prices/types.ts` | Shared types. |
| `lib/prices/text.ts` | `normalizeTitle`, `parseRubles`. |
| `lib/prices/robots.ts` | `robots.txt` evaluation for `User-agent: *`. |
| `lib/prices/http.ts` | Per-shop serial fetcher with spacing, robots check, decoding. |
| `lib/prices/shops/crowdgames.ts` | CrowdGames adapter. |
| `lib/prices/shops/lavkaigr.ts` | Lavka Igr adapter. |
| `lib/prices/shops/gaga.ts` | GaGa adapter. |
| `lib/prices/shops/index.ts` | `shopAdapters` list. |
| `lib/prices/names.ts` | BGG alternate names from cached XML; merging name sources. |
| `lib/prices/tesera.ts` | Tesera lookup verified by `bggId`. |
| `lib/prices/match.ts` | Matching rules. |
| `scripts/prices-dry-run.ts` | Local run and report. |
| `tests/prices-*.test.ts` | One test file per module. |
| `tests/fixtures/prices/*` | Saved real responses, trimmed. |

---

### Task 1: Types and text helpers

**Files:**
- Create: `lib/prices/types.ts`, `lib/prices/text.ts`
- Test: `tests/prices-text.test.ts`

**Interfaces — Produces:**

```ts
// lib/prices/types.ts
export const shopCodes = ["crowdgames", "lavkaigr", "gaga"] as const;
export type ShopCode = (typeof shopCodes)[number];

export type ShopProduct = {
  shop: ShopCode;
  externalId: string;        // the shop's own product ID
  url: string;               // absolute
  title: string;             // as the shop writes it, trimmed
  vendor: string | null;
  barcode: string | null;
  price: number | null;      // whole rubles
  oldPrice: number | null;   // shop's own crossed-out price
  available: boolean | null; // null when the source does not say
  variantCount: number;      // 1 unless the shop exposes several variants
};

export type GameNames = { bggId: number; primaryName: string; names: string[] }; // names includes primaryName, de-duplicated

export type Get = (url: string, opts?: { encoding?: "utf-8" | "windows-1251" }) => Promise<string>;

export type CatalogOptions = { known?: ShopProduct[]; limit?: number; onProgress?: (done: number, total: number | null) => void };

export type ShopAdapter = { code: ShopCode; origin: string; listCatalog: (get: Get, opts?: CatalogOptions) => Promise<ShopProduct[]> };

// lib/prices/text.ts
export function normalizeTitle(title: string): string;
export function parseRubles(text: string | number | null | undefined): number | null;
```

- [ ] **Step 1: Write the failing tests** in `tests/prices-text.test.ts`

```ts
it("normalizes case, ё, quotes, punctuation and whitespace", () => {
  expect(normalizeTitle("  «Крылья»:  Птицы Океании ")).toBe("крылья птицы океании");
  expect(normalizeTitle("Ёжики")).toBe("ежики");
  expect(normalizeTitle("Apiary (Апиарий)")).toBe("apiary апиарий");
  expect(normalizeTitle("Brass. Бирмингем")).toBe("brass бирмингем");
  expect(normalizeTitle("7 Wonders – Duel!")).toBe("7 wonders duel");
});

it("reads whole rubles and rejects everything else", () => {
  expect(parseRubles("2 790 руб.")).toBe(2790);
  expect(parseRubles("2 790 ₽")).toBe(2790);
  expect(parseRubles("1190.0")).toBe(1190);
  expect(parseRubles(990)).toBe(990);
  expect(parseRubles("от 990 руб.")).toBeNull();
  expect(parseRubles("0")).toBeNull();
  expect(parseRubles("")).toBeNull();
  expect(parseRubles(null)).toBeNull();
  expect(parseRubles("1190.50")).toBeNull();
});
```

- [ ] **Step 2: Run** `pnpm vitest run tests/prices-text.test.ts` — expected: FAIL, module not found.
- [ ] **Step 3: Implement** `types.ts` as above and the two functions in `text.ts`. `normalizeTitle`: lowercase, `ё`→`е`, every character that is not a letter or digit (Unicode-aware) becomes a space, collapse spaces, trim.
- [ ] **Step 4: Run** the same command — expected: PASS.
- [ ] **Step 5: Commit** `feat: price text helpers and shared types`.

---

### Task 2: Robots rules and polite fetcher

**Files:**
- Create: `lib/prices/robots.ts`, `lib/prices/http.ts`
- Test: `tests/prices-robots.test.ts`, `tests/prices-http.test.ts`
- Fixtures: `tests/fixtures/prices/robots-gaga.txt`, `robots-lavkaigr.txt`, `robots-crowdgames.txt`

**Interfaces — Produces:**

```ts
// lib/prices/robots.ts
export function isAllowedByRobots(robotsTxt: string, pathWithQuery: string): boolean; // rules of the "User-agent: *" group only

// lib/prices/http.ts
export function buildUserAgent(infoUrl?: string): string;
export class ShopBlockedError extends Error { status: number; url: string }
export function createShopGet(opts: {
  origin: string;
  userAgent: string;
  minIntervalMs?: number;                 // default 2000
  fetchImpl?: typeof fetch;               // default globalThis.fetch
  sleep?: (ms: number) => Promise<void>;  // injectable for tests
  now?: () => number;
}): Get;
```

- [ ] **Step 1: Save the three real `robots.txt` files** as fixtures: `curl -sS https://gaga.ru/robots.txt`, `https://www.lavkaigr.ru/robots.txt`, `https://www.crowdgames.ru/robots.txt`.
- [ ] **Step 2: Write the failing robots tests**

```ts
it("gaga: product pages allowed, anything with a query string disallowed", () => {
  expect(isAllowedByRobots(gaga, "/game/citadels-classic/")).toBe(true);
  expect(isAllowedByRobots(gaga, "/nastolnie-igri/?page=2")).toBe(false);
  expect(isAllowedByRobots(gaga, "/game/citadels-classic/otzyvy")).toBe(false);
  expect(isAllowedByRobots(gaga, "/sitemap.xml")).toBe(true);
});
it("lavkaigr: shop listing allowed, ajax and games disallowed", () => {
  expect(isAllowedByRobots(lavka, "/shop/?page=3")).toBe(true);
  expect(isAllowedByRobots(lavka, "/ajax/cart")).toBe(false);
  expect(isAllowedByRobots(lavka, "/shop/strategicheskie/tirany-podzemya/")).toBe(false);
});
it("crowdgames: collection json allowed, search and $-anchored rules respected", () => {
  expect(isAllowedByRobots(crowd, "/collection/all.json?page=2")).toBe(true);
  expect(isAllowedByRobots(crowd, "/search?q=x")).toBe(false);
  expect(isAllowedByRobots(crowd, "/collection/arhiv")).toBe(false);
  expect(isAllowedByRobots(crowd, "/collection/arhiv-2")).toBe(true);
});
it("the longest matching rule wins, Allow beating Disallow on a tie", () => {
  expect(isAllowedByRobots("User-agent: *\nDisallow: /a\nAllow: /a/b", "/a/b/c")).toBe(true);
});
```

If a real fixture contradicts an expectation above (the files change), trust the fixture and fix the expectation, keeping one allowed and one disallowed case per shop.

- [ ] **Step 3: Write the failing fetcher tests** with a fake `fetchImpl`, `sleep` and `now`:
  - two consecutive calls are at least 2000 ms apart (assert the `sleep` argument);
  - two calls started concurrently still run one after the other;
  - a disallowed URL rejects without calling `fetchImpl` beyond the single `robots.txt` request, and `robots.txt` is fetched once and reused;
  - a request for another origin rejects;
  - the `User-Agent` header equals `buildUserAgent(...)`; `buildUserAgent()` is `"BggPlayerFinderBot/0.1 (non-commercial price history)"` and `buildUserAgent("https://x.example")` is `"BggPlayerFinderBot/0.1 (non-commercial price history; +https://x.example)"`;
  - status 403 and 429 reject with `ShopBlockedError` carrying the status; other non-2xx statuses reject with a plain `Error` naming status and URL;
  - `{ encoding: "windows-1251" }` decodes the bytes `0xD6 0xE8 0xF2 0xE0 0xE4 0xE5 0xEB 0xE8` to `"Цитадели"`.
- [ ] **Step 4: Run** `pnpm vitest run tests/prices-robots.test.ts tests/prices-http.test.ts` — expected: FAIL.
- [ ] **Step 5: Implement** both modules. Robots patterns support `*` and a trailing `$`. No retries in this part.
- [ ] **Step 6: Run** the same command — expected: PASS.
- [ ] **Step 7: Commit** `feat: robots-aware polite fetcher for shops`.

---

### Task 3: CrowdGames adapter

**Files:**
- Create: `lib/prices/shops/crowdgames.ts`
- Test: `tests/prices-crowdgames.test.ts`
- Fixture: `tests/fixtures/prices/crowdgames-page.json`

**Interfaces:**
- Consumes: `ShopProduct`, `ShopAdapter`, `Get`, `parseRubles`.
- Produces: `parseCrowdgamesPage(json: string): { count: number; products: ShopProduct[] }`, `crowdgamesAdapter: ShopAdapter` (origin `https://www.crowdgames.ru`).

Source facts: `GET /collection/all.json?page=N` returns `{ status, count, products }`, 100 products per page. Per product: `id`, `title`, `permalink`, `available`, `variants[]` with `price` (string like `"1190.0"`), `old_price`, `quantity`, `sku`, `barcode`. Product URL is `https://www.crowdgames.ru/product/<permalink>`.

- [ ] **Step 1: Build the fixture.** Fetch page 1 and keep four real products, deleting the rest and all image and description fields: one in stock, one with `available: false`, one whose variant has a non-null `old_price`, one with two or more variants. If the live catalogue has no example of the last two, copy a real product and edit only those fields, and say so in a `_note` field of the fixture. Set `count` to 4.
- [ ] **Step 2: Write the failing tests**
  - the in-stock product maps to `{ shop: "crowdgames", externalId: String(id), url, title, barcode, price, oldPrice: null, available: true, variantCount: 1, vendor: null }` with the fixture's exact values;
  - the unavailable product has `available: false` and still has its price;
  - the old-price product has `oldPrice` as an integer;
  - the multi-variant product has `variantCount` equal to its variant count and `price: null`;
  - `parseCrowdgamesPage("<html>blocked</html>")` and `parseCrowdgamesPage('{"status":"ok"}')` throw an error containing `"unrecognised"`;
  - `crowdgamesAdapter.listCatalog` with a fake `Get` requests `?page=1`, `?page=2`, … until it has `count` products or a page comes back empty, and throws if page 1 has no products.
- [ ] **Step 3: Run** `pnpm vitest run tests/prices-crowdgames.test.ts` — expected: FAIL.
- [ ] **Step 4: Implement.**
- [ ] **Step 5: Run** — expected: PASS.
- [ ] **Step 6: Commit** `feat: crowdgames catalogue adapter`.

---

### Task 4: Lavka Igr adapter

**Files:**
- Create: `lib/prices/shops/lavkaigr.ts`
- Modify: `package.json` (add `node-html-parser`)
- Test: `tests/prices-lavkaigr.test.ts`
- Fixture: `tests/fixtures/prices/lavkaigr-listing.html`

**Interfaces — Produces:** `parseLavkaListing(html: string): { products: ShopProduct[]; lastPage: number }`, `lavkaigrAdapter: ShopAdapter` (origin `https://www.lavkaigr.ru`).

Source facts: `GET /shop/?page=N`, about 35 products per page, about 130 pages. Each product is a `div.block` inside `div.product-list`:

```html
<div class="block"><div>
  <div class="photo-block" data-id="16572"><a href="/shop/aksessuary/zver-playmat-ostov/" class="photo">…</a></div>
  <h3><a class="game-name" href="/shop/aksessuary/zver-playmat-ostov/">Зверь. Расколотые острова. Плеймат</a></h3>
  <p class="price">2 790 руб.</p>
  <div class="bottom"><a href="#" data-id="16572" data-price="2790" class="btn buy-mini">Купить</a> …</div>
</div></div>
```

Pagination links are `href="?page=N"`. How an out-of-stock product looks in the listing was not checked.

- [ ] **Step 1:** `pnpm add -E node-html-parser`.
- [ ] **Step 2: Build the fixture.** Save `https://www.lavkaigr.ru/shop/?page=1`, keep the `product-list` wrapper with three product blocks and the pagination block, delete the rest. Then page through the live listing by hand until you find a block without a `buy-mini` button (out of stock or pre-order) and add it as a fourth block. If ten pages show none, add nothing and record that in a comment at the top of the fixture.
- [ ] **Step 3: Write the failing tests**
  - a block maps to `{ shop: "lavkaigr", externalId: "16572", url: "https://www.lavkaigr.ru/shop/aksessuary/zver-playmat-ostov/", title: "Зверь. Расколотые острова. Плеймат", price: 2790, available: true, oldPrice: null, vendor: null, barcode: null, variantCount: 1 }` (use the fixture's real first block);
  - `price` comes from `data-price`; when there is no buy button, `available` is `false` and `price` comes from `p.price` through `parseRubles`;
  - `lastPage` is the largest `?page=N` in the fixture;
  - HTML without `div.product-list` throws an error containing `"unrecognised"`;
  - `listCatalog` with a fake `Get` walks pages 1 to `lastPage`, stops early at a page with zero products, honours `opts.limit` as a maximum page count, and de-duplicates by `externalId`.
- [ ] **Step 4: Run** `pnpm vitest run tests/prices-lavkaigr.test.ts` — expected: FAIL.
- [ ] **Step 5: Implement.**
- [ ] **Step 6: Run** — expected: PASS.
- [ ] **Step 7: Commit** `feat: lavka igr catalogue adapter`.

---

### Task 5: GaGa adapter

**Files:**
- Create: `lib/prices/shops/gaga.ts`, `lib/prices/shops/index.ts`
- Test: `tests/prices-gaga.test.ts`
- Fixtures: `tests/fixtures/prices/gaga-sitemap.xml`, `gaga-product-instock.html`, `gaga-product-waitlist.html` (both product pages saved as raw cp1251 bytes)

**Interfaces — Produces:**

```ts
export function parseGagaSitemap(xml: string): string[];                         // absolute /game/<slug>/ URLs only
export function parseGagaProduct(html: string, url: string): ShopProduct | null; // null when the page is not a product
export const gagaAdapter: ShopAdapter;                                            // origin https://gaga.ru
// lib/prices/shops/index.ts
export const shopAdapters: ShopAdapter[];                                         // crowdgames, lavkaigr, gaga
```

Source facts: the sitemap at `/sitemap.xml` lists about 5,700 `https://gaga.ru/game/<slug>/` URLs among others. Product pages are cp1251. The buy button carries everything needed:

```html
<button type="button" class=" btn btn--basket add_to_cart" data-gid="6171" data-price="8990" data-name="Зверь" data-vendor="GaGa Games" data-category="Настольные игры Гага">
```

An unavailable product has `class=" btn add_to_waitlist"` with the same data attributes (example: `/game/citadels-classic/`). The page also has `<span itemprop="price">990</span>`. Paging the catalogue with query strings is disallowed by `robots.txt`, which is why the catalogue comes from the sitemap.

- [ ] **Step 1: Build the fixtures.** Save `/game/citadels-classic/` (waitlist) and one in-stock product page with `curl -sS -o`, unmodified bytes. Trim the sitemap to ten `<url>` entries: six `/game/` ones and four others (`/news/…`, `/catalog/…`, the home page).
- [ ] **Step 2: Write the failing tests** (decode fixtures with `new TextDecoder("windows-1251")`)
  - `parseGagaSitemap` returns exactly the six `/game/` URLs;
  - the in-stock page maps to `externalId` = `data-gid`, `title` = trimmed `data-name`, `vendor` = `data-vendor`, `price` = `data-price`, `available: true`, `url` as passed, `barcode: null`, `oldPrice: null`, `variantCount: 1`;
  - the waitlist page has `available: false` and `title: "Цитадели"`;
  - a page with neither button returns `null`;
  - `listCatalog` with a fake `Get`: reads the sitemap, requests product pages with `{ encoding: "windows-1251" }`, skips URLs already present in `opts.known` and returns those known products unchanged alongside the new ones, stops after `opts.limit` new pages, calls `opts.onProgress`, and throws an error containing `"unrecognised"` when the sitemap yields no `/game/` URLs.
- [ ] **Step 3: Run** `pnpm vitest run tests/prices-gaga.test.ts` — expected: FAIL.
- [ ] **Step 4: Implement**, and export `shopAdapters` from `lib/prices/shops/index.ts`.
- [ ] **Step 5: Run** — expected: PASS.
- [ ] **Step 6: Commit** `feat: gaga catalogue adapter`.

---

### Task 6: Game names from BGG and Tesera

**Files:**
- Create: `lib/prices/names.ts`, `lib/prices/tesera.ts`
- Test: `tests/prices-names.test.ts`, `tests/prices-tesera.test.ts`
- Fixtures: `tests/fixtures/prices/tesera-search-wingspan.json`, `tesera-game-wingspan.json`

**Interfaces — Produces:**

```ts
// lib/prices/names.ts
export function alternateNamesByGame(thingXml: string): Map<number, string[]>; // every <name> value of each <item>, primary first
export function mergeNames(bggId: number, primaryName: string, ...sources: string[][]): GameNames; // de-duplicates by normalizeTitle, keeps first spelling

// lib/prices/tesera.ts
export type TeseraNames = { alias: string; names: string[] };
export async function findTeseraNames(get: Get, game: { bggId: number; primaryName: string }): Promise<TeseraNames | null>;
```

Source facts:
- The cached BGG XML (`games.raw_xml` in `data/bgg-cache.sqlite`) is the whole 20-item batch response, the same text on every row of the batch. Each `<item id="…">` has `<name type="primary" value="…"/>` and many `<name type="alternate" value="…"/>`, including Russian ones. All 500 cached games have at least one Cyrillic alternate name.
- Tesera (`https://api.tesera.ru`): `GET /search/games?query=<name>&limit=30` returns an array of `{ alias, title, title2, … }` with no `bggId`. `GET /games/<alias>` returns `{ game: { bggId, title, title2, title3, alias, … } }`; `title` is Russian, `title2` the original, `title3` a comma-separated list of other names. A search for "Wingspan" returns nine results; the right one has alias `wingspan` and title "Крылья".

- [ ] **Step 1: Save the fixtures** from the two Tesera URLs above for Wingspan (BGG ID 266192), trimming the game response to the `game` object's `bggId`, `alias`, `title`, `title2`, `title3`.
- [ ] **Step 2: Write the failing tests**
  - `alternateNamesByGame` on a two-item XML string written inline returns each item's names under its own ID, primary first, and nothing leaks between items;
  - `mergeNames(1, "Wingspan", ["Крылья", "wingspan"], ["КРЫЛЬЯ"])` gives `names: ["Wingspan", "Крылья"]`;
  - `findTeseraNames` with a fake `Get` serving the fixtures returns `{ alias: "wingspan", names: ["Крылья", "Wingspan", …title3 parts] }`;
  - it requests game details for at most 5 search results, in search order, and returns the first whose `bggId` equals the game's;
  - it returns `null` when no detail has the right `bggId`, and when the search is empty;
  - a result with `bggId: 0` is never accepted.
- [ ] **Step 3: Run** `pnpm vitest run tests/prices-names.test.ts tests/prices-tesera.test.ts` — expected: FAIL.
- [ ] **Step 4: Implement.** Parse XML with `fast-xml-parser` directly; do not import from `lib/bgg/parser.ts`.
- [ ] **Step 5: Run** — expected: PASS.
- [ ] **Step 6: Commit** `feat: game name sources for shop matching`.

---

### Task 7: Matcher

**Files:**
- Create: `lib/prices/match.ts`
- Test: `tests/prices-match.test.ts`

**Interfaces:**
- Consumes: `GameNames`, `ShopProduct`, `ShopCode`, `normalizeTitle`.
- Produces:

```ts
export const stopWords: readonly string[];
export type LinkReason =
  | "exact-title"          // confirmed
  | "several-products"     // title rule met by more than one product in the shop
  | "claimed-by-several-games"
  | "title-contains-name"
  | "barcode";
export type Link = { bggId: number; shop: ShopCode; externalId: string; status: "confirmed" | "candidate"; reason: LinkReason };
export function matchProducts(games: GameNames[], products: ShopProduct[]): Link[]; // products may mix shops
```

Rules, all on `normalizeTitle` output and whole-word tokens:

- **Title rule.** The product title equals one of the game's names, or equals two different names of the game joined by a space, in either order ("apiary апиарий").
- **Stop words.** Initial list: `дополнение`, `доп`, `expansion`, `расширение`, `промо`, `promo`, `протекторы`, `органайзер`, `плеймат`, `playmat`, `коврик`, `предзаказ`, `набор`, `миниатюры`, `аксессуар`. A product title containing a stop word as a token is ignored for a game, unless that same token occurs in the name being compared.
- **Never matched:** products with `variantCount > 1`.
- **Confirmed** (`exact-title`): title rule holds, no stop word, it is the only such product for that game in that shop, and no other game's title rule holds for the same product.
- **Candidates:**
  - title rule holds but several products qualify in the shop → each is `several-products`;
  - title rule holds for more than one game → `claimed-by-several-games` for each game;
  - the title contains one of the game's names as consecutive whole tokens, that name is at least 5 characters long after normalisation, and there is no stop word → `title-contains-name`;
  - the product's barcode equals the barcode of a product confirmed for that game in a different shop → `barcode`.
- **Cap.** At most 5 candidates per game per shop, keeping the shortest titles; `barcode` candidates are kept ahead of the others.
- A product confirmed for a game is not also a candidate for another game.

- [ ] **Step 1: Write the failing tests**, each with small inline games and products:
  - exact Russian title confirms; "Russian (Original)" and "Original (Russian)" confirm;
  - "Крылья. Дополнение Птицы Океании" produces nothing for "Крылья";
  - a game named "Подарочный набор приключений" confirms a product with exactly that title even though "набор" is a stop word, while "Крылья. Подарочный набор" produces nothing for "Крылья";
  - two products with the same qualifying title in one shop → two `several-products` candidates, none confirmed;
  - two games sharing the name "Brass" and one product titled "Brass" → two `claimed-by-several-games` candidates, none confirmed;
  - "Крылья. Юбилейное издание" → `title-contains-name` candidate;
  - a game named "Root" and a product "Root: большая коробка" → nothing (name shorter than 5);
  - "Цитадели" must not match inside "Цитаделина" (whole tokens only);
  - a multi-variant product with an exact title → nothing;
  - the same exact title in two shops confirms in both, independently;
  - a product in shop B with a different title but the barcode of the product confirmed in shop A → `barcode` candidate; a `null` or empty barcode never matches;
  - eight `title-contains-name` products for one game in one shop → the five shortest titles survive.
- [ ] **Step 2: Run** `pnpm vitest run tests/prices-match.test.ts` — expected: FAIL.
- [ ] **Step 3: Implement.** Index products by normalised title and by token so the function stays fast for 500 games against about 11,000 products.
- [ ] **Step 4: Run** — expected: PASS.
- [ ] **Step 5: Commit** `feat: conservative game-to-product matcher`.

---

### Task 8: Local dry run and report

**Files:**
- Create: `scripts/prices-dry-run.ts`, `lib/prices/report.ts`
- Modify: `package.json` (add `tsx` dev dependency and the `prices:dry-run` script), `README.md` (a short "Price dry run" section)
- Test: `tests/prices-report.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces:

```ts
// lib/prices/report.ts
export type ShopOutcome = { shop: ShopCode; products: ShopProduct[] } | { shop: ShopCode; error: string };
export type DryRunReport = {
  games: number;
  gamesWithConfirmed: number;
  gamesWithOnlyCandidates: number;
  gamesWithNothing: number;
  shops: { shop: ShopCode; error: string | null; products: number; confirmed: number; candidates: number }[];
  sample: { game: string; shop: ShopCode; title: string; price: number | null; url: string }[]; // up to 20 confirmed links
};
export function buildReport(games: GameNames[], outcomes: ShopOutcome[], links: Link[], pickSample?: <T>(items: T[], n: number) => T[]): DryRunReport;
export function formatReport(report: DryRunReport): string;
```

Script behaviour (`pnpm prices:dry-run [--shops crowdgames,lavkaigr,gaga] [--refresh] [--gaga-limit N] [--no-tesera]`):

- Opens `data/bgg-cache.sqlite` read-only with `better-sqlite3` and reads `bgg_id`, `title`, `raw_xml` from `games`. Exits with a clear message if the file is missing.
- Builds `GameNames` from the cached XML. Unless `--no-tesera`, adds Tesera names, at the same 2-second spacing, caching each answer (including "not found") in `data/price-cache/tesera.json` so a second run makes no Tesera requests.
- For each selected shop, loads `data/price-cache/<shop>.json` if present and `--refresh` is absent; otherwise runs the adapter and writes that file. GaGa always passes the cached products as `known`, so an interrupted or limited crawl resumes; its file is rewritten every 50 pages.
- Shops run one after another. A shop that throws becomes a `ShopOutcome` with `error`; the run continues.
- Runs `matchProducts` over all products, prints `formatReport`, writes `data/price-cache/report.json` and `data/price-cache/links.json`, and exits 1 if any shop failed, 0 otherwise.
- `data/` is already ignored by git.

- [ ] **Step 1:** `pnpm add -DE tsx` and add `"prices:dry-run": "tsx scripts/prices-dry-run.ts"` to `package.json`.
- [ ] **Step 2: Write the failing tests** for `buildReport` and `formatReport`
  - three games, two shops: one game confirmed in both shops, one with only a candidate, one with nothing → `gamesWithConfirmed: 1`, `gamesWithOnlyCandidates: 1`, `gamesWithNothing: 1`, and per-shop counts as constructed;
  - a shop outcome with `error` appears with that error, `products: 0`, and does not throw;
  - `sample` holds only confirmed links, at most 20, each with the game's primary name and the product's title, price and URL;
  - `formatReport` output contains each shop code, the three game counts, and the word "FAILED" next to a failed shop.
- [ ] **Step 3: Run** `pnpm vitest run tests/prices-report.test.ts` — expected: FAIL.
- [ ] **Step 4: Implement** `lib/prices/report.ts` and the script.
- [ ] **Step 5: Run** `pnpm vitest run` and `pnpm typecheck` — expected: all tests pass, no type errors.
- [ ] **Step 6: Run it for real, small first.** Copy or symlink the main checkout's `data/bgg-cache.sqlite` into this worktree's `data/` if it is absent, then:

```bash
pnpm prices:dry-run --shops crowdgames,lavkaigr --no-tesera
```

Expected: both shops report a non-zero product count (CrowdGames near 176, Lavka Igr in the thousands), a report prints, exit code 0. If a shop reports `ShopBlockedError`, stop and tell the owner; do not change the User-Agent or add workarounds.

- [ ] **Step 7: Run with Tesera and a GaGa slice.**

```bash
pnpm prices:dry-run --gaga-limit 200
```

Expected: Tesera cache file written, GaGa reports about 200 products, exit code 0. The full GaGa crawl (about 3 hours) is the owner's decision; do not start it unasked.

- [ ] **Step 8: Spot-check.** Open every link in the report's `sample` and compare the shop page to the game. Record in the hand-back how many of the sampled confirmed links were right. Any wrong one is a matcher bug: add a failing test to `tests/prices-match.test.ts` reproducing it, fix, re-run.
- [ ] **Step 9: Document** the command and its flags in `README.md`, and commit `feat: local price dry run and match report`.

---

## Not in this plan (part 2, after the deployment and redesign branches merge)

Postgres tables and change-only price history, the daily Modal schedule and the reachability spike from Modal, reading a single product's current offer for Lavka Igr, the review command, the "Цена" column, the expandable row and chart, stale-shop greying, and the sale marker.
