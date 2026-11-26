import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { fileURLToPath } from "node:url";
import { filterParamKeys } from "./lib/url-state";

const root = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Rendered output is cached explicitly with "use cache"; whatever is not cached runs per request.
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    return {
      // Static pages never read the URL, so the query picks the route here, with the address bar left
      // as it was. Any filter or sort goes to the view route, which renders per request. A page number
      // alone goes to the static page of the full list. "/" with neither is the static first page.
      beforeFiles: [
        ...filterParamKeys.map((key) => ({
          source: "/",
          has: [{ type: "query" as const, key }],
          destination: "/view",
        })),
        {
          source: "/",
          has: [{ type: "query" as const, key: "page", value: "(?<number>[1-9]\\d*)" }],
          missing: filterParamKeys.map((key) => ({ type: "query" as const, key })),
          destination: "/page/:number",
        },
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
