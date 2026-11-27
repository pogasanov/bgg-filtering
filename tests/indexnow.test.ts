import { readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";
import { INDEXNOW_KEY, notifyIndexNow, sitemapLocations } from "@/lib/indexnow";

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://bg.gsnv.dev/</loc></url>
<url><loc>https://bg.gsnv.dev/?page=2&amp;x=1</loc></url>
<url><loc>https://elsewhere.example/</loc></url>
</urlset>`;

describe("IndexNow", () => {
  test("serves the key at the site root", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    expect(readFileSync(new URL(`../public/${INDEXNOW_KEY}.txt`, import.meta.url), "utf8")).toBe(INDEXNOW_KEY);
  });

  test("reads the page addresses from a sitemap", () => {
    expect(sitemapLocations(sitemap)).toEqual(["https://bg.gsnv.dev/", "https://bg.gsnv.dev/?page=2&x=1", "https://elsewhere.example/"]);
  });

  test("submits the site's own sitemap pages in one request", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/sitemap.xml") ? new Response(sitemap) : new Response(null, { status: 202 }),
    );
    await expect(notifyIndexNow("https://bg.gsnv.dev", fetchImpl as typeof fetch)).resolves.toBe(2);
    const [url, init] = fetchImpl.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(String(init.body))).toEqual({
      host: "bg.gsnv.dev",
      key: INDEXNOW_KEY,
      keyLocation: `https://bg.gsnv.dev/${INDEXNOW_KEY}.txt`,
      urlList: ["https://bg.gsnv.dev/", "https://bg.gsnv.dev/?page=2&x=1"],
    });
  });

  test("fails loudly when the sitemap or IndexNow refuses", async () => {
    await expect(notifyIndexNow("https://bg.gsnv.dev", vi.fn(async () => new Response("", { status: 500 })))).rejects.toThrow("sitemap.xml answered 500");
    const refusing = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/sitemap.xml") ? new Response(sitemap) : new Response(null, { status: 403 }),
    );
    await expect(notifyIndexNow("https://bg.gsnv.dev", refusing as typeof fetch)).rejects.toThrow("IndexNow answered 403");
  });
});
