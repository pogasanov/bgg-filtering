/**
 * Sentry v11 collects user info, cookies, headers and bodies by default. We send none of it:
 * no visitor PII, and no Authorization headers carrying REVALIDATE_SECRET or BGG_TOKEN.
 */
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  databaseQueryData: false,
};

/** Every trace while developing, so one is there to look at; 10% in production builds. */
export function siteTracesSampleRate(nodeEnv: string | undefined): number {
  return nodeEnv === "production" ? 0.1 : 1;
}

/** Session Replay only for sessions that hit an error (browser only). */
export const siteReplayOptions = { replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 1 };

/** Shared Sentry init options for the site's server, edge and browser runtimes. */
export const siteSentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: siteTracesSampleRate(process.env.NODE_ENV),
  dataCollection: sentryDataCollection,
  initialScope: { tags: { component: "site" } },
};
