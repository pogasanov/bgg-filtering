import { describe, expect, it } from "vitest";
import { buildUserAgent, createShopGet, ShopBlockedError } from "@/lib/prices/http";

type Call = { url: string; userAgent: string | null };

function harness(options: { robots?: string; respond?: (url: string) => Response } = {}) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  let clock = 1_000_000;
  let inFlight = 0;
  let maxInFlight = 0;

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, userAgent: new Headers(init?.headers).get("user-agent") });
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await Promise.resolve();
    inFlight -= 1;
    if (url.endsWith("/robots.txt")) return new Response(options.robots ?? "User-agent: *\nDisallow: /private\n");
    return options.respond ? options.respond(url) : new Response("ok");
  }) as typeof fetch;

  const get = createShopGet({
    origin: "https://shop.example",
    userAgent: buildUserAgent(),
    fetchImpl,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    now: () => clock,
  });

  const pages = () => calls.filter((call) => !call.url.endsWith("/robots.txt"));
  return { get, calls, sleeps, pages, maxInFlight: () => maxInFlight };
}

describe("buildUserAgent", () => {
  it("names the bot honestly, with the info URL when given", () => {
    expect(buildUserAgent()).toBe("BggPlayerFinderBot/0.1 (non-commercial price history)");
    expect(buildUserAgent("https://x.example")).toBe(
      "BggPlayerFinderBot/0.1 (non-commercial price history; +https://x.example)",
    );
  });
});

describe("createShopGet", () => {
  it("spaces consecutive requests at least 2 seconds apart", async () => {
    const h = harness();
    await h.get("https://shop.example/a");
    await h.get("https://shop.example/b");
    expect(h.pages().map((call) => call.url)).toEqual(["https://shop.example/a", "https://shop.example/b"]);
    expect(h.sleeps.reduce((sum, ms) => sum + ms, 0)).toBeGreaterThanOrEqual(2000);
  });

  it("runs concurrent calls one after the other", async () => {
    const h = harness();
    await Promise.all([h.get("https://shop.example/a"), h.get("https://shop.example/b"), h.get("https://shop.example/c")]);
    expect(h.maxInFlight()).toBe(1);
    expect(h.pages()).toHaveLength(3);
  });

  it("refuses a URL robots.txt disallows, fetching robots.txt only once", async () => {
    const h = harness();
    await expect(h.get("https://shop.example/private/x")).rejects.toThrow(/robots/i);
    await h.get("https://shop.example/a");
    expect(h.pages().map((call) => call.url)).toEqual(["https://shop.example/a"]);
    expect(h.calls.filter((call) => call.url.endsWith("/robots.txt"))).toHaveLength(1);
  });

  it("refuses another origin", async () => {
    const h = harness();
    await expect(h.get("https://other.example/a")).rejects.toThrow(/origin/i);
    expect(h.calls).toHaveLength(0);
  });

  it("sends the honest User-Agent", async () => {
    const h = harness();
    await h.get("https://shop.example/a");
    expect(h.calls.every((call) => call.userAgent === buildUserAgent())).toBe(true);
  });

  it("raises ShopBlockedError on 403 and 429", async () => {
    for (const status of [403, 429]) {
      const h = harness({ respond: () => new Response("no", { status }) });
      const error = await h.get("https://shop.example/a").catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(ShopBlockedError);
      expect((error as ShopBlockedError).status).toBe(status);
      expect((error as ShopBlockedError).url).toBe("https://shop.example/a");
    }
  });

  it("raises a plain error naming status and URL on other failures", async () => {
    const h = harness({ respond: () => new Response("boom", { status: 500 }) });
    const error = await h.get("https://shop.example/a").catch((caught: unknown) => caught);
    expect(error).not.toBeInstanceOf(ShopBlockedError);
    expect(String(error)).toContain("500");
    expect(String(error)).toContain("https://shop.example/a");
  });

  it("treats a blocked robots.txt as a block, not as permission", async () => {
    const calls: string[] = [];
    const get = createShopGet({
      origin: "https://shop.example",
      userAgent: buildUserAgent(),
      fetchImpl: (async (input: RequestInfo | URL) => {
        calls.push(String(input));
        return new Response("no", { status: 403 });
      }) as typeof fetch,
      sleep: async () => {},
      now: () => 0,
    });
    await expect(get("https://shop.example/a")).rejects.toBeInstanceOf(ShopBlockedError);
    expect(calls).toEqual(["https://shop.example/robots.txt"]);
  });

  it("decodes windows-1251 when asked", async () => {
    const bytes = new Uint8Array([0xd6, 0xe8, 0xf2, 0xe0, 0xe4, 0xe5, 0xeb, 0xe8]);
    const h = harness({ respond: () => new Response(bytes) });
    expect(await h.get("https://shop.example/a", { encoding: "windows-1251" })).toBe("Цитадели");
  });
});

describe("createShopGet — redirects", () => {
  function redirecting(routes: Record<string, Response | (() => Response)>, robots = "User-agent: *\nDisallow: /private\n") {
    const calls: string[] = [];
    const get = createShopGet({
      origin: "https://shop.example",
      userAgent: buildUserAgent(),
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push(url);
        expect(init?.redirect).toBe("manual");
        if (url.endsWith("/robots.txt")) return new Response(robots);
        const route = routes[url];
        return typeof route === "function" ? route() : (route ?? new Response("missing", { status: 404 }));
      }) as typeof fetch,
      sleep: async () => {},
      now: () => 0,
    });
    return { get, calls };
  }
  const redirect = (location: string) => () => new Response(null, { status: 301, headers: { location } });

  it("follows a redirect inside the shop", async () => {
    const { get } = redirecting({
      "https://shop.example/a": redirect("/a/"),
      "https://shop.example/a/": () => new Response("page"),
    });
    expect(await get("https://shop.example/a")).toBe("page");
  });

  it("refuses a redirect to another origin without requesting it", async () => {
    const { get, calls } = redirecting({ "https://shop.example/a": redirect("https://other.example/x") });
    await expect(get("https://shop.example/a")).rejects.toThrow(/origin/i);
    expect(calls).not.toContain("https://other.example/x");
  });

  it("refuses a redirect to a path robots.txt disallows", async () => {
    const { get, calls } = redirecting({ "https://shop.example/a": redirect("/private/x") });
    await expect(get("https://shop.example/a")).rejects.toThrow(/robots/i);
    expect(calls).not.toContain("https://shop.example/private/x");
  });

  it("gives up on a redirect loop", async () => {
    const { get } = redirecting({
      "https://shop.example/a": redirect("/b"),
      "https://shop.example/b": redirect("/a"),
    });
    await expect(get("https://shop.example/a")).rejects.toThrow(/redirect/i);
  });
});

describe("createShopGet — network errors", () => {
  function flaky(failures: number) {
    let pageAttempts = 0;
    const sleeps: number[] = [];
    const get = createShopGet({
      origin: "https://shop.example",
      userAgent: buildUserAgent(),
      fetchImpl: (async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/robots.txt")) return new Response("");
        pageAttempts += 1;
        if (pageAttempts <= failures) throw new TypeError("fetch failed");
        return new Response("page");
      }) as typeof fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => 0,
    });
    return { get, attempts: () => pageAttempts, sleeps };
  }

  it("tries again after a dropped connection, still spaced apart", async () => {
    const h = flaky(2);
    expect(await h.get("https://shop.example/a")).toBe("page");
    expect(h.attempts()).toBe(3);
    expect(h.sleeps.filter((ms) => ms >= 2000).length).toBeGreaterThanOrEqual(2);
  });

  it("gives up after three attempts and says which URL failed", async () => {
    const h = flaky(5);
    await expect(h.get("https://shop.example/a")).rejects.toThrow("https://shop.example/a");
    expect(h.attempts()).toBe(3);
  });
});

