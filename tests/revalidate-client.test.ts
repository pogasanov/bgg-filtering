import { describe, expect, test, vi } from "vitest";
import { createRevalidator } from "@/lib/worker/revalidate";

describe("createRevalidator", () => {
  test("posts with the bearer secret then warms the first page of each prebuilt language", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await createRevalidator("https://x.vercel.app/api/revalidate", "s", fetchImpl)();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://x.vercel.app/api/revalidate",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer s" } }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "https://x.vercel.app/", expect.objectContaining({ method: "GET" }));
    expect(fetchImpl).toHaveBeenNthCalledWith(3, "https://x.vercel.app/en", expect.objectContaining({ method: "GET" }));
  });

  test("on the public site, then tells search engines through IndexNow, and survives its failure", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/sitemap.xml")
        ? new Response("<urlset><url><loc>https://mynextboardgame.com/</loc></url></urlset>")
        : new Response("{}", { status: 200 }),
    );
    const log = vi.fn();
    await createRevalidator("https://mynextboardgame.com/api/revalidate", "s", fetchImpl as typeof fetch, log)();
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(fetchImpl).toHaveBeenNthCalledWith(5, "https://api.indexnow.org/indexnow", expect.objectContaining({ method: "POST" }));
    expect(log).toHaveBeenCalledWith("IndexNow: 1 pages submitted.");

    const failing = vi.fn(async (url: string | URL | Request) =>
      String(url).includes("indexnow") ? new Response(null, { status: 429 }) : new Response("<urlset><url><loc>https://mynextboardgame.com/</loc></url></urlset>"),
    );
    await expect(createRevalidator("https://mynextboardgame.com/api/revalidate", "s", failing as typeof fetch, log)()).resolves.toBeUndefined();
    expect(log).toHaveBeenLastCalledWith("IndexNow not notified: IndexNow answered 429");
  });

  test("follows a redirect from an old address to the public site, secret included, and notifies IndexNow", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const address = String(url);
      if (address.startsWith("https://bg.gsnv.dev/")) {
        return new Response(null, { status: 308, headers: { location: "https://mynextboardgame.com/api/revalidate" } });
      }
      if (address.endsWith("/sitemap.xml")) return new Response("<urlset><url><loc>https://mynextboardgame.com/</loc></url></urlset>");
      return new Response("{}", { status: 200 });
    });
    const log = vi.fn();
    await createRevalidator("https://bg.gsnv.dev/api/revalidate", "s", fetchImpl as typeof fetch, log)();
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "https://mynextboardgame.com/api/revalidate",
      expect.objectContaining({ method: "POST", headers: { Authorization: "Bearer s" } }),
    );
    expect(fetchImpl).toHaveBeenNthCalledWith(3, "https://mynextboardgame.com/", expect.objectContaining({ method: "GET" }));
    expect(log).toHaveBeenCalledWith("IndexNow: 1 pages submitted.");
  });

  test("never sends the secret to a host a redirect names other than the public site", async () => {
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
