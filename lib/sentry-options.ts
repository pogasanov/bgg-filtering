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

/** Shared Sentry init options for the site's server, edge and browser runtimes. */
export const siteSentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  dataCollection: sentryDataCollection,
  initialScope: { tags: { component: "site" } },
};
