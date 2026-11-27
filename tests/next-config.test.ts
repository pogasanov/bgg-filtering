import { describe, expect, test } from "vitest";
import {
  neutralRequestUrl,
  neutralScriptUrl,
  POSTHOG_PATH_ALIASES,
  POSTHOG_SCRIPT_ALIASES,
  posthogProxyRewrites,
} from "@/lib/posthog-options";
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

  test("sends API requests to neutral paths, each rewritten back to PostHog", () => {
    const rewrite = (path: string) => neutralRequestUrl(new URL(path, "https://bg.gsnv.dev")).toString();
    expect(rewrite("/relay/i/v0/e/?ip=0&compression=gzip-js")).toBe("https://bg.gsnv.dev/relay/c2?ip=0&compression=gzip-js");
    expect(rewrite("/relay/e/")).toBe("https://bg.gsnv.dev/relay/c1");
    expect(rewrite("/relay/s/?ver=1")).toBe("https://bg.gsnv.dev/relay/c4?ver=1");
    expect(rewrite("/relay/flags/?v=2&config=true")).toBe("https://bg.gsnv.dev/relay/c5?v=2&config=true");
    expect(rewrite("/relay/array/phc_abc/config")).toBe("https://bg.gsnv.dev/relay/k/phc_abc/v");
    expect(rewrite("/relay/array/phc_abc/config.js")).toBe("https://bg.gsnv.dev/relay/k/phc_abc/v.js");
    expect(rewrite("/relay/i/v1/metrics")).toBe("https://bg.gsnv.dev/relay/i/v1/metrics");
    expect(rewrite("https://eu.i.posthog.com/e/")).toBe("https://eu.i.posthog.com/e/");

    for (const [path, alias] of Object.entries(POSTHOG_PATH_ALIASES)) {
      expect(posthogProxyRewrites).toContainEqual({ source: `/relay${alias}`, destination: `https://eu.i.posthog.com${path}` });
    }
    expect(posthogProxyRewrites).toContainEqual({ source: "/relay/k/:token/v", destination: "https://eu-assets.i.posthog.com/array/:token/config" });
    expect(new Set(Object.values(POSTHOG_PATH_ALIASES)).size).toBe(Object.keys(POSTHOG_PATH_ALIASES).length);
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

describe("Collection addresses", () => {
  test("map each short address to the collection route, ahead of the language rules", async () => {
    const rewrites = await nextConfig.rewrites!();
    if (Array.isArray(rewrites)) throw new Error("expected grouped rewrites");
    const before = rewrites.beforeFiles ?? [];
    const collection = before.findIndex((rule) => rule.source === "/na-dvoih");
    expect(before[collection]).toMatchObject({ destination: "/podborka/na-dvoih" });
    expect(collection).toBeLessThan(before.findIndex((rule) => rule.destination === "/view/:lang"));
    // Neither a collection nor the game or mechanic prefix can pass for a language.
    const language = before.find((rule) => rule.destination === "/view/:lang")!.source;
    for (const segment of ["na-dvoih", "igra", "mehaniki", "podborka"]) expect(language).toContain(segment);
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
