import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { fileURLToPath } from "node:url";
import { POSTHOG_PROXY_PATH, posthogProxyRewrites } from "./lib/posthog-options";
import { filterParamKeys } from "./lib/url-state";

/**
 * A language prefix: one lower-case path segment, as `languageSlug` writes it. Rewrites run as a
 * chain, so the internal routes "/" is rewritten to ("/view", "/page") must not pass for a language.
 */
const LANGUAGE_SOURCE = `/:lang((?!(?:view|page|api|${POSTHOG_PROXY_PATH.slice(1)})(?:/|$))[a-z0-9-]+)`;

export const HTML_LIMITED_BOTS =
  /[\w-]+-Google|Google-[\w-]+|Chrome-Lighthouse|bitlybot|tumblr|vkShare|quora link preview|redditbot|BingPreview|facebookexternalhit|facebookcatalog|Twitterbot|LinkedInBot|Slackbot|Discordbot|WhatsApp|SkypeUriPreview|TelegramBot|googleweblight/i;

const root = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Rendered output is cached explicitly with "use cache"; whatever is not cached runs per request.
  cacheComponents: true,
  // PostHog posts to paths ending in "/" ("/e/"); a redirect to drop the slash would break them.
  skipTrailingSlashRedirect: true,
  partialPrefetching: true,
  // Bots listed here get every page rendered per request, with the metadata in <head>, because they
  // cannot read metadata streamed later in the page. Next's default list also has the search engines
  // (YandexBot, Bingbot…): they got 2 MB pages rendered on every visit instead of the cached static
  // ones, whose metadata is already in <head>. Kept: the link-preview bots, for shared filtered links
  // whose metadata is streamed; added: Telegram's, which the default list lacks.
  htmlLimitedBots: HTML_LIMITED_BOTS,
  async headers() {
    // A title search is endless and adds nothing a list page lacks: kept out of the index. Sent as
    // a header because a view's metadata is streamed and crawlers that read no script would miss it.
    const search = [{ type: "query" as const, key: "q", value: ".*\\S.*" }];
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, follow" }];
    return [
      { source: "/", has: search, headers: noindex },
      { source: LANGUAGE_SOURCE, has: search, headers: noindex },
    ];
  },
  async redirects() {
    // Russian is the default language and lives at "/", without a prefix.
    return [{ source: "/ru", destination: "/", permanent: true }];
  },
  async rewrites() {
    const filterQuery = filterParamKeys.map((key) => ({ type: "query" as const, key }));
    const pageQuery = { type: "query" as const, key: "page", value: "(?<number>[1-9]\\d*)" };
    return {
      // Static pages never read the URL, so the query picks the route here, with the address bar left
      // as it was. Any filter or sort goes to the view route, which renders per request. A page number
      // alone goes to the static page of the full list. "/" with neither is the static first page.
      // Every language other than Russian has the same routes under its own prefix ("/en").
      beforeFiles: [
        // PostHog through our own domain, so blockers and blocked hosts don't drop the analytics.
        ...posthogProxyRewrites,
        ...filterQuery.map((has) => ({ source: "/", has: [has], destination: "/view" })),
        { source: "/", has: [pageQuery], missing: filterQuery, destination: "/page/:number" },
        ...filterQuery.map((has) => ({ source: LANGUAGE_SOURCE, has: [has], destination: "/view/:lang" })),
        { source: LANGUAGE_SOURCE, has: [pageQuery], missing: filterQuery, destination: "/:lang/page/:number" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
  turbopack: {
    root,
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
