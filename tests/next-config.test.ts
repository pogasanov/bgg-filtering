import { describe, expect, test } from "vitest";
import { neutralScriptUrl, POSTHOG_SCRIPT_ALIASES, posthogProxyRewrites } from "@/lib/posthog-options";
import nextConfig, { HTML_LIMITED_BOTS } from "@/next.config";

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

describe("Search engine headers", () => {
  test("keeps title searches out of the index on every list address", async () => {
    const headers = await nextConfig.headers!();
    const search = headers.filter((rule) => rule.has?.some((condition) => condition.type === "query" && condition.key === "q"));
    expect(search.map((rule) => rule.source)).toEqual(["/", expect.stringContaining(":lang")]);
    for (const rule of search) expect(rule.headers).toEqual([{ key: "X-Robots-Tag", value: "noindex, follow" }]);
    const value = new RegExp(`^${search[0].has![0].value}$`);
    expect(value.test("крылья")).toBe(true);
    expect(value.test("  ")).toBe(false);
  });
});

describe("Bots served blocking metadata", () => {
  test("are the link-preview bots, Telegram's included, not the search engines that can read the cached pages", () => {
    expect(nextConfig.htmlLimitedBots).toBe(HTML_LIMITED_BOTS);
    for (const agent of ["TelegramBot (like TwitterBot)", "facebookexternalhit/1.1", "Mozilla/5.0 (compatible; vkShare; +http://vk.com/dev/Share)", "Slackbot-LinkExpanding 1.0"]) {
      expect(HTML_LIMITED_BOTS.test(agent), agent).toBe(true);
    }
    for (const agent of [
      "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
      "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.3; +https://openai.com/searchbot",
    ]) {
      expect(HTML_LIMITED_BOTS.test(agent), agent).toBe(false);
    }
  });
});
