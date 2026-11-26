import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { fileURLToPath } from "node:url";
import { filterParamKeys } from "./lib/url-state";

/**
 * A language prefix: one lower-case path segment, as `languageSlug` writes it. Rewrites run as a
 * chain, so the internal routes "/" is rewritten to ("/view", "/page") must not pass for a language.
 */
const LANGUAGE_SOURCE = "/:lang((?!(?:view|page|api)(?:/|$))[a-z0-9-]+)";

const root = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Rendered output is cached explicitly with "use cache"; whatever is not cached runs per request.
  cacheComponents: true,
  partialPrefetching: true,
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
