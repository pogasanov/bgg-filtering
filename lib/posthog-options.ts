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
 * Blocker lists also match PostHog's API paths on any host ("/i/v0/e/", "/flags/", "/s/"), so the
 * SDK sends to neutral paths and a rewrite maps each back. Without this a visitor with a blocker
 * reached PostHog with the first pageview (sent to "/e/" before the project settings load) and
 * nothing after it. Keep an alias once published: an open tab may still send to it.
 */
export const POSTHOG_PATH_ALIASES: Readonly<Record<string, string>> = {
  "/e/": "/c1",
  "/i/v0/e/": "/c2",
  "/batch/": "/c3",
  "/s/": "/c4",
  "/flags/": "/c5",
  "/decide/": "/c6",
};

/** The project settings script, "/array/<token>/config" and "config.js", under a neutral directory. */
const CONFIG_PATH = `${POSTHOG_PROXY_PATH}/k`;
const CONFIG_REQUEST = new RegExp(`^${POSTHOG_PROXY_PATH}/array/([^/]+)/config(\\.js)?$`);

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
  ...Object.entries(POSTHOG_PATH_ALIASES).map(([path, alias]) => ({
    source: `${POSTHOG_PROXY_PATH}${alias}`,
    destination: `${POSTHOG_API_HOST}${path}`,
  })),
  { source: `${CONFIG_PATH}/:token/v`, destination: `${POSTHOG_ASSETS_HOST}/array/:token/config` },
  { source: `${CONFIG_PATH}/:token/v.js`, destination: `${POSTHOG_ASSETS_HOST}/array/:token/config.js` },
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

/**
 * Points a request the SDK built at its neutral path; the query string is kept. Requests outside
 * the proxy and paths without an alias are left alone.
 */
export function neutralRequestUrl(url: URL): URL {
  const config = CONFIG_REQUEST.exec(url.pathname);
  if (config) {
    url.pathname = `${CONFIG_PATH}/${config[1]}/v${config[2] ?? ""}`;
    return url;
  }
  if (!url.pathname.startsWith(`${POSTHOG_PROXY_PATH}/`)) return url;
  const alias = POSTHOG_PATH_ALIASES[url.pathname.slice(POSTHOG_PROXY_PATH.length)];
  if (alias) url.pathname = `${POSTHOG_PROXY_PATH}${alias}`;
  return url;
}

/** Browser init options. No visitor is identified, so no person profiles are made. */
export const posthogOptions = {
  api_host: POSTHOG_PROXY_PATH,
  ui_host: "https://eu.posthog.com",
  defaults: "2026-08-30",
  person_profiles: "identified_only",
  rewriteRequestPath: neutralRequestUrl,
  prepare_external_dependency_script: (script: HTMLScriptElement) => {
    script.src = neutralScriptUrl(script.src, window.location.href);
    return script;
  },
} as const;
