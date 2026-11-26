import { attribute, hasClass, openingTags, textContent } from "@/lib/prices/html";
import { parseRubles } from "@/lib/prices/text";
import type { ShopAdapter, ShopProduct } from "@/lib/prices/types";

const ORIGIN = "https://hobbygames.ru";
/**
 * The listing of everything Hobby World ("Мир Хобби") publishes. The shop's whole
 * catalogue is tens of thousands of products from every publisher; this page is the
 * part that answers "what does Hobby World's own Russian edition cost".
 */
const LISTING = `${ORIGIN}/mir-hobbi`;

const CARD_START = /(?=<div class="product-card\s[^"]*"\s+data-index=)/;

function toProduct(card: string): ShopProduct | null {
  const opening = card.slice(0, card.indexOf(">") + 1);
  const externalId = attribute(opening, "data-product_id");
  // The title comes from the link's text: its `title` attribute is written with
  // unescaped quotes for names that contain them, which breaks the attribute.
  const link = /<div class="product-card-title">\s*<a\b[^>]*?\shref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(card);
  if (!externalId || !link) return null;

  const href = link[1];
  const title = textContent(link[2]);
  if (!href || title === "") return null;

  // A card can be bought when it has a cart button for this very product; otherwise
  // the shop offers "notify me" and only lists the last price.
  const canBuy = openingTags(card, "button").some(
    (tag) => hasClass(tag, "to-cart") && attribute(tag, "data-id") === externalId,
  );
  const old = /<div class="product-card-price__old">([\s\S]*?)<\/div>/.exec(card);
  const price = parseRubles(attribute(opening, "data-price"));
  const oldPrice = old ? parseRubles(textContent(old[1])) : null;
  const vendor = (attribute(opening, "data-brand") ?? "").trim();
  const tags = [...card.matchAll(/<div class="product-tag__label">([\s\S]*?)<\/div>/g)].map((match) => textContent(match[1]));

  return {
    shop: "hobbygames",
    externalId,
    url: new URL(href, ORIGIN).href,
    title,
    vendor: vendor === "" ? null : vendor,
    barcode: null,
    price,
    oldPrice: price !== null && oldPrice !== null && oldPrice > price ? oldPrice : null,
    available: canBuy,
    variantCount: 1,
    isExpansion: tags.includes("Дополнение"),
  };
}

/** One page of the publisher's listing. Throws when the page is not that listing. */
export function parseHobbygamesListing(html: string): { products: ShopProduct[]; lastPage: number } {
  const start = html.search(/<div\b[^>]*class="[^"]*\bproducts-container\b/);
  if (start === -1) throw new Error("Hobby Games listing is unrecognised: no product list");

  const end = html.indexOf('<ul class="pagination"', start);
  const cards = html
    .slice(start, end === -1 ? undefined : end)
    .split(CARD_START)
    .filter((chunk) => chunk.startsWith('<div class="product-card'));
  const products = cards.map(toProduct);
  if (products.some((product) => product === null)) {
    throw new Error("Hobby Games listing is unrecognised: product card without id, link or title");
  }

  const pages = [...html.matchAll(/[?&]page=(\d+)"/g)].map((match) => Number(match[1]));
  return { products: products as ShopProduct[], lastPage: Math.max(1, ...pages) };
}

export const hobbygamesAdapter: ShopAdapter = {
  code: "hobbygames",
  origin: ORIGIN,
  async listCatalog(get, opts) {
    const byId = new Map<string, ShopProduct>();
    let lastPage = 1;

    for (let page = 1; page <= lastPage && page <= (opts?.limit ?? Infinity); page += 1) {
      const listing = parseHobbygamesListing(await get(page === 1 ? LISTING : `${LISTING}?page=${page}`));
      if (listing.products.length === 0) {
        if (page === 1) break;
        throw new Error(`Hobby Games catalogue incomplete: page ${page} of ${lastPage} has no products`);
      }
      lastPage = Math.max(lastPage, listing.lastPage);
      for (const product of listing.products) if (!byId.has(product.externalId)) byId.set(product.externalId, product);
      opts?.onProgress?.(page, lastPage);
    }

    if (byId.size === 0) throw new Error("Hobby Games catalogue empty or unrecognised");
    return [...byId.values()];
  },
};
