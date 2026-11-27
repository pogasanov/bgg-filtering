import { describe, expect, test } from "vitest";
import { neutralScriptUrl, POSTHOG_SCRIPT_ALIASES, posthogProxyRewrites } from "@/lib/posthog-options";
import nextConfig from "@/next.config";

describe("Next development origins", () => {
  test("allows the WSL loopback host used to open the local app", () => {
    expect(nextConfig.allowedDevOrigins).toContain("127.0.0.1");
  });
});

describe("PostHog proxy", () => {
  test("rewrites the proxy path to PostHog ahead of the catalog routes", async () => {
    const rewrites = await nextConfig.rewrites!();
    if (Array.isArray(rewrites)) throw new Error("expected grouped rewrites");
    const before = rewrites.beforeFiles ?? [];
    const proxy = before.slice(0, posthogProxyRewrites.length);
    expect(proxy).toEqual(posthogProxyRewrites);
    expect(proxy.at(-2)).toMatchObject({ source: "/relay/static/:path*", destination: "https://eu-assets.i.posthog.com/static/:path*" });
    expect(proxy.at(-1)).toMatchObject({ source: "/relay/:path*", destination: "https://eu.i.posthog.com/:path*" });
  });

  test("maps every neutral script name back to its real file, with and without a version", () => {
    for (const [name, alias] of Object.entries(POSTHOG_SCRIPT_ALIASES)) {
      expect(posthogProxyRewrites).toContainEqual({
        source: `/relay/m/:version/${alias}.js`,
        destination: `https://eu-assets.i.posthog.com/static/:version/${name}.js`,
      });
      expect(posthogProxyRewrites).toContainEqual({
        source: `/relay/m/${alias}.js`,
        destination: `https://eu-assets.i.posthog.com/static/${name}.js`,
      });
    }
    expect(new Set(Object.values(POSTHOG_SCRIPT_ALIASES)).size).toBe(Object.keys(POSTHOG_SCRIPT_ALIASES).length);
  });

  test("requests lazy-loaded scripts under neutral names", () => {
    const base = "https://bg.gsnv.dev/";
    expect(neutralScriptUrl("https://bg.gsnv.dev/relay/static/1.455.2/posthog-recorder.js", base)).toBe(
      "https://bg.gsnv.dev/relay/m/1.455.2/m1.js",
    );
    expect(neutralScriptUrl("https://bg.gsnv.dev/relay/static/web-vitals-with-attribution.js?v=1.455.2", base)).toBe(
      "https://bg.gsnv.dev/relay/m/m9.js?v=1.455.2",
    );
    expect(neutralScriptUrl("/relay/static/toolbar.js?t=1", base)).toBe("/relay/static/toolbar.js?t=1");
    expect(neutralScriptUrl("https://us-assets.i.posthog.com/static/surveys.js", base)).toBe(
      "https://us-assets.i.posthog.com/static/surveys.js",
    );
  });

  test("keeps the trailing slash PostHog's endpoints use", () => {
    expect(nextConfig.skipTrailingSlashRedirect).toBe(true);
  });
});
