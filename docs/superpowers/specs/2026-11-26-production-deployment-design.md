# Production Deployment Design

## Goal

Make the existing BoardGameGeek player-count finder a public website that anyone can open by link, with BoardGameGeek data refreshing itself once a week, errors and sync logs reported to Sentry, and a running cost of $0 per month.

Price comparison is explicitly out of scope for this step. It will be designed separately and will reuse the infrastructure set up here.

## Background

The app was built for local use: a SQLite file (`data/bgg-cache.sqlite`), a `Sync BGG` button that runs the sync inside the Next.js process (`POST /api/sync`), and a ranks CSV (`boardgames_ranks.csv`) read from the project root. None of that works on serverless hosting.

Hosting research (2026-11-26) picked the stack: the project is non-commercial, load is minimal, everything that can be cached is cached, and the goal is zero cost with no surprise bills.

## Decisions made by the owner

- **Hosting:** Vercel Hobby for the site, Neon Free (Postgres) for the database, Modal Starter for the scheduled sync. The site stays non-commercial (no ads, no affiliate links), which Vercel Hobby requires.
- **Refresh cadence:** BGG data refreshes automatically once a week.
- **Observability:** errors and logs from both the site and the sync go to Sentry.
- **Which games are synced:**
  - The list of top-ranked games comes from `boardgames_ranks.csv`, which the owner downloads from BGG while logged in. Anonymous requests to the data-dump page are refused.
  - The owner imports it into the database with a local command whenever they choose, roughly monthly.
  - The weekly job refreshes details for the stored list through the XML API. Ratings, ranks and vote counts come back fresh with `stats=1`.
  - BGG credentials never go to the server. A game that newly enters the top N appears only after the next manual import.
- **Prices:** out of scope for now.
- **Dedicated accounts:** every service (Vercel, Neon, Modal, Sentry) uses a separate personal account created for this project. Nothing may be deployed to, or authenticated with, any other account that happens to be logged in on the owner's machine.
  - The tooling must name the project's account explicitly instead of relying on whatever CLI login is active.
  - The Modal CLI on the owner's machine is currently logged in to a different profile.

## Decisions made by the designer (owner may override)

These were not discussed with the owner.

- **Sync language:** the sync stays TypeScript and reuses `lib/bgg/*` and `lib/sync.ts`. Modal runs it as a Node process inside its container behind a thin Python entrypoint, because Modal functions can only be declared in Python.
- **Regions and domain:** the site runs on the default `*.vercel.app` domain. Vercel functions run in `fra1`, Neon in Frankfurt (AWS eu-central-1), and Modal in an EU region if Starter allows choosing one.
- **No public sync trigger:** the `Sync BGG` button and `POST /api/sync` are removed. The `/api/games` and `/api/status` routes exist only to refresh the UI after that button, so they are removed too.
- **Not persisted:** raw XML and game descriptions. Descriptions are not rendered today, and raw XML is what made the current SQLite cache 99% duplicate data. If raw payloads are ever needed again they belong in object storage, not in Neon.
- **Sync size:** stays at the top 500 ranked base games, as today. The number becomes a setting of the import command.
- **Value precedence:** when the CSV and the XML API disagree on rank, Geek Rating, average or voter count, the XML values win because they are fresher. This reverses today's merge in `lib/sync.ts`.
- **Database connection:** the database connection string is set by hand as an environment variable. The Neon–Vercel integration is not used, because it creates a database branch per preview deployment and every branch counts against the 1 GB Free limit.
- **Backups:** none beyond Neon's built-in 6-hour restore window. Every row can be rebuilt from BGG with one import and one sync.
- **Dependency pinning:** `package.json` dependencies are pinned to the versions currently resolved in `pnpm-lock.yaml`, and `package-lock.json` is removed so pnpm is the only package manager. Today every dependency is `latest`, so any upstream release can break a Vercel build.
- **UI language:** the UI stays in English.
- **Catalog membership:**
  - The site shows exactly the games in the currently imported top-N list that have been synced at least once.
  - A game that leaves the list disappears from the site, and its rows may be deleted.
  - A newly imported game stays hidden until the first sync has fetched its details. The site never shows CSV-only rows.
  - The import does not revalidate the site itself. Changes become visible after the next sync, or within the time-based fallback.
  - After an import, the owner can run the sync by hand to publish immediately.
- **Partial sync failures:**
  - A batch that still fails after retries does not abort the run. The worker continues with the next batch, and every successful batch is written.
  - A run with at least one failed batch is recorded in `sync_runs` with a distinct `partial` status that includes the failed IDs, and the failure is reported to Sentry.
  - Both `success` and `partial` runs revalidate the site. A partial run then exits non-zero, so Modal marks it failed.
  - The site's "updated" date is the finish time of the last `success` or `partial` run.
  - Games from failed batches keep their previous data. Each game's own `updated_at` stays accurate.
  - A run where no batch succeeds is recorded as `error` and does not revalidate.

## Constraints

- **Vercel Hobby:**
  - Non-commercial use only.
  - Functions: 300 s max.
  - Allowances: 1M CDN requests, 100 GB data transfer and 4 h of active CPU a month. Exceeding them pauses the project rather than billing.
  - Cron at most daily (not needed: scheduling lives in Modal).
- **Neon Free:**
  - 1 GB storage per project, summed across branches.
  - 100 compute-hours a month. Scales to zero after 5 minutes idle.
  - At the storage limit every write fails, including `DELETE`. Reads still work.
- **Modal Starter:**
  - $30 of compute a month and 5 deployed cron schedules.
  - Function timeout up to 24 h. Logs are retained 1 day.
  - A payment method is required. The owner sets a workspace spend limit so overage stops work instead of charging the card.
- **BGG XML API:**
  - Requests are server-side only and carry `BGG_TOKEN`.
  - At most 20 IDs per `thing` request. Requests at least 5.2 s apart, as today.
  - Attribution ("Powered by BGG") stays visible.
- **Sentry:** the free Developer plan. Keep quotas small: errors always captured, performance tracing off or heavily sampled, session replay off.

## Architecture

### Data flow

1. **Import (owner's machine, occasional).**
   - The owner runs a package script, e.g. `pnpm bgg:import-ranks <csv> [--limit 500]`, with `DATABASE_URL` in `.env.local`.
   - It parses the CSV with the existing `parseRanksCsv` and replaces the stored top-N list in one transaction.
   - It does not call BGG.
2. **Weekly sync (Modal, scheduled).**
   - Reads the stored ID list.
   - Fetches details in batches of 20 with the existing client and parser, at the existing spacing.
   - Writes games, tags, languages and player recommendations, then records the run in `sync_runs`.
   - Calls the site's revalidation endpoint, which also happens to warm the cache.
   - Holds a lock so two runs (scheduled plus manual) cannot overlap.
   - A manual run is possible with `modal run` for the first load and for testing.
3. **Site (Vercel).**
   - The page reads games and status from Postgres through Next.js caching tagged with one tag. A page view must not query the database; only a cache miss or revalidation does.
   - Revalidation is on demand: `POST /api/revalidate` checks a shared secret and invalidates the tag.
   - A time-based fallback of about a day ensures a missed webhook cannot freeze the data indefinitely.

### Database

- **Engine:** Postgres on Neon. The schema keeps today's tables minus `raw_xml` and `description` (and `rank_snapshots` if the stored top-N list replaces it), plus a table for the imported top-N list.
- **Migrations:** plain SQL migrations applied by a package script run from the owner's machine before deploying a change.
- **SQL:** port SQLite constructs to Postgres equivalents (`INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`, etc.).
- **Sync lock:** keep its semantics, so a run that cannot take the lock exits cleanly and says so in the logs.
- **Driver:** `@neondatabase/serverless` or another Postgres driver that works from Vercel functions and from Node in Modal (builder's choice).
- **Tests:** run without a network against an in-process Postgres such as PGlite, so SQL is tested against real Postgres semantics.

### Sync worker on Modal

- **Location:** a `worker/` directory, or similar, holds the Modal app definition (Python) and the Node entrypoint (TypeScript).
- **Image:** contains Node and the worker code with its dependencies. Bundling it versus installing dependencies in the image is the builder's choice.
- **Schedule:** one cron schedule, weekly at a fixed time (the designer's default is Monday 03:00 UTC).
- **Secrets:** one Modal secret holding `DATABASE_URL`, `BGG_TOKEN`, `REVALIDATE_URL`, `REVALIDATE_SECRET` and `SENTRY_DSN`.
- **Failure:** if the Node process fails, the Python wrapper fails the Modal run, and the error has already been sent to Sentry.
- **Storage check:** after each run the worker logs the database size (`pg_database_size`). It reports a Sentry warning above 800 MB.

### Sentry

- **Site:** `@sentry/nextjs` for server and client errors. Source-map upload is set up if it costs nothing beyond a free auth token; otherwise it is skipped.
- **Worker:** Sentry's Node SDK.
  - Exceptions, including per-batch fetch failures, are captured with the batch IDs.
  - Structured logs are sent through Sentry Logs: run started, each batch fetched, games written, run finished with counts and duration, database size.
- **Cron monitoring:** the weekly schedule is registered as a Sentry Cron Monitor if the free plan includes one. If not, it is skipped, and a missed week shows up as a stale "updated" date on the site.
- **Project layout:** a single Sentry project with an environment or tag separating site and worker is enough. Two projects are also fine.

### UI changes

- **Header:** remove the `Sync BGG` button, the sync error alert and the client-side refresh logic.
- **Status:** keep the game count and show the last successful update time.
- **Copy:** replace "BoardGameGeek local cache" and the setup hint ("Add BGG_TOKEN to .env.local and place boardgames_ranks.csv…") with public-facing copy. The empty state says data has not been loaded yet.
- **Everything else stays:** filtering, sorting, the recommendation matrix and BGG attribution are unchanged.

### Configuration

- **Vercel environment:**
  - `DATABASE_URL` (pooled connection string)
  - `REVALIDATE_SECRET`
  - Sentry DSN, plus `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` if source maps are uploaded
- **Modal secret:** listed above.
- **Local `.env.local`:**
  - `DATABASE_URL` for migrations and import.
  - Optionally `BGG_TOKEN` for running the sync locally.
- **`.env.example`:** updated to match.

## Owner's manual steps (not code)

1. Create new personal accounts for this project on Neon, Vercel, Modal and Sentry.
2. Create the Neon project in Frankfurt and copy the pooled connection string.
3. Create a Vercel access token in the project's Vercel account. Link and deploy with that token, so the CLI's global login is never used. Set the function region to `fra1` and add the environment variables.
4. In the project's Modal account:
   - add a payment method;
   - set the workspace spend limit;
   - create a dedicated CLI profile (`modal token new --profile bgg`);
   - create the secret under that profile.
5. Create the Sentry organization and project in the project's Sentry account, and copy the DSN.
6. Check that the BGG XML API application registration covers a public non-commercial website. The README currently describes local browsing only. Re-register if needed.
7. Download `boardgames_ranks.csv`, run migrations and the import, then trigger the first sync with `modal run`.

The builder should provide exact commands for each step in the README.

## Non-goals

- Price scraping, shops, product matching or any price UI.
- Automatic download of the ranks CSV, or storing BGG login credentials anywhere.
- A custom domain, authentication or an admin UI.
- Separate databases for preview deployments.
- Backups beyond Neon's restore window.
- Analytics.

## Anti-goals

These would make the result a failure even if it technically works:

- Any database query on an ordinary page view.
- Any public endpoint that causes requests to BGG.
- Any configuration that can bill money: everything must stop or degrade at free limits instead.
- `BGG_TOKEN`, the database URL or the revalidation secret reaching browser code or the repository.

## Testing and verification

- **Unchanged tests:** existing parser, ranks CSV, filtering, year-scale and UI tests keep passing.
- **Store tests:** these run against in-process Postgres.
- **New tests:**
  - the import replaces the stored list;
  - XML values win over CSV values;
  - the revalidation route rejects a missing or wrong secret;
  - the sync releases its lock after success and after failure.
- **Build checks:** `pnpm typecheck` and `pnpm build` pass with pinned dependencies.
- **After deploy, check by hand:**
  - the site loads on `*.vercel.app`;
  - a manual Modal run fills the database;
  - the page shows the new data after revalidation without a redeploy;
  - Sentry receives a deliberate test error from the site and from the worker, plus the worker's run logs.

## Left to the builder

- **Caching mechanism:** Next 16 `"use cache"` with `cacheTag`, or another approach that meets the "no database query per page view" rule.
- **Database code:** the driver, the adapter shape that lets tests use in-process Postgres, and the migration runner.
- **Worker layout:** how the worker is laid out and packaged for Modal.
- **Sentry setup:** exact SDK configuration and sample rates within free quotas.
- **Errors and retries:** whether to add retries for BGG `429` and `5xx` responses. Recommended, since nobody is watching a scheduled run.
