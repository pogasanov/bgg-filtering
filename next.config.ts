import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { fileURLToPath } from "node:url";
import { MECHANIC_COLLECTION_ROUTE, mechanicCollectionPrefix, PLAYER_COLLECTION_ROUTE, playerCollectionsOf } from "./lib/collections";
import { GAME_ROUTE, gamePrefix } from "./lib/game-page";
import { locales, SITE_LOCALE, SITE_URLS } from "./lib/i18n/locale";
import { POSTHOG_PROXY_PATH, posthogProxyRewrites } from "./lib/posthog-options";
import { filterParamKeys } from "./lib/url-state";

/** The other language's site, whose addresses this site sends on to it. */
const OTHER_LOCALES = locales.filter((locale) => locale !== SITE_LOCALE);

/**
 * First path segments that are not edition languages: internal routes, the proxy, and the
 * collections and game pages of every language's site (the other's are redirected to it).
 */
const RESERVED_SEGMENTS = [
  "view",
  "page",
  "api",
  POSTHOG_PROXY_PATH.slice(1),
  PLAYER_COLLECTION_ROUTE,
  MECHANIC_COLLECTION_ROUTE,
  GAME_ROUTE,
  ...locales.flatMap((locale) => [mechanicCollectionPrefix(locale), gamePrefix(locale), ...playerCollectionsOf(locale).map(({ slug }) => slug)]),
];

/**
 * A language prefix: one lower-case path segment, as `languageSlug` writes it. Rewrites run as a
 * chain, so the internal routes "/" is rewritten to ("/view", "/page") must not pass for a language.
 */
const LANGUAGE_SOURCE = `/:lang((?!(?:${RESERVED_SEGMENTS.join("|")})(?:/|$))[a-z0-9-]+)`;

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
    return [
      // 301 rather than Next's 308: Yandex documents 301 for a moved page.
      // Every edition is the default and lives at "/", without a prefix; "/any" was its old address.
      { source: "/any", destination: "/", statusCode: 301 },
      // The other language's collections and game pages, reached on this site by an old or shared
      // link, open on that language's site. The address is the same there.
      ...OTHER_LOCALES.flatMap((locale) => {
        const site = SITE_URLS[locale];
        // The Russian prefixes are this site's internal routes too: on the English site they are only
        // redirected when asked for directly, which the rewrites below never do.
        return [
          { source: `/${gamePrefix(locale)}/:slug`, destination: `${site}/${gamePrefix(locale)}/:slug`, statusCode: 301 },
          { source: `/${mechanicCollectionPrefix(locale)}/:slug`, destination: `${site}/${mechanicCollectionPrefix(locale)}/:slug`, statusCode: 301 },
          ...playerCollectionsOf(locale).map(({ slug }) => ({ source: `/${slug}`, destination: `${site}/${slug}`, statusCode: 301 })),
        ];
      }),
    ];
  },
  async rewrites() {
    const filterQuery = filterParamKeys.map((key) => ({ type: "query" as const, key }));
    const pageQuery = { type: "query" as const, key: "page", value: "(?<number>[1-9]\\d*)" };
    return {
      // Static pages never read the URL, so the query picks the route here, with the address bar left
      // as it was. Any filter or sort goes to the view route, which renders per request. A page number
      // alone goes to the static page of the full list. "/" with neither is the static first page.
      // Every edition language has the same routes under its own prefix ("/ru", "/en").
      beforeFiles: [
        // PostHog through our own domain, so blockers and blocked hosts don't drop the analytics.
        ...posthogProxyRewrites,
        // Collections live at short addresses in the site's language ("/best-2-player-board-games",
        // "/na-dvoih") on one static route. A query on them is ignored: changing a filter there moves
        // to the usual view.
        ...playerCollectionsOf(SITE_LOCALE).map(({ slug }) => ({ source: `/${slug}`, destination: `/${PLAYER_COLLECTION_ROUTE}/${slug}` })),
        // The English site shows the game and mechanic routes under English names.
        ...(gamePrefix() !== GAME_ROUTE ? [{ source: `/${gamePrefix()}/:slug`, destination: `/${GAME_ROUTE}/:slug` }] : []),
        ...(mechanicCollectionPrefix() !== MECHANIC_COLLECTION_ROUTE
          ? [{ source: `/${mechanicCollectionPrefix()}/:slug`, destination: `/${MECHANIC_COLLECTION_ROUTE}/:slug` }]
          : []),
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
