# BGG Player Recommendation Finder

A public, non-commercial Next.js site for filtering top BoardGameGeek games by categories, mechanics, and player-count recommendation polls.

- **Site:** Next.js on Vercel (Hobby). Pages are prerendered and cached; ordinary page views never query the database.
- **Database:** Postgres on Neon (Free).
- **Weekly sync:** a Node script run by a Modal cron job (Starter) every Monday at 03:00 UTC. It refreshes game details from the BGG XML API, then asks the site to revalidate.
- **Errors and logs:** Sentry (Developer plan), for both the site and the worker.

## Local setup

1. Install dependencies: `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in at least `DATABASE_URL` (a Neon branch or any Postgres) and `BGG_TOKEN`.
3. Create the schema: `pnpm db:migrate`
4. Import the ranked list from a downloaded BGG ranks dump: `pnpm bgg:import-ranks ./boardgames_ranks.csv`
5. Fetch game details once: `pnpm worker:local`. This needs `REVALIDATE_URL` and `REVALIDATE_SECRET` too. Point them at `http://localhost:3000/api/revalidate` while `pnpm dev` runs.
6. Start the site: `pnpm dev`

Without `DATABASE_URL`, `pnpm dev` and `pnpm build` render an empty catalog.

## Deployment

### Accounts

Use **dedicated personal accounts created for this project** on Neon, Vercel, Modal and Sentry. Never use other accounts that happen to be logged in on your machine. The tooling enforces this:

- Vercel commands go through `pnpm vc …`. It always passes `VERCEL_TOKEN` from `.env.local` and refuses to run without it. Do not use `vercel login`.
- Modal commands run with `MODAL_PROFILE=bgg`. If that profile does not exist, they fail instead of using another one.

### 1. Neon

1. In the project's Neon account, create a project in **Frankfurt (AWS eu-central-1)**.
2. Copy the **pooled** connection string. Put it in `.env.local` as `DATABASE_URL`.
3. Do **not** install the Neon integration in Vercel. It creates a database branch per preview deployment, and every branch counts against the 1 GB Free limit.
4. Run migrations and import the ranked list:

```bash
pnpm db:migrate
```

```bash
pnpm bgg:import-ranks ./boardgames_ranks.csv
```

### 2. Sentry

In the project's Sentry account, create an organization and a Next.js project, then copy the DSN. One project is enough. Events carry a `component` tag of `site` or `worker`.

### 3. Vercel

1. In the project's Vercel account, create an access token (Account Settings → Tokens). Put it in `.env.local` as `VERCEL_TOKEN`.
2. Link the repository to a new project:

```bash
pnpm vc link
```

3. Add the production environment variables: `DATABASE_URL`, `REVALIDATE_SECRET` (any long random string), `NEXT_PUBLIC_SENTRY_DSN`. Optionally also `SENTRY_ORG`, `SENTRY_PROJECT` and `SENTRY_AUTH_TOKEN` for source maps.

```bash
pnpm vc env add DATABASE_URL production
```

4. Deploy:

```bash
pnpm vc deploy --prod
```

Functions run in `fra1` (`vercel.json`), next to the Neon database.

### 4. Modal

1. In the project's Modal account, add a payment method. Then set a **workspace spend limit** (Settings → Usage) so overage stops work instead of charging the card. The weekly job uses well under $1 of the free $30 monthly compute.
2. Create the dedicated CLI profile without making it the active one. This opens the browser; log in with the project's Modal account. Your other Modal profiles stay active for other work.

```bash
modal token new --profile bgg --no-activate
```

3. Create the worker secret:

```bash
MODAL_PROFILE=bgg modal secret create bgg-sync DATABASE_URL=... BGG_TOKEN=... REVALIDATE_URL=https://<project>.vercel.app/api/revalidate REVALIDATE_SECRET=... SENTRY_DSN=...
```

4. Deploy the weekly schedule and run the first sync:

```bash
pnpm worker:deploy
```

```bash
pnpm worker:run
```

## Operations

### Updating the ranked list

The weekly job refreshes ratings, ranks and votes for the stored list. To change which games are listed, download a fresh `boardgames_ranks.csv` from BGG while logged in, roughly monthly. Then import it:

```bash
pnpm bgg:import-ranks ./boardgames_ranks.csv
```

Games that left the top 500 disappear at the next revalidation. New games appear after the next sync. To publish immediately:

```bash
pnpm worker:run
```

### Verifying Sentry

Each check sends one deliberate error, tagged `component:site` or `component:worker`:

```bash
curl -H "Authorization: Bearer $REVALIDATE_SECRET" https://<project>.vercel.app/api/sentry-check
```

```bash
pnpm worker:sentry-check
```

The weekly run reports to the `bgg-weekly-sync` cron monitor and sends its run logs to Sentry Logs. A run where some BGG batches failed is recorded as `partial` and fails the Modal run. The successful batches are still published.

### Storage

Neon Free allows 1 GB. The worker logs the database size after every run and warns in Sentry above 800 MiB.

## BoardGameGeek API compliance

- API requests are server-side only, from the scheduled worker. There is no public endpoint that triggers BGG requests. `BGG_TOKEN` never reaches browser code.
- The ranked list comes from the BGG ranks dump, imported by hand. No BGG HTML pages are requested.
- XML API detail requests are batched at the documented maximum of 20 item IDs, at least 5.2 seconds apart, with retries for `429` and `5xx`. Data refreshes once a week.
- Requests use `https://boardgamegeek.com` without a `www` subdomain.
- The UI credits BoardGameGeek by name and includes a visible, linked "Powered by BGG" mark.
- The site is public and non-commercial: no ads and no affiliate links. Confirm that the XML API application registration covers a public non-commercial website, and re-register if it was registered for local use only.
- BGG API data must not be used to train AI or LLM systems.
- Game descriptions and raw XML are not stored.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` | Run or build the site |
| `pnpm test` / `pnpm typecheck` | Tests (Postgres-backed tests use in-process PGlite) and TypeScript checks |
| `pnpm db:migrate` | Apply `db/migrations/*.sql` to `DATABASE_URL` |
| `pnpm bgg:import-ranks <csv> [--limit N]` | Replace the stored ranked list (default top 500) |
| `pnpm worker:local` | Run the weekly sync locally with `.env.local` |
| `pnpm worker:build` | Bundle the worker to `worker/dist/sync.cjs` |
| `pnpm worker:deploy` / `pnpm worker:run` / `pnpm worker:sentry-check` | Deploy, run once, or send a Sentry check through Modal (profile `bgg`) |
| `pnpm vc <vercel args>` | Vercel CLI authenticated only with `VERCEL_TOKEN` |
