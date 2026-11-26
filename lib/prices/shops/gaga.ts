import { attribute, decodeEntities, hasClass, openingTags } from "@/lib/prices/html";
import { parseRubles } from "@/lib/prices/text";
import type { ShopAdapter, ShopProduct } from "@/lib/prices/types";

const ORIGIN = "https://gaga.ru";
const PRODUCT_URL = /^https:\/\/gaga\.ru\/game\/[^/]+\/$/;

/** Product page URLs from the sitemap. Category, news and article pages are dropped. */
export function parseGagaSitemap(xml: string): string[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => decodeEntities(match[1]));
  return [...new Set(urls.filter((url) => PRODUCT_URL.test(url)))];
}

/**
 * A product page. Everything comes from the buy (or "notify me") button, which
 * carries the product ID, name, vendor and the price a visitor sees without logging in.
 * Returns `null` when the page has no such button.
 */
export function parseGagaProduct(html: string, url: string): ShopProduct | null {
  const buttons = openingTags(html, "button").filter(
    (tag) => attribute(tag, "data-gid") && attribute(tag, "data-name") !== null,
  );
  if (buttons.length === 0) return null;

  // The same button is repeated on the page. Buttons for different products would
  // mean a layout we do not understand, and guessing risks a wrong price.
  if (new Set(buttons.map((tag) => attribute(tag, "data-gid"))).size > 1) {
    throw new Error(`GaGa product page is unrecognised: buttons for several products at ${url}`);
  }

  const button = buttons[0];
  const title = (attribute(button, "data-name") ?? "").replace(/\s+/g, " ").trim();
  if (title === "") return null;
  const vendor = (attribute(button, "data-vendor") ?? "").trim();

  return {
    shop: "gaga",
    externalId: attribute(button, "data-gid") as string,
    url,
    title,
    vendor: vendor === "" ? null : vendor,
    barcode: null,
    price: parseRubles(attribute(button, "data-price")),
    oldPrice: null,
    available: buttons.some((tag) => hasClass(tag, "add_to_cart")),
    variantCount: 1,
  };
}

export const gagaAdapter: ShopAdapter = {
  code: "gaga",
  origin: ORIGIN,
  /**
   * The catalogue is the sitemap, because robots.txt forbids paging the listing.
   * Each new URL costs one request, so `known` products are reused and `limit`
   * caps how many new pages are read in this call.
   */
  async listCatalog(get, opts) {
    const urls = parseGagaSitemap(await get(`${ORIGIN}/sitemap.xml`));
    if (urls.length === 0) throw new Error("GaGa sitemap empty or unrecognised: no product pages");

    const knownByUrl = new Map((opts?.known ?? []).map((product) => [product.url, product]));
    const total = urls.filter((url) => !knownByUrl.has(url)).length;
    const limit = opts?.limit ?? Infinity;
    const products: ShopProduct[] = [];
    let fetched = 0;

    for (const url of urls) {
      const known = knownByUrl.get(url);
      if (known) {
        products.push(known);
        knownByUrl.delete(url);
        continue;
      }
      if (fetched >= limit) continue;

      const product = parseGagaProduct(await get(url, { encoding: "windows-1251" }), url);
      fetched += 1;
      if (product) products.push(product);
      opts?.onProgress?.(fetched, total);
    }

    // Products the sitemap no longer lists stay known; they are simply not refreshed.
    return [...products, ...knownByUrl.values()];
  },
};
