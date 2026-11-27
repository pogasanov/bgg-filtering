/**
 * PostHog is reached through this site: the browser talks to bg.gsnv.dev/<path>, and Vercel passes
 * the requests on to PostHog's EU hosts. The path is deliberately neutral: blocker lists match
 * "posthog", "analytics", "ingest" and the like.
 */
export const POSTHOG_PROXY_PATH = "/relay";

const POSTHOG_API_HOST = "https://eu.i.posthog.com";
const POSTHOG_ASSETS_HOST = "https://eu-assets.i.posthog.com";

/**
 * Blockers also match the SDK's lazy-loaded scripts by file name ("posthog-recorder.js",
 * "web-vitals-with-attribution.js"), whatever host they come from. So each one is requested under
 * a neutral name in its own directory, and a rewrite maps the name back to the real file.
 * Keep an alias once published: a cached page may still ask for it.
 */
export const POSTHOG_SCRIPT_ALIASES: Readonly<Record<string, string>> = {
  "posthog-recorder": "m1",
  "lazy-recorder": "m2",
  recorder: "m3",
  "recorder-v2": "m4",
  "dead-clicks-autocapture": "m5",
  "exception-autocapture": "m6",
  "web-vitals": "m7",
  "web-vitals-soft-navs": "m8",
  "web-vitals-with-attribution": "m9",
  "web-vitals-with-attribution-soft-navs": "m10",
  "tracing-headers": "m11",
  surveys: "m12",
  "surveys-preview": "m13",
  "product-tours": "m14",
  "product-tours-preview": "m15",
  conversations: "m16",
  logs: "m17",
  "element-inference": "m18",
};

const SCRIPT_PATH = `${POSTHOG_PROXY_PATH}/m`;

/**
 * Next.js rewrites for the proxy. The renamed scripts come first, then the SDK's other assets, then
 * the API. The SDK asks for a script at "/static/<version>/<name>.js", or "/static/<name>.js?v=…"
 * when that fails; the query string is passed on as it is.
 */
export const posthogProxyRewrites = [
  ...Object.entries(POSTHOG_SCRIPT_ALIASES).flatMap(([name, alias]) => [
    { source: `${SCRIPT_PATH}/:version/${alias}.js`, destination: `${POSTHOG_ASSETS_HOST}/static/:version/${name}.js` },
    { source: `${SCRIPT_PATH}/${alias}.js`, destination: `${POSTHOG_ASSETS_HOST}/static/${name}.js` },
  ]),
  { source: `${POSTHOG_PROXY_PATH}/static/:path*`, destination: `${POSTHOG_ASSETS_HOST}/static/:path*` },
  { source: `${POSTHOG_PROXY_PATH}/:path*`, destination: `${POSTHOG_API_HOST}/:path*` },
];

const STATIC_SCRIPT = new RegExp(`^${POSTHOG_PROXY_PATH}/static/(?:([^/]+)/)?([a-z0-9-]+)\\.js$`);

/** Points a script URL the SDK built at its neutral name; anything without an alias is left alone. */
export function neutralScriptUrl(src: string, base: string): string {
  const url = new URL(src, base);
  const match = STATIC_SCRIPT.exec(url.pathname);
  const alias = match ? POSTHOG_SCRIPT_ALIASES[match[2]] : undefined;
  if (!match || !alias) return src;
  url.pathname = match[1] ? `${SCRIPT_PATH}/${match[1]}/${alias}.js` : `${SCRIPT_PATH}/${alias}.js`;
  return url.toString();
}

/** Browser init options. No visitor is identified, so no person profiles are made. */
export const posthogOptions = {
  api_host: POSTHOG_PROXY_PATH,
  ui_host: "https://eu.posthog.com",
  defaults: "2026-08-30",
  person_profiles: "identified_only",
  prepare_external_dependency_script: (script: HTMLScriptElement) => {
    script.src = neutralScriptUrl(script.src, window.location.href);
    return script;
  },
} as const;
