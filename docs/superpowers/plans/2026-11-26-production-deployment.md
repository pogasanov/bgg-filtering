# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run the existing BGG player-count finder as a public site on Vercel Hobby, with data in Neon Postgres, a weekly BGG sync on Modal, and errors and logs in Sentry, at $0 per month.

**Architecture:**
- SQLite is replaced by Postgres behind a tiny `Db` interface. It has a `pg` adapter for production and a PGlite adapter for tests.
- The page reads the catalog through `unstable_cache`, tagged `bgg-catalog`, and is revalidated on demand by a secret-protected route.
- The sync becomes a Node entrypoint bundled with esbuild and run by a thin Python Modal app on a weekly cron.
- The list of games to sync comes from a local `bgg:import-ranks` command.

**Tech Stack:**
- Site: Next.js 16 (App Router), React 19, TypeScript.
- Database: `pg` (node-postgres), with `@electric-sql/pglite` for tests.
- Tooling: vitest, tsx, esbuild, pnpm.
- Services: Modal (Python app wrapping Node 22), `@sentry/nextjs` and `@sentry/node`.

**Spec:** `docs/superpowers/specs/2026-11-26-production-deployment-design.md`

## Global Constraints

- **No database query on an ordinary page view.** The page renders through `unstable_cache` with `revalidate: 86400` and tag `bgg-catalog`. The page has `export const revalidate = 86400`.
- **No public endpoint may cause requests to BGG.** `app/api/sync`, `app/api/games` and `app/api/status` are deleted.
- **Secrets stay server-side and out of git:** `BGG_TOKEN`, `DATABASE_URL` and `REVALIDATE_SECRET` never reach client code or git. Only `NEXT_PUBLIC_SENTRY_DSN` is exposed to the browser.
- **BGG XML API rules:** at most 20 IDs per `thing` request, at least 5200 ms between request starts, `Authorization: Bearer <BGG_TOKEN>`, base URL `https://boardgamegeek.com` (no `www`).
- **What is not persisted:** raw XML and game descriptions.
- **Which games the site shows:** games that are in `ranked_games` **and** have a row in `games`.
- **Sync run statuses:** `running`, `success`, `partial`, `error`. "Updated" on the site means `finished_at` of the latest `success` or `partial` run.
- **Weekly schedule:** cron `0 3 * * 1`, UTC. The Sentry monitor slug is `bgg-weekly-sync`.
- **Dedicated accounts:** every service uses this project's own personal account. Tooling never relies on the active global CLI login.
  - Modal commands run with `MODAL_PROFILE=bgg`.
  - Vercel commands go through `pnpm vc …`, which requires `VERCEL_TOKEN` and passes `--token`.
  - Sentry and Neon credentials come only from env.
- **Sentry quotas:** `tracesSampleRate: 0`, no session replay, `sendDefaultPii: false`. The free plan allows 5k errors, 5 GB logs and 1 cron monitor.
- **Dependency versions:** pinned exactly (no `latest`, `^` or `~`). pnpm is the only package manager.
- **Language:** UI copy stays in English.
- **Database size warning:** the worker warns in Sentry when `pg_database_size` is above 800 MiB (838860800 bytes).

## Review Focus

1. **A worker that dies mid-run leaves `sync_lock` behind.** The next week's run must take over a lock older than 6 hours, mark the stuck run `error`, and proceed. (Task 3)
2. **The "Updated" date must render identically on server and client** regardless of the visitor's locale or timezone. Otherwise the ISR page hydrates with a mismatch. It is formatted as `YYYY-MM-DD` in UTC. (Task 7)
3. **`REVALIDATE_SECRET` unset on the server:** `/api/revalidate` must reject every request and never fall open. (Task 7)
4. **A database write failing for one batch** (not only a fetch failure) counts as that batch failing. The run continues, ends `partial`, and the lock is released. (Task 5)
5. **An import of a CSV with zero ranked base games fails** before touching the database, and the existing list stays intact. (Task 6)

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/db/client.ts` | `Db` interface, `pg` adapter, lazy pool from `DATABASE_URL` |
| `lib/db/migrate.ts` | Apply `db/migrations/*.sql` once each, tracked in `schema_migrations` |
| `db/migrations/0001_init.sql` | Postgres schema |
| `lib/catalog/types.ts` | `CatalogStatus`, `Catalog`, `SyncRunResult` |
| `lib/catalog/store.ts` | All SQL for ranked list, games, sync runs, catalog read, database size |
| `lib/catalog/load.ts` | Cached catalog loader for the site, `CATALOG_TAG` |
| `lib/bgg/client.ts` | `fetchThingBatch` with retries (replaces `fetchGameDetails`) |
| `lib/bgg/import-ranks.ts` | `importRanks` (CSV to `ranked_games`) |
| `lib/sync.ts` | `runSync` batch loop with partial-failure handling, `withRankFallback` |
| `lib/worker/run-weekly-sync.ts` | Sync, then revalidate/warm, size check, exit code |
| `lib/worker/revalidate.ts` | HTTP call to `/api/revalidate` |
| `worker/sync-entry.ts` | Node entrypoint: env, Sentry, monitor, process exit |
| `worker/modal_app.py` | Modal image, secret, cron, subprocess call |
| `scripts/migrate.ts`, `scripts/import-ranks.ts` | CLI wrappers |
| `app/api/revalidate/route.ts` | Secret-checked revalidation |
| `app/api/sentry-check/route.ts` | Secret-checked deliberate error for verifying Sentry |
| `instrumentation.ts`, `instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `app/global-error.tsx` | Site Sentry |
| `tests/helpers/test-db.ts` | PGlite-backed `Db` with migrations applied |
| `vercel.json` | `{"regions": ["fra1"]}` |

Deleted:
- `lib/cache/store.ts`
- `app/api/sync/route.ts`, `app/api/games/route.ts`, `app/api/status/route.ts`
- `tests/cache-store.test.ts`
- `package-lock.json`

---

### Task 1: Pin dependencies and use pnpm only

**Files:**
- Modify: `package.json`
- Delete: `package-lock.json`
- Modify: `pnpm-lock.yaml` (regenerated)

**Interfaces:** none.

- [ ] **Step 1: Pin every dependency in `package.json` to the exact version resolved in `pnpm-lock.yaml`**

  Versions to pin:
  - `@tailwindcss/postcss` 4.3.3
  - `better-sqlite3` 13.0.1 (removed in Task 7)
  - `class-variance-authority` 0.7.1
  - `clsx` 2.1.1
  - `fast-xml-parser` 5.10.1
  - `lucide-react` 1.25.0
  - `next` 16.2.10
  - `radix-ui` 1.6.4
  - `react` 19.2.7
  - `react-dom` 19.2.7
  - `shadcn` 4.14.0
  - `tailwind-merge` 3.6.0
  - `tailwindcss` 4.3.3
  - `tw-animate-css` 1.4.0
  - `@types/better-sqlite3` 7.6.13
  - `@types/node` 26.1.1
  - `@types/react` 19.2.17
  - `@types/react-dom` 19.2.3
  - `typescript` 5.9.3
  - `vitest` 4.1.10

  Also add `"packageManager": "pnpm@11.6.0"`.

- [ ] **Step 2: Delete `package-lock.json` and run `pnpm install`**

  Run: `pnpm install`
  Expected: it completes. `git diff pnpm-lock.yaml` shows only specifier changes (`latest` → the version). No resolved version changes.

- [ ] **Step 3: Verify**

  Run: `pnpm test && pnpm typecheck`
  Expected: all tests pass, no type errors.

- [ ] **Step 4: Commit**

  ```bash
  git add package.json pnpm-lock.yaml && git rm package-lock.json
  git commit -m "chore: pin dependencies and use pnpm only"
  ```

### Task 2: Postgres access layer and migrations

**Files:**
- Create: `lib/db/client.ts`
- Create: `lib/db/migrate.ts`
- Create: `db/migrations/0001_init.sql`
- Create: `scripts/migrate.ts`
- Create: `tests/helpers/test-db.ts`
- Test: `tests/db-migrate.test.ts`
- Modify: `package.json` (deps, `db:migrate` script)
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces, in `lib/db/client.ts`:
  ```ts
  export interface Db {
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
    exec(sql: string): Promise<void>;                        // multi-statement, no params
    transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;  // nested call runs fn(tx) inline
  }
  export function createPgDb(pool: import("pg").Pool): Db;
  export function hasDatabaseUrl(): boolean;
  export function getDb(): Db; // lazy singleton Pool from DATABASE_URL; throws "DATABASE_URL is not set" if missing
  ```
- Produces, in `lib/db/migrate.ts`:
  ```ts
  export async function runMigrations(db: Db, dir?: string): Promise<string[]>; // default dir "db/migrations"; returns applied file names
  ```
- Produces, in `tests/helpers/test-db.ts`:
  ```ts
  export async function createTestDb(): Promise<{ db: Db; close(): Promise<void> }>; // in-memory PGlite, migrations applied
  ```

- [ ] **Step 1: Add dependencies with exact versions**

  Run: `pnpm add -E pg && pnpm add -D -E @types/pg @electric-sql/pglite tsx`
  Set `test.testTimeout` and `test.hookTimeout` to 20000 in `vitest.config.ts` (PGlite start-up).

- [ ] **Step 2: Write the failing test `tests/db-migrate.test.ts`**

  ```ts
  test("applies the init migration once and creates every table", async () => {
    const { db, close } = await createTestDb(); // already ran migrations
    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1");
    expect(tables.map((t) => t.table_name)).toEqual([
      "game_languages", "game_tags", "games", "player_recommendations",
      "ranked_games", "schema_migrations", "sync_lock", "sync_runs"]);
    expect(await runMigrations(db)).toEqual([]); // second run applies nothing
    await close();
  });
  ```

- [ ] **Step 3: Run the test to verify it fails**

  Run: `pnpm vitest run tests/db-migrate.test.ts`
  Expected: FAIL (modules not found).

- [ ] **Step 4: Write `db/migrations/0001_init.sql`**

  - **`ranked_games`:** `bgg_id integer PK`, `rank integer NOT NULL`, `title text NOT NULL`, `year integer`, `geek_rating double precision`, `average_rating double precision`, `num_voters integer`, `imported_at timestamptz NOT NULL`. Index on `rank`.
  - **`games`:** `bgg_id integer PK`, `rank integer`, `title text NOT NULL`, `year integer`, `geek_rating`/`average_rating`/`weight double precision`, `num_voters`/`min_players`/`max_players`/`playing_time integer`, `bgg_url text NOT NULL`, `updated_at timestamptz NOT NULL`. Index on `rank`. **No `description` and no `raw_xml`.**
  - **`game_tags`, `game_languages`, `player_recommendations`:** the same columns, keys, `CHECK` and `ON DELETE CASCADE` foreign keys as in `lib/cache/store.ts:100-131`, plus the same indexes.
  - **`sync_runs`:** `id serial PK`, `started_at timestamptz NOT NULL`, `finished_at timestamptz`, `status text NOT NULL CHECK (status IN ('running','success','partial','error'))`, `fetched_count integer NOT NULL DEFAULT 0`, `failed_ids integer[] NOT NULL DEFAULT '{}'`, `error_message text`.
  - **`sync_lock`:** `id integer PK CHECK (id = 1)`, `sync_run_id integer NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE`, `locked_at timestamptz NOT NULL`.

- [ ] **Step 5: Implement `lib/db/client.ts`, `lib/db/migrate.ts` and `tests/helpers/test-db.ts`**

  - **`createPgDb`:**
    - `query` uses `pool.query` and returns `rows`.
    - `exec` runs the SQL text with no params (simple protocol allows multiple statements).
    - `transaction` checks out a client, runs `BEGIN`/`COMMIT`/`ROLLBACK`, and passes a `Db` bound to that client.
  - **`getDb`:** creates `new Pool({ connectionString, max: 3, idleTimeoutMillis: 5000 })` once.
  - **`runMigrations`:**
    - Creates `schema_migrations(name text PK, applied_at timestamptz NOT NULL DEFAULT now())`.
    - Applies each `*.sql` file not yet recorded, in filename order, each inside its own transaction.
  - **Test helper:** wraps `new PGlite()`. `query` maps to `pg.query(text, params).rows`, `exec` to `pg.exec`, `transaction` to `pg.transaction`.

- [ ] **Step 6: Run the test to verify it passes**

  Run: `pnpm vitest run tests/db-migrate.test.ts`
  Expected: PASS.

- [ ] **Step 7: Add the CLI script and package entry**

  - `scripts/migrate.ts` calls `runMigrations(getDb())`, prints the applied names, and ends the pool.
  - In `package.json`: `"db:migrate": "tsx --env-file-if-exists=.env.local scripts/migrate.ts"`.

- [ ] **Step 8: Commit**

  ```bash
  git add lib/db db/migrations scripts/migrate.ts tests/helpers tests/db-migrate.test.ts package.json pnpm-lock.yaml vitest.config.ts
  git commit -m "feat: add postgres access layer and migrations"
  ```

### Task 3: Catalog store on Postgres

**Files:**
- Create: `lib/catalog/types.ts`
- Create: `lib/catalog/store.ts`
- Test: `tests/catalog-store.test.ts`
- Modify: `lib/bgg/types.ts` (remove `description` from `NormalizedGame`)
- Modify: `lib/bgg/parser.ts` (stop reading `description`)
- Modify: `tests/bgg-parser.test.ts`, `tests/filters.test.ts`, `tests/bgg-app.test.ts` (drop `description` from fixtures and expectations)

**Interfaces:**
- Consumes: `Db` and `createTestDb` (Task 2), `TopRankItem` and `NormalizedGame` (`lib/bgg/types.ts`).
- Produces, in `lib/catalog/types.ts`:
  ```ts
  export type CatalogStatus = { gameCount: number; updatedAt: string | null }; // ISO string
  export type Catalog = { games: NormalizedGame[]; status: CatalogStatus };
  export type SyncRunResult = { status: "success" | "partial" | "error"; fetchedCount: number; failedIds: number[]; errorMessage: string | null };
  export const EMPTY_CATALOG: Catalog; // { games: [], status: { gameCount: 0, updatedAt: null } }
  ```
- Produces, in `lib/catalog/store.ts`:
  ```ts
  export async function replaceRankedGames(db: Db, items: TopRankItem[], importedAt: Date): Promise<{ ranked: number; removedGames: number }>;
  export async function getRankedGames(db: Db): Promise<TopRankItem[]>; // ordered by rank
  export async function upsertGames(db: Db, games: NormalizedGame[], updatedAt: Date): Promise<void>;
  export async function tryStartSync(db: Db, now: Date, staleAfterMs?: number): Promise<{ started: true; syncRunId: number } | { started: false; syncRunId: null }>; // default staleAfterMs 6 h
  export async function finishSync(db: Db, syncRunId: number, result: SyncRunResult, now: Date): Promise<void>;
  export async function getCatalog(db: Db): Promise<Catalog>;
  export async function getDatabaseSizeBytes(db: Db): Promise<number>;
  ```

- [ ] **Step 1: Write failing tests in `tests/catalog-store.test.ts`**

  Use a fixture `game(id)` shaped like today's `tests/cache-store.test.ts` fixture, without `description`. Each test uses its own `createTestDb()`.
  - `"shows only ranked games that have details"`: rank ids 1 and 2, upsert game 1 and game 3. `getCatalog().games.map(g => g.id)` equals `[1]`, and `status.gameCount` is `1`.
  - `"round-trips tags, languages and recommendations"`: categories `["Adventure"]`, mechanics `["Worker Placement"]`, languages `["English","French"]`, and `playerRecommendations["2"].verdict === "best"`.
  - `"replaces languages on update"`: upsert with `["English","French"]`, then `["German"]`. The result is `["German"]`.
  - `"replaceRankedGames removes games that left the list"`:
    - Setup: rank `[1,2]`, upsert both, then `replaceRankedGames` with `[2]`.
    - Expected return: `{ ranked: 1, removedGames: 1 }`.
    - `select count(*)::int from game_tags where game_id = 1` is `0`.
  - `"tryStartSync refuses while a fresh lock is held"`: the second call within 1 minute returns `{ started: false, syncRunId: null }`.
  - `"tryStartSync takes over a lock older than 6 hours"`:
    - Setup: start at `T`, then start again at `T + 6h + 1s`.
    - The second call is `started: true`.
    - The first run's row has `status = 'error'` and `error_message = 'stale lock released'`.
  - `"finishSync releases the lock and stores failed ids"`: finish with `partial`, `failedIds [5,6]`. `sync_lock` is empty and `failed_ids` equals `[5,6]`.
  - `"updatedAt is the latest success or partial finish"`:
    - Setup: a success finished at `2026-11-30T03:05:00Z`, then an error finished later.
    - `status.updatedAt === "2026-11-30T03:05:00.000Z"`.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/catalog-store.test.ts`
  Expected: FAIL (module not found).

- [ ] **Step 3: Remove `description`**

  Remove `description` from `NormalizedGame` and from `parseThingXml`. Update the three test files that set it.

  Run: `pnpm vitest run tests/bgg-parser.test.ts tests/filters.test.ts`
  Expected: PASS.

- [ ] **Step 4: Implement `lib/catalog/types.ts` and `lib/catalog/store.ts`**

  - **Porting:** port the SQL from `lib/cache/store.ts`. `INSERT OR IGNORE` becomes `ON CONFLICT DO NOTHING`, named params become `$n`, and every `count(*)` is cast `::int`.
  - **`upsertGames`:** runs in one `db.transaction`.
  - **`getCatalog`:**
    - Join `games` with `ranked_games`, order by `COALESCE(games.rank, ranked_games.rank), games.title`.
    - Load tags, languages and recommendations for those ids.
    - `updatedAt` comes from `max(finished_at)` over runs with `status in ('success','partial')`, returned as `toISOString()`.
  - **`tryStartSync`:** in one transaction, do these in order:
    1. Delete a stale lock (`locked_at < now - staleAfterMs`).
    2. Mark its run `error`/`'stale lock released'` with `finished_at = now`.
    3. Insert a `running` run.
    4. `INSERT INTO sync_lock … ON CONFLICT DO NOTHING RETURNING id`.
    5. If nothing was returned, delete the just-inserted run and return not started.

- [ ] **Step 5: Run the tests to verify they pass**

  Run: `pnpm vitest run tests/catalog-store.test.ts`
  Expected: PASS.

- [ ] **Step 6: Commit**

  ```bash
  git add lib/catalog lib/bgg/types.ts lib/bgg/parser.ts tests
  git commit -m "feat: add postgres catalog store"
  ```

### Task 4: BGG batch fetch with retries

**Files:**
- Modify: `lib/bgg/client.ts`
- Test: `tests/bgg-client.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const THING_BATCH_SIZE = 20;
  export const REQUEST_SPACING_MS = 5200;
  export type FetchThingOptions = { fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxAttempts?: number };
  export async function fetchThingBatch(ids: number[], token: string, options?: FetchThingOptions): Promise<NormalizedGame[]>;
  ```
  `fetchGameDetails` is removed.

- [ ] **Step 1: Rewrite `tests/bgg-client.test.ts` with failing tests**

  - `"requests version metadata with game details"`: `fetchThingBatch([1], "test-token", { fetchImpl })` calls `https://boardgamegeek.com/xmlapi2/thing?id=1&stats=1&versions=1` with `Authorization: "Bearer test-token"`.
  - `"retries 503 and then succeeds"`: responses 503, then 200. Two calls, and the parsed game is returned.
  - `"honours Retry-After seconds on 429"`: a 429 with `Retry-After: 7`, then 200. `sleep` is called with `7000`.
  - `"gives up after 3 attempts"`: three 503 responses. It rejects with a message containing `503`, after 3 calls.
  - `"does not retry 400"`: one call, then rejects.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/bgg-client.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `fetchThingBatch`**

  - **Retryable statuses:** `429`, `500`, `502`, `503`, `504`. `maxAttempts` defaults to 3.
  - **Delay between attempts:** `Retry-After` seconds × 1000 when present, otherwise 10000 ms, then 30000 ms.
  - **Unchanged:** the User-Agent header and error format from today's `fetchText`.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `pnpm vitest run tests/bgg-client.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/bgg/client.ts tests/bgg-client.test.ts
  git commit -m "feat: fetch bgg batches with retries"
  ```

### Task 5: Sync orchestration with partial failures

**Files:**
- Modify: `lib/sync.ts` (full rewrite)
- Test: `tests/sync.test.ts`

**Interfaces:**
- Consumes: the store functions (Task 3) and `THING_BATCH_SIZE`/`REQUEST_SPACING_MS` (Task 4).
- Produces:
  ```ts
  export type SyncLog = {
    info(message: string, attributes?: Record<string, unknown>): void;
    warn(message: string, attributes?: Record<string, unknown>): void;
    error(message: string, error: unknown, attributes?: Record<string, unknown>): void;
  };
  export type SyncOutcome = { status: "success" | "partial" | "error" | "skipped"; syncRunId: number | null; fetchedCount: number; failedIds: number[] };
  export type SyncDeps = { db: Db; fetchBatch: (ids: number[]) => Promise<NormalizedGame[]>; log: SyncLog;
    sleep?: (ms: number) => Promise<void>; now?: () => Date; batchSize?: number; spacingMs?: number };
  export function withRankFallback(game: NormalizedGame, item: TopRankItem | undefined): NormalizedGame;
  export async function runSync(deps: SyncDeps): Promise<SyncOutcome>;
  ```

- [ ] **Step 1: Write failing tests in `tests/sync.test.ts`**

  Use PGlite, a fake `fetchBatch` and `sleep: async () => {}`.
  - `"writes every batch and reports success"`: 3 ranked games, `batchSize 2`. Result `{ status: "success", fetchedCount: 3, failedIds: [] }`. `getCatalog` shows 3 games, and `sync_lock` is empty.
  - `"continues past a failed batch and reports partial"`: the batch containing id 3 throws. Result `{ status: "partial", fetchedCount: 2, failedIds: [3] }`, and `log.error` is called once with attributes containing `{ ids: [3] }`.
  - `"a database write failure counts as a failed batch"`: `fetchBatch` returns a game whose `title` is `null as unknown as string` for one batch. The result is `partial`, and the lock is released.
  - `"reports error when no batch succeeds"`: status `error`, `sync_runs.status = 'error'`, and `sync_lock` is empty.
  - `"reports error when no ranked games are imported"`: status `error`, and `error_message = 'No ranked games imported'`.
  - `"skips while another run holds the lock"`: status `skipped`, and `fetchBatch` is never called.
  - `"XML values win and CSV fills gaps"`: `withRankFallback({ …, rank: 5, geekRating: null }, { rank: 9, geekRating: 7.1, … })` gives `rank 5` and `geekRating 7.1`.
  - `"waits the spacing between batches only"`: with 3 batches, `sleep` is called twice, with `5200`.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/sync.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `runSync` and `withRankFallback` in `lib/sync.ts`**

  - **Loop:** start a run, load the ranked list, then loop over batches. Inside each batch's `try`, fetch, apply the fallback and `upsertGames`. On any error, log it with the batch ids and record them as failed.
  - **Outcome:** decided per the Global Constraints, then `finishSync`.
  - **Unexpected errors** (outside a batch) are caught, finished as `error`, and rethrown.
  - **Logging:** `info` for start, each batch and finish, including `fetchedCount`, `failedIds` and `durationMs`.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `pnpm vitest run tests/sync.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/sync.ts tests/sync.test.ts
  git commit -m "feat: sync in batches with partial failure handling"
  ```

### Task 6: Ranks import command

**Files:**
- Create: `lib/bgg/import-ranks.ts`
- Create: `scripts/import-ranks.ts`
- Test: `tests/import-ranks.test.ts`
- Modify: `package.json` (`bgg:import-ranks` script)

**Interfaces:**
- Consumes: `loadTopRankItems(limit, csvPath)` (`lib/bgg/ranks.ts`) and `replaceRankedGames` (Task 3).
- Produces: `export async function importRanks(db: Db, csvPath: string, limit: number, now: Date): Promise<{ ranked: number; removedGames: number }>;`

- [ ] **Step 1: Write failing tests**

  Write a temporary CSV with the header from `tests/bgg-ranks.test.ts`.
  - `"imports the top N ranked base games"`: 3 base games and 1 expansion, `limit 2`. `ranked: 2`, and the rows are ordered by rank.
  - `"refuses a CSV with no ranked base games and keeps the old list"`:
    - Setup: an existing list `[1]`, then a CSV with only expansions.
    - The call rejects with `contains no ranked base games`.
    - `getRankedGames` still returns id 1.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/import-ranks.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `importRanks` and the CLI**

  - **Usage:** `scripts/import-ranks.ts <csv> [--limit N]`. The default limit is 500, and an invalid limit exits 1 with a usage line.
  - **Output:** prints `Imported N ranked games, removed M games.` and ends the pool.
  - **Package entry:** `"bgg:import-ranks": "tsx --env-file-if-exists=.env.local scripts/import-ranks.ts"`.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `pnpm vitest run tests/import-ranks.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add lib/bgg/import-ranks.ts scripts/import-ranks.ts tests/import-ranks.test.ts package.json
  git commit -m "feat: import ranked games from csv"
  ```

### Task 7: Cached site, revalidation route, public UI

**Files:**
- Create: `lib/catalog/load.ts`
- Create: `app/api/revalidate/route.ts`
- Create: `vercel.json`
- Modify: `app/page.tsx`
- Modify: `components/bgg-app.tsx`
- Modify: `next.config.ts`
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Delete: `app/api/sync/route.ts`, `app/api/games/route.ts`, `app/api/status/route.ts`, `lib/cache/store.ts`, `tests/cache-store.test.ts`
- Test: `tests/catalog-load.test.ts`, `tests/revalidate-route.test.ts`, `tests/bgg-app.test.ts`

**Interfaces:**
- Consumes: `getDb`/`hasDatabaseUrl` (Task 2), `getCatalog`, `Catalog`, `CatalogStatus` and `EMPTY_CATALOG` (Task 3).
- Produces:
  - In `lib/catalog/load.ts`: `export const CATALOG_TAG = "bgg-catalog"` and `export async function loadCatalog(): Promise<Catalog>`.
    - When `DATABASE_URL` is unset, it returns `EMPTY_CATALOG` unless `process.env.VERCEL === "1"`, in which case it throws.
    - Otherwise it returns the `unstable_cache`-wrapped `getCatalog(getDb())` with key `["bgg-catalog"]`, `{ tags: [CATALOG_TAG], revalidate: 86400 }`.
  - In `components/bgg-app.tsx`: `BggApp` props become `{ games: NormalizedGame[]; status: CatalogStatus }`.
  - `export function formatUpdatedDate(iso: string | null): string` returns `"Updated 2026-11-30"` or `"Not updated yet"` (UTC, `YYYY-MM-DD`).
  - In `lib/auth/bearer.ts`: `export function hasValidBearer(request: Request, secret: string | undefined): boolean`.
    - Returns false when `secret` is empty or undefined.
    - Compares `Authorization: Bearer <secret>` with `crypto.timingSafeEqual` on equal-length buffers.

- [ ] **Step 1: Write failing tests**

  - **`tests/catalog-load.test.ts`** (`vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))`, stub env):
    - `"returns an empty catalog locally without DATABASE_URL"`
    - `"throws on Vercel without DATABASE_URL"`
  - **`tests/revalidate-route.test.ts`** (mock `next/cache` `revalidateTag`/`revalidatePath` as `vi.fn()`):
    - `"401 without authorization"`
    - `"401 with a wrong secret"`
    - `"500 and no revalidation when REVALIDATE_SECRET is unset"`
    - `"200 revalidates the catalog tag and the home page"`: asserts `revalidateTag` was called with `("bgg-catalog", "max")` and `revalidatePath` with `("/")`.
  - **`tests/bgg-app.test.ts`:** switch to the new props.
    - Add `"has no sync control"`: the markup does not contain `Sync BGG`.
    - Add `"shows the UTC update date"`: with `updatedAt "2026-11-30T23:30:00.000Z"`, the markup contains `Updated 2026-11-30`.
    - Add `formatUpdatedDate(null) === "Not updated yet"`.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/catalog-load.test.ts tests/revalidate-route.test.ts tests/bgg-app.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the loader, the route and the page**

  - **Revalidation route:** `app/api/revalidate/route.ts` exports `POST(request: Request)`.
    - Returns 500 `{ error: "REVALIDATE_SECRET is not configured" }` when the secret env is unset.
    - Returns 401 when `hasValidBearer` fails.
    - Otherwise revalidates and responds `{ revalidated: true }`.
  - **Page:** `app/page.tsx` has `export const revalidate = 86400`, drops `force-dynamic`, and renders `<BggApp games={catalog.games} status={catalog.status} />`.

- [ ] **Step 4: Rework `components/bgg-app.tsx`**

  - **Remove:** `sync`, `refreshLocalState`, `useTransition`, `syncError`, the `Button`/`RefreshCw` imports and the sync error `Alert`. Games and status come straight from props.
  - **Copy changes:**
    - Eyebrow: `BoardGameGeek top games`.
    - Subtitle: `Top BoardGameGeek games, filterable by player-count recommendations and game types.`
    - Badge: `{n} games`.
    - Empty-state title: `No games yet`. Description: `Game data has not been loaded yet. Check back soon.`
    - Status line: `formatUpdatedDate(status.updatedAt)`.

- [ ] **Step 5: Remove SQLite**

  - Delete the routes, `lib/cache/store.ts` and `tests/cache-store.test.ts`.
  - Remove `serverExternalPackages` from `next.config.ts` and `better-sqlite3` from `pnpm-workspace.yaml` `allowBuilds`.
  - Run `pnpm remove better-sqlite3 @types/better-sqlite3`.
  - Create `vercel.json` with `{"regions": ["fra1"]}`.

- [ ] **Step 6: Verify**

  Run: `pnpm test && pnpm typecheck && pnpm build`
  Expected:
  - All tests pass.
  - Without `DATABASE_URL`, the build succeeds and lists `/` as prerendered with a 1d revalidate, not as dynamic (`ƒ`).
  - `grep -r "better-sqlite3\|force-dynamic" app lib components next.config.ts` prints nothing.

- [ ] **Step 7: Commit**

  ```bash
  git add -A app lib components tests next.config.ts pnpm-workspace.yaml package.json pnpm-lock.yaml vercel.json
  # includes lib/auth/bearer.ts
  git commit -m "feat: serve cached catalog with on-demand revalidation"
  ```

### Task 8: Sentry on the site

**Files:**
- Create: `instrumentation.ts`
- Create: `instrumentation-client.ts`
- Create: `sentry.server.config.ts`
- Create: `sentry.edge.config.ts`
- Create: `app/global-error.tsx`
- Create: `app/api/sentry-check/route.ts`
- Modify: `next.config.ts`
- Modify: `package.json`
- Test: `tests/sentry-check-route.test.ts`, `tests/next-config.test.ts`

**Interfaces:**
- Consumes: `hasValidBearer` (`lib/auth/bearer.ts`, Task 7).

- [ ] **Step 1: Write failing tests**

  - **`tests/sentry-check-route.test.ts`:**
    - `"401 without the secret"`
    - `"throws a deliberate error with the secret"`: `await expect(GET(req)).rejects.toThrow("Sentry check: deliberate site error")`.
  - **`tests/next-config.test.ts`:** keep the `allowedDevOrigins` assertion working on the wrapped config.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/sentry-check-route.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Add `@sentry/nextjs` and create the files**

  Run: `pnpm add -E @sentry/nextjs`, then create the files following the official manual setup:
  - **`instrumentation.ts`:** `register()` imports the server or edge config by `NEXT_RUNTIME`, plus `export const onRequestError = Sentry.captureRequestError`.
  - **`instrumentation-client.ts`:** `Sentry.init` plus `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart`.
  - **`app/global-error.tsx`:** captures the error in `useEffect` and renders `NextError` with `statusCode={0}`.
  - **All `Sentry.init` calls** use:
    ```ts
    {
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.VERCEL_ENV ?? "development",
      tracesSampleRate: 0,
      sendDefaultPii: false,
      initialScope: { tags: { component: "site" } },
    }
    ```
    No replay integration.
  - **`next.config.ts`:** exports `withSentryConfig(nextConfig, { org: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT, authToken: process.env.SENTRY_AUTH_TOKEN, silent: !process.env.CI, widenClientFileUpload: true })`, imported from `@sentry/nextjs/config`.
  - **`app/api/sentry-check/route.ts`:** `GET` returns 401 without a valid bearer. Otherwise it throws `new Error("Sentry check: deliberate site error")`.

- [ ] **Step 4: Verify**

  Run: `pnpm test && pnpm typecheck && pnpm build`
  Expected: everything passes. The build succeeds without any Sentry env vars; a source-map upload warning is acceptable.

- [ ] **Step 5: Commit**

  ```bash
  git add instrumentation.ts instrumentation-client.ts sentry.*.config.ts app tests next.config.ts package.json pnpm-lock.yaml
  git commit -m "feat: report site errors to sentry"
  ```

### Task 9: Weekly sync worker on Modal

**Files:**
- Create: `lib/worker/revalidate.ts`
- Create: `lib/worker/run-weekly-sync.ts`
- Create: `worker/sync-entry.ts`
- Create: `worker/modal_app.py`
- Test: `tests/run-weekly-sync.test.ts`, `tests/revalidate-client.test.ts`
- Modify: `package.json` (deps, scripts)
- Modify: `.gitignore` (`worker/dist/`)

**Interfaces:**
- Consumes: `runSync`, `SyncLog` and `SyncOutcome` (Task 5), `fetchThingBatch` (Task 4), `getDatabaseSizeBytes` (Task 3), `createPgDb` (Task 2).
- Produces:
  ```ts
  // lib/worker/revalidate.ts
  export function createRevalidator(revalidateUrl: string, secret: string, fetchImpl?: typeof fetch): () => Promise<void>; // POST with bearer, then GET new URL("/", revalidateUrl) to warm; throws on non-2xx POST
  // lib/worker/run-weekly-sync.ts
  export const SIZE_WARNING_BYTES = 838860800;
  export type WeeklySyncDeps = { db: Db; fetchBatch: (ids: number[]) => Promise<NormalizedGame[]>; log: SyncLog; revalidate: () => Promise<void>; sleep?: (ms: number) => Promise<void>; sizeWarningBytes?: number };
  export async function runWeeklySync(deps: WeeklySyncDeps): Promise<{ outcome: SyncOutcome; exitCode: 0 | 1 }>;
  ```

- [ ] **Step 1: Write failing tests**

  - **`tests/run-weekly-sync.test.ts`** (PGlite, fake `fetchBatch`, spy `revalidate`):
    - `"revalidates and exits 0 on success"`
    - `"revalidates and exits 1 on partial"`
    - `"does not revalidate and exits 1 on error"`
    - `"exits 0 without revalidating when skipped"`
    - `"warns when the database is over the size limit"`: with `sizeWarningBytes: 1`, `log.warn` is called with a message containing `Database size` and attributes containing `bytes`.
  - **`tests/revalidate-client.test.ts`:**
    - `"posts with the bearer secret then warms the home page"`: two calls, the first `POST https://x.vercel.app/api/revalidate` with `Authorization: Bearer s`, the second `GET https://x.vercel.app/`.
    - `"throws when revalidation is rejected"`: 401 rejects.

- [ ] **Step 2: Run the tests to verify they fail**

  Run: `pnpm vitest run tests/run-weekly-sync.test.ts tests/revalidate-client.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `createRevalidator` and `runWeeklySync`**

  - **Exit codes:** `exitCode` is 0 for `success`/`skipped` and 1 for `partial`/`error`.
  - **Revalidation failure:** if `revalidate()` throws, log the error and return exit code 1.

- [ ] **Step 4: Run the tests to verify they pass**

  Run: `pnpm vitest run tests/run-weekly-sync.test.ts tests/revalidate-client.test.ts`
  Expected: PASS.

- [ ] **Step 5: Implement `worker/sync-entry.ts`**

  - **Env checks:** require `DATABASE_URL`, `BGG_TOKEN`, `REVALIDATE_URL` and `REVALIDATE_SECRET`. Exit 1 with `Missing env: <names>` if any is missing. `SENTRY_DSN` is optional.
  - **Sentry init:** `@sentry/node` with `{ dsn: SENTRY_DSN, environment: "production", tracesSampleRate: 0, sendDefaultPii: false, initialScope: { tags: { component: "worker" } } }`.
  - **`SyncLog` adapter:** writes to both `console` and `Sentry.logger`. `error` also calls `Sentry.captureException` with the attributes as `extra`.
  - **Monitor:** wrap the run in `Sentry.withMonitor("bgg-weekly-sync", fn, { schedule: { type: "crontab", value: "0 3 * * 1" }, checkinMargin: 60, maxRuntime: 120, timezone: "UTC" })`. `fn` throws when `exitCode === 1` so the check-in records a failure.
  - **Shutdown:** always `await Sentry.flush(5000)` and `pool.end()`, then `process.exit(exitCode)`.
  - **`--sentry-check` argument:** captures `new Error("Sentry check: deliberate worker error")`, flushes, and exits 0 without syncing.

- [ ] **Step 6: Implement `worker/modal_app.py`**

  ```python
  import subprocess
  from pathlib import Path
  import modal

  BUNDLE = Path(__file__).parent / "dist" / "sync.cjs"
  image = modal.Image.from_registry("node:22-bookworm-slim", add_python="3.12").add_local_file(BUNDLE, "/app/sync.cjs")
  app = modal.App("bgg-sync")

  @app.function(image=image, secrets=[modal.Secret.from_name("bgg-sync")], schedule=modal.Cron("0 3 * * 1"), timeout=7200)
  def weekly_sync(args: list[str] | None = None):
      result = subprocess.run(["node", "/app/sync.cjs", *(args or [])])
      if result.returncode != 0:
          raise RuntimeError(f"sync exited with code {result.returncode}")

  @app.local_entrypoint()
  def main(sentry_check: bool = False):
      weekly_sync.remote(["--sentry-check"] if sentry_check else [])
  ```

  Do not pin a Modal region. The job is tiny, and region selection may carry a price multiplier. This is a deviation from the spec's "EU if Starter allows", noted for the owner.

- [ ] **Step 7: Add dependencies and scripts**

  - Run: `pnpm add -E @sentry/node && pnpm add -D -E esbuild`.
  - Scripts:
    - `"worker:local": "tsx --env-file-if-exists=.env.local worker/sync-entry.ts"`
    - `"worker:build": "esbuild worker/sync-entry.ts --bundle --platform=node --target=node22 --format=cjs --outfile=worker/dist/sync.cjs"`
    - `"worker:deploy": "pnpm worker:build && MODAL_PROFILE=bgg modal deploy worker/modal_app.py"`
    - `"worker:run": "pnpm worker:build && MODAL_PROFILE=bgg modal run worker/modal_app.py"`
    - `"worker:sentry-check": "pnpm worker:build && MODAL_PROFILE=bgg modal run worker/modal_app.py --sentry-check"`
  - Add `worker/dist/` to `.gitignore`.

- [ ] **Step 8: Verify the bundle**

  Run: `pnpm worker:build && node worker/dist/sync.cjs`
  Expected: it exits 1 and prints `Missing env: DATABASE_URL, BGG_TOKEN, REVALIDATE_URL, REVALIDATE_SECRET`, which proves the bundle loads.

  Run: `python3 -c "import ast; ast.parse(open('worker/modal_app.py').read())"`
  Expected: no output.

- [ ] **Step 9: Commit**

  ```bash
  git add lib/worker worker/sync-entry.ts worker/modal_app.py tests package.json pnpm-lock.yaml .gitignore
  git commit -m "feat: run weekly bgg sync on modal"
  ```

### Task 10: Account-safe Vercel wrapper, configuration and README runbook

**Files:**
- Create: `lib/deploy/vercel-args.ts`
- Create: `scripts/vercel.ts`
- Test: `tests/vercel-args.test.ts`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json` (`vc` script)

**Interfaces:**
- Produces: `export function buildVercelArgs(args: string[], token: string | undefined): string[];`
  - Throws `VERCEL_TOKEN is not set` when the token is empty.
  - Throws `Pass the token through VERCEL_TOKEN, not --token` when `args` already contains `--token`.
  - Otherwise returns `[...args, "--token", token]`.

- [ ] **Step 0: Test and implement the wrapper**

  - **Tests in `tests/vercel-args.test.ts`:**
    - `"requires VERCEL_TOKEN"`
    - `"appends the token"`: `buildVercelArgs(["deploy","--prod"], "t")` equals `["deploy","--prod","--token","t"]`.
    - `"rejects an explicit --token"`
  - Run them and watch them fail. Then implement:
    - `scripts/vercel.ts` spawns `vercel` with `buildVercelArgs(process.argv.slice(2), process.env.VERCEL_TOKEN)` (`stdio: "inherit"`) and exits with its code.
    - Package entry: `"vc": "tsx --env-file-if-exists=.env.local scripts/vercel.ts"`.
  - Run: `pnpm vitest run tests/vercel-args.test.ts`
    Expected: PASS.

- [ ] **Step 1: Rewrite `.env.example`**

  It lists `DATABASE_URL`, `BGG_TOKEN`, `REVALIDATE_SECRET`, `REVALIDATE_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` and `VERCEL_TOKEN`. Each has a one-line comment saying where it is used (site, worker or local), and `VERCEL_TOKEN` is marked "local only, from this project's Vercel account".

- [ ] **Step 2: Rewrite `README.md`**

  Sections:
  - **Local setup:** `pnpm install`, `.env.local`, `pnpm db:migrate`, `pnpm bgg:import-ranks ./boardgames_ranks.csv`, `pnpm worker:local`, `pnpm dev`.
  - **Deployment, in the order of the spec's "Owner's manual steps"** with exact commands:
    - Neon: Frankfurt, pooled URL. Do not install the Vercel integration.
    - Starts with **Accounts**: create dedicated personal accounts for this project on Neon, Vercel, Modal and Sentry, and never use other logged-in accounts.
    - Vercel: create a token in the project's Vercel account, put it in `.env.local` as `VERCEL_TOKEN`, then `pnpm vc link`, `pnpm vc env add …` for each site variable, `pnpm vc deploy --prod`. No `vercel login`.
    - Modal: `modal token new --profile bgg` (opens the browser for the project's Modal account), then `MODAL_PROFILE=bgg modal secret create bgg-sync DATABASE_URL=… BGG_TOKEN=… REVALIDATE_URL=https://<project>.vercel.app/api/revalidate REVALIDATE_SECRET=… SENTRY_DSN=…`, `pnpm worker:deploy`, `pnpm worker:run`.
    - Modal workspace spend limit.
    - Sentry project and DSN.
  - **Updating the ranked list:** monthly import, then `pnpm worker:run` to publish immediately.
  - **Verifying Sentry:**
    - `curl -H "Authorization: Bearer $REVALIDATE_SECRET" https://<project>.vercel.app/api/sentry-check`
    - `pnpm worker:sentry-check`
  - **BGG API compliance:** update the existing list.
    - The site is public and non-commercial.
    - Refresh runs weekly from a scheduled job, with no public trigger.
    - Descriptions and raw XML are not stored.
    - Add a reminder to confirm the XML API registration covers a public non-commercial site.

- [ ] **Step 3: Verify**

  Run: `pnpm test && pnpm typecheck && pnpm build`
  Expected: PASS.

  Run: `git grep -n "BGG_CACHE_PATH\|bgg-cache.sqlite\|Sync BGG" -- . ':!docs'`
  Expected: nothing.

- [ ] **Step 4: Commit**

  ```bash
  git add .env.example README.md lib/deploy scripts/vercel.ts tests/vercel-args.test.ts package.json
  git commit -m "docs: document deployment and operations"
  ```

### Task 11: First deployment (with the owner)

These steps need the owner's accounts. The executor pauses and asks the owner for each one, never guesses credentials, and never deploys without the owner's go-ahead.

- [ ] **Step 1: Owner completes the README deployment prerequisites**

  Neon project, Vercel login, Modal spend limit, Sentry DSN, and the BGG registration check. The executor waits for confirmation.

- [ ] **Step 2: Migrate and import against Neon**

  Run: `pnpm db:migrate && pnpm bgg:import-ranks ./boardgames_ranks.csv`
  Expected: `0001_init.sql` applied, then `Imported 500 ranked games, removed 0 games.`

- [ ] **Step 3: Deploy the site**

  Run: `pnpm vc deploy --prod`
  Expected: it deploys. The production URL shows `No games yet`.

- [ ] **Step 4: Deploy the worker and run it once**

  Run: `pnpm worker:deploy && pnpm worker:run`
  Expected:
  - The Modal run finishes successfully.
  - `select status, fetched_count from sync_runs order by id desc limit 1` gives `success | 500`.

- [ ] **Step 5: Verify the site updated without a redeploy**

  Reload the production URL. Expected: `500 games` and `Updated <today>`.

- [ ] **Step 6: Verify Sentry**

  Run the two Sentry checks from the README. Expected:
  - Both deliberate errors appear in Sentry, tagged `component:site` and `component:worker`.
  - The worker's run logs appear under Logs.
  - The `bgg-weekly-sync` monitor shows one OK check-in.
