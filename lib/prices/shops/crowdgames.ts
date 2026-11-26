import { parseRubles } from "@/lib/prices/text";
import type { ShopAdapter, ShopProduct } from "@/lib/prices/types";

const ORIGIN = "https://www.crowdgames.ru";
/** A guard against paging forever if the shop stops returning an empty last page. */
const MAX_PAGES = 100;

type RawVariant = { price?: unknown; old_price?: unknown; barcode?: unknown };
type RawProduct = { id?: unknown; title?: unknown; permalink?: unknown; available?: unknown; variants?: unknown };

function toProduct(raw: RawProduct): ShopProduct | null {
  if ((typeof raw.id !== "number" && typeof raw.id !== "string") || typeof raw.title !== "string") return null;
  if (typeof raw.permalink !== "string" || raw.permalink === "") return null;

  const variants = Array.isArray(raw.variants) ? (raw.variants as RawVariant[]) : [];
  // With several variants there is no single price; the matcher skips such products.
  const only = variants.length === 1 ? variants[0] : null;
  const barcode = only && typeof only.barcode === "string" ? only.barcode.trim() : "";

  return {
    shop: "crowdgames",
    externalId: String(raw.id),
    url: `${ORIGIN}/product/${raw.permalink}`,
    title: raw.title.trim(),
    vendor: null,
    barcode: barcode === "" ? null : barcode,
    price: only ? parseRubles(only.price as string | number | null) : null,
    oldPrice: only ? parseRubles(only.old_price as string | number | null) : null,
    available: typeof raw.available === "boolean" ? raw.available : null,
    variantCount: Math.max(variants.length, 1),
  };
}

/** One page of `/collection/all.json`. Throws when the response is not that. */
export function parseCrowdgamesPage(json: string): { count: number; products: ShopProduct[] } {
  let data: { count?: unknown; products?: unknown };
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("CrowdGames catalogue page is unrecognised: not JSON");
  }
  if (data === null || typeof data !== "object" || !Array.isArray(data.products) || typeof data.count !== "number") {
    throw new Error("CrowdGames catalogue page is unrecognised: no products list");
  }

  const products = (data.products as RawProduct[]).map(toProduct).filter((item): item is ShopProduct => item !== null);
  if (products.length !== data.products.length) {
    throw new Error("CrowdGames catalogue page is unrecognised: product without id, title or permalink");
  }
  return { count: data.count, products };
}

/**
 * `shop` is the retail catalogue; `all` holds new arrivals and pre-orders, some of
 * which are not in `shop` yet. Together they are what a visitor can buy.
 */
const COLLECTIONS = ["shop", "all"] as const;

export const crowdgamesAdapter: ShopAdapter = {
  code: "crowdgames",
  origin: ORIGIN,
  async listCatalog(get, opts) {
    const byId = new Map<string, ShopProduct>();

    for (const collection of COLLECTIONS) {
      const seen = new Set<string>();
      let total: number | null = null;

      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const { count, products } = parseCrowdgamesPage(await get(`${ORIGIN}/collection/${collection}.json?page=${page}`));
        // A page past the end may report a count of zero, so the largest count seen is the shop's claim.
        total = Math.max(total ?? 0, count);
        if (products.length === 0) break;
        for (const product of products) {
          seen.add(product.externalId);
          if (!byId.has(product.externalId)) byId.set(product.externalId, product);
        }
        opts?.onProgress?.(byId.size, null);
        if (seen.size >= count) break;
      }

      if (collection === "shop" && seen.size === 0) throw new Error("CrowdGames catalogue empty or unrecognised");
      if (total !== null && seen.size < total) {
        throw new Error(`CrowdGames catalogue incomplete: read ${seen.size} of ${total} products in "${collection}"`);
      }
    }

    return [...byId.values()];
  },
};
