/**
 * PostHog is reached through this site: the browser talks to bg.gsnv.dev/<path>, and Vercel passes
 * the requests on to PostHog's EU hosts. The path is deliberately neutral: blocker lists match
 * "posthog", "analytics", "ingest" and the like.
 */
export const POSTHOG_PROXY_PATH = "/relay";

const POSTHOG_API_HOST = "https://eu.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://eu-assets.i.posthog.com";

/** Next.js rewrites for the proxy; the static one (the SDK's lazy-loaded scripts) must come first. */
export const posthogProxyRewrites = [
  { source: `${POSTHOG_PROXY_PATH}/static/:path*`, destination: `${POSTHOG_ASSETS_HOST}/static/:path*` },
  { source: `${POSTHOG_PROXY_PATH}/:path*`, destination: `${POSTHOG_API_HOST}/:path*` },
];

/** Browser init options. No visitor is identified, so no person profiles are made. */
export const posthogOptions = {
  api_host: POSTHOG_PROXY_PATH,
  ui_host: "https://eu.posthog.com",
  defaults: "2026-08-30",
  person_profiles: "identified_only",
} as const;
