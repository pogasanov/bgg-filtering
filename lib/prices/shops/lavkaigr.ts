import { attribute, hasClass, openingTags, textContent } from "@/lib/prices/html";
import { parseRubles } from "@/lib/prices/text";
import type { ShopAdapter, ShopProduct } from "@/lib/prices/types";

const ORIGIN = "https://www.lavkaigr.ru";

function toProduct(block: string): ShopProduct | null {
  const photo = openingTags(block, "div").find((tag) => hasClass(tag, "photo-block"));
  const externalId = photo ? attribute(photo, "data-id") : null;
  const name = /<a\b[^>]*class="[^"]*\bgame-name\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(block);
  if (!externalId || !name) return null;

  const href = attribute(name[0].slice(0, name[0].indexOf(">") + 1), "href");
  const title = textContent(name[1]);
  if (!href || title === "") return null;

  // In stock means a buy button; otherwise the shop offers "notify me" and only lists a price.
  // The button must carry this product's own ID, so a stray button never lends its price.
  const buy = openingTags(block, "a").find((tag) => hasClass(tag, "buy-mini") && attribute(tag, "data-id") === externalId);
  const listed = /<p\b[^>]*class="[^"]*\bprice\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i.exec(block);

  return {
    shop: "lavkaigr",
    externalId,
    url: new URL(href, ORIGIN).href,
    title,
    vendor: null,
    barcode: null,
    price: buy ? parseRubles(attribute(buy, "data-price")) : parseRubles(listed ? textContent(listed[1]) : null),
    oldPrice: null,
    available: Boolean(buy),
    variantCount: 1,
  };
}

/** One page of `/shop/?page=N`. Throws when the page is not the shop listing. */
export function parseLavkaListing(html: string): { products: ShopProduct[]; lastPage: number } {
  const start = html.search(/<div\b[^>]*class="[^"]*\bproduct-list\b/i);
  if (start === -1) throw new Error("Lavka Igr listing is unrecognised: no product list");

  const end = html.indexOf('<div class="pagenator"', start);
  const blocks = html
    .slice(start, end === -1 ? undefined : end)
    .split(/(?=<div class="block">)/)
    .filter((chunk) => chunk.startsWith('<div class="block">') && chunk.includes("photo-block"));
  const products = blocks.map(toProduct);
  if (products.some((product) => product === null)) {
    throw new Error("Lavka Igr listing is unrecognised: product block without id, link or title");
  }

  const pages = [...html.matchAll(/href="\?page=(\d+)"/g)].map((match) => Number(match[1]));
  return { products: products as ShopProduct[], lastPage: Math.max(1, ...pages) };
}

export const lavkaigrAdapter: ShopAdapter = {
  code: "lavkaigr",
  origin: ORIGIN,
  async listCatalog(get, opts) {
    const byId = new Map<string, ShopProduct>();
    let lastPage = 1;

    for (let page = 1; page <= lastPage && page <= (opts?.limit ?? Infinity); page += 1) {
      const listing = parseLavkaListing(await get(`${ORIGIN}/shop/?page=${page}`));
      if (listing.products.length === 0) {
        if (page === 1) break;
        // A complete walk never meets an empty page; treating this as the end would pass a cut-short catalogue off as whole.
        throw new Error(`Lavka Igr catalogue incomplete: page ${page} of ${lastPage} has no products`);
      }
      lastPage = Math.max(lastPage, listing.lastPage);
      for (const product of listing.products) if (!byId.has(product.externalId)) byId.set(product.externalId, product);
      opts?.onProgress?.(page, lastPage);
    }

    if (byId.size === 0) throw new Error("Lavka Igr catalogue empty or unrecognised");
    return [...byId.values()];
  },
};
