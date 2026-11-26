import * as Sentry from "@sentry/node";
import { fetchThingBatch } from "@/lib/bgg/client";
import { createPgDb, createPool } from "@/lib/db/client";
import { sentryDataCollection } from "@/lib/sentry-options";
import { createRevalidator } from "@/lib/worker/revalidate";
import { runWeeklySync } from "@/lib/worker/run-weekly-sync";
import { createSentryLog } from "@/lib/worker/sentry-log";

const REQUIRED_ENV = ["DATABASE_URL", "BGG_TOKEN", "REVALIDATE_URL", "REVALIDATE_SECRET"] as const;
const MONITOR_SLUG = "bgg-weekly-sync";

function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0,
    dataCollection: sentryDataCollection,
    initialScope: { tags: { component: "worker" } },
  });
}

const log = createSentryLog(Sentry);

async function sentryCheck(): Promise<number> {
  initSentry();
  Sentry.captureException(new Error("Sentry check: deliberate worker error"));
  log.info("Sentry check sent");
  await Sentry.flush(5000);
  return 0;
}

async function weeklySync(): Promise<number> {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.error(`Missing env: ${missing.join(", ")}`);
    return 1;
  }
  const env = Object.fromEntries(REQUIRED_ENV.map((name) => [name, process.env[name] as string])) as Record<
    (typeof REQUIRED_ENV)[number],
    string
  >;

  initSentry();
  const pool = createPool(env.DATABASE_URL, 2);
  let exitCode = 1;
  try {
    await Sentry.withMonitor(
      MONITOR_SLUG,
      async () => {
        const result = await runWeeklySync({
          db: createPgDb(pool),
          fetchBatch: (ids) => fetchThingBatch(ids, env.BGG_TOKEN),
          log,
          revalidate: createRevalidator(env.REVALIDATE_URL, env.REVALIDATE_SECRET),
        });
        exitCode = result.exitCode;
        if (exitCode !== 0) throw new Error(`Weekly sync finished with status ${result.outcome.status}`);
      },
      {
        schedule: { type: "crontab", value: "0 3 * * 1" },
        checkinMargin: 60,
        maxRuntime: 120,
        timezone: "UTC",
      },
    );
  } catch (error) {
    if (exitCode === 0) exitCode = 1;
    if (!(error instanceof Error && error.message.startsWith("Weekly sync finished"))) {
      log.error("Weekly sync crashed", error);
    }
  } finally {
    await Sentry.flush(5000);
    await pool.end();
  }
  return exitCode;
}

const run = process.argv.includes("--sentry-check") ? sentryCheck : weeklySync;
run().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
