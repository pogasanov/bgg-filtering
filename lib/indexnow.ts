/**
 * IndexNow: tells Yandex, Bing and the other participating search engines which pages changed, so
 * they recrawl them without waiting. One submission is shared with every participating engine.
 * The key is public by design: the same value is served at /<key>.txt (public/) to prove the site is ours.
 */
export const INDEXNOW_KEY = "d7595f615a6c2b745ea4ef9c10169894";
const ENDPOINT = "https://api.indexnow.org/indexnow";
/** The protocol's limit per request. */
const MAX_URLS = 10_000;

/** The page addresses a sitemap lists. */
export function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) =>
    match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"),
  );
}

/**
 * Submits every page in the site's sitemap. Call after the content changed (a sync, a price run):
 * resubmitting unchanged pages counts against the site's crawl quota. Returns how many were sent.
 */
export async function notifyIndexNow(siteUrl: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const origin = new URL(siteUrl).origin;
  const sitemap = await fetchImpl(`${origin}/sitemap.xml`, { method: "GET" });
  if (!sitemap.ok) throw new Error(`sitemap.xml answered ${sitemap.status}`);
  const urls = sitemapLocations(await sitemap.text()).filter((url) => url.startsWith(`${origin}/`)).slice(0, MAX_URLS);
  if (urls.length === 0) return 0;

  const response = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(origin).host, key: INDEXNOW_KEY, keyLocation: `${origin}/${INDEXNOW_KEY}.txt`, urlList: urls }),
  });
  // 200: accepted; 202: accepted, the key is still being checked.
  if (!response.ok) throw new Error(`IndexNow answered ${response.status}`);
  return urls.length;
}
