import { describe, expect, test, vi } from "vitest";
import { createRevalidator } from "@/lib/worker/revalidate";

const EN = "https://mynextboardgame.com";
const RU = "https://ru.mynextboardgame.com";

/** Answers like the sites do: a sitemap with one page, 200 for everything else. */
function siteFetch(override?: (url: string) => Response | undefined) {
  return vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const address = String(url);
    const answer = override?.(address);
    if (answer) return answer;
    if (address.endsWith("/sitemap.xml")) return new Response(`<urlset><url><loc>${new URL(address).origin}/</loc></url></urlset>`);
    return new Response("{}", { status: 200 });
  });
}

function calls(fetchImpl: ReturnType<typeof siteFetch>) {
  return fetchImpl.mock.calls.map(([url, init]) => `${(init as RequestInit | undefined)?.method ?? "GET"} ${String(url)}`);
}

describe("createRevalidator", () => {
  test("posts with the bearer secret then warms the first page of each prebuilt language", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await createRevalidator("https://x.vercel.app/api/revalidate", "s", fetchImpl)();

    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://x.vercel.app/api/revalidate",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer s" } }),
    );
    // A preview run refreshes only itself and tells no search engine.
    expect(calls(fetchImpl)).toEqual([
      "POST https://x.vercel.app/api/revalidate",
      "GET https://x.vercel.app/",
      "GET https://x.vercel.app/ru",
      "GET https://x.vercel.app/en",
    ]);
  });

  test("on a public site, refreshes every language's site and tells search engines about each, surviving a failure", async () => {
    const fetchImpl = siteFetch();
    const log = vi.fn();
    await createRevalidator(`${EN}/api/revalidate`, "s", fetchImpl as typeof fetch, log)();
    expect(calls(fetchImpl)).toContain(`POST ${RU}/api/revalidate`);
    expect(calls(fetchImpl)).toContain(`GET ${RU}/ru`);
    expect(fetchImpl).toHaveBeenCalledWith(`${RU}/api/revalidate`, expect.objectContaining({ headers: { Authorization: "Bearer s" } }));
    expect(log).toHaveBeenCalledWith("IndexNow mynextboardgame.com: 1 pages submitted.");
    expect(log).toHaveBeenCalledWith("IndexNow ru.mynextboardgame.com: 1 pages submitted.");

    const failing = siteFetch((url) => (url.includes("indexnow") ? new Response(null, { status: 429 }) : undefined));
    await expect(createRevalidator(`${EN}/api/revalidate`, "s", failing as typeof fetch, log)()).resolves.toBeUndefined();
    expect(log).toHaveBeenLastCalledWith("IndexNow ru.mynextboardgame.com not notified: IndexNow answered 429");
  });

  test("follows a redirect from an old address to a public site, secret included", async () => {
    const fetchImpl = siteFetch((url) =>
      url.startsWith("https://bg.gsnv.dev/") ? new Response(null, { status: 301, headers: { location: `${RU}/api/revalidate` } }) : undefined,
    );
    const log = vi.fn();
    await createRevalidator("https://bg.gsnv.dev/api/revalidate", "s", fetchImpl as typeof fetch, log)();
    expect(fetchImpl).toHaveBeenNthCalledWith(2, `${RU}/api/revalidate`, expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer s" } }));
    expect(calls(fetchImpl)).toContain(`POST ${EN}/api/revalidate`);
    expect(log).toHaveBeenCalledWith("IndexNow mynextboardgame.com: 1 pages submitted.");
  });

  test("never sends the secret to a host a redirect names other than the public sites", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 307, headers: { location: "https://evil.example/collect" } }));
    await expect(createRevalidator("https://x.vercel.app/api/revalidate", "s", fetchImpl)()).rejects.toThrow("307");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test("throws when revalidation is rejected", async () => {
    const fetchImpl = vi.fn(async () => new Response("no", { status: 401 }));

    await expect(createRevalidator("https://x.vercel.app/api/revalidate", "s", fetchImpl)()).rejects.toThrow("401");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
