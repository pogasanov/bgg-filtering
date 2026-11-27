import { describe, expect, test } from "vitest";
import robots, { AI_TRAINING_AGENTS } from "@/app/robots";

describe("robots.txt", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];

  test("lets every crawler, AI search included, read the pages but not the API, relay or internal routes", () => {
    const all = rules.find((rule) => rule.userAgent === "*")!;
    expect(all.allow).toBe("/");
    expect(all.disallow).toEqual(expect.arrayContaining(["/api/", "/relay/", "/view", "/page/"]));
    expect(all.other).toEqual({ "Clean-param": "sort&dir" });
    for (const agent of ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "YandexBot", "YandexAdditional"]) {
      expect(rules.some((rule) => [rule.userAgent].flat().includes(agent))).toBe(false);
    }
  });

  test("keeps AI training crawlers and the shared training signal out", () => {
    const training = rules.find((rule) => rule.userAgent !== "*")!;
    expect(training.disallow).toBe("/");
    expect(training.userAgent).toEqual(AI_TRAINING_AGENTS);
    expect(AI_TRAINING_AGENTS).toEqual(expect.arrayContaining(["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "__usage_ai-training"]));
  });

  test("points to the sitemap on the public address", () => {
    expect(result.sitemap).toBe("https://bg.gsnv.dev/sitemap.xml");
  });
});
