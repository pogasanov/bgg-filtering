import * as Sentry from "@sentry/node";
import { createDb, createPool } from "@/lib/db/client";
import { buildUserAgent } from "@/lib/prices/http";
import { refreshSite } from "@/lib/prices/refresh-site";
import { runPriceCollection } from "@/lib/prices/run-collection";
import { shopCodes } from "@/lib/prices/types";
import { sentryDataCollection } from "@/lib/sentry-options";
import { createSentryLog } from "@/lib/worker/sentry-log";

const MONITOR_SLUG = "bgg-daily-prices";
/** Kept in step with the schedule in worker/modal_app.py. */
const SCHEDULE = "0 5 * * *";

const log = createSentryLog(Sentry);

/** The daily price run on Modal. Exits 1 when any shop failed, so the run shows as failed. */
async function dailyPrices(): Promise<number> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("Missing env: DATABASE_URL");
    return 1;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0,
    dataCollection: sentryDataCollection,
    initialScope: { tags: { component: "prices-worker" } },
  });
  const pool = createPool(databaseUrl, 2);
  let exitCode = 1;
  try {
    await Sentry.withMonitor(
      MONITOR_SLUG,
      async () => {
        const summary = await runPriceCollection({
          db: createDb(pool),
          shops: shopCodes,
          userAgent: buildUserAgent(process.env.PRICE_BOT_INFO_URL),
          log: (line) => log.info(line),
        });
        const failed = summary.shops.filter((shop) => shop.error !== null);
        for (const shop of failed) log.warn(`Price collection failed for ${shop.shop}`, { error: shop.error });
        await refreshSite(
          { REVALIDATE_URL: process.env.REVALIDATE_URL, REVALIDATE_SECRET: process.env.REVALIDATE_SECRET },
          (line) => log.info(line),
        );
        exitCode = failed.length > 0 ? 1 : 0;
        if (exitCode !== 0) throw new Error(`Price run finished with ${failed.length} failed shop(s)`);
      },
      { schedule: { type: "crontab", value: SCHEDULE }, checkinMargin: 60, maxRuntime: 180, timezone: "UTC" },
    );
  } catch (error) {
    if (exitCode === 0) exitCode = 1;
    if (!(error instanceof Error && error.message.startsWith("Price run finished"))) {
      log.error("Price run crashed", error);
    }
  } finally {
    await Sentry.flush(5000);
    await pool.end();
  }
  return exitCode;
}

dailyPrices().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
