/** Shared Sentry init options for the site's server, edge and browser runtimes. */
export const siteSentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.VERCEL_ENV ?? "development",
  tracesSampleRate: 0,
  sendDefaultPii: false,
  initialScope: { tags: { component: "site" } },
};
