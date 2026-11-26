import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { crowdgamesAdapter, parseCrowdgamesPage } from "@/lib/prices/shops/crowdgames";
import type { Get } from "@/lib/prices/types";

const fixture = readFileSync(new URL("./fixtures/prices/crowdgames-page.json", import.meta.url), "utf8");

describe("parseCrowdgamesPage", () => {
  const { count, products } = parseCrowdgamesPage(fixture);
  const [inStock, unavailable, discounted, multiVariant] = products;

  it("reads the total count", () => {
    expect(count).toBe(4);
    expect(products).toHaveLength(4);
  });

  it("maps an in-stock product", () => {
    expect(inStock).toEqual({
      shop: "crowdgames",
      externalId: "1639345377",
      url: "https://www.crowdgames.ru/product/kryshesnos",
      title: "Крышеснос",
      vendor: null,
      barcode: "4627119443885",
      price: 1190,
      oldPrice: null,
      available: true,
      variantCount: 1,
    });
  });

  it("keeps the price of an unavailable product", () => {
    expect(unavailable.title).toBe("Ants (Муравьи)");
    expect(unavailable.available).toBe(false);
    expect(unavailable.price).toBe(9990);
  });

  it("reads the shop's old price as whole rubles", () => {
    expect(discounted.price).toBe(4620);
    expect(discounted.oldPrice).toBe(4990);
  });

  it("gives a multi-variant product no price", () => {
    expect(multiVariant.variantCount).toBeGreaterThan(1);
    expect(multiVariant.price).toBeNull();
    expect(multiVariant.oldPrice).toBeNull();
    expect(multiVariant.barcode).toBeNull();
  });

  it("rejects a response that is not the catalogue", () => {
    expect(() => parseCrowdgamesPage("<html>blocked</html>")).toThrow(/unrecognised/);
    expect(() => parseCrowdgamesPage('{"status":"ok"}')).toThrow(/unrecognised/);
  });
});

describe("crowdgamesAdapter.listCatalog", () => {
  type Page = { status: string; count: number; products: unknown[] };
  /** Pages keyed by "collection:page"; anything else is an empty page. */
  function pagedGet(pages: Record<string, Page>) {
    const urls: string[] = [];
    const get: Get = async (url) => {
      urls.push(url);
      const target = new URL(url);
      const collection = target.pathname.replace("/collection/", "").replace(".json", "");
      return JSON.stringify(pages[`${collection}:${target.searchParams.get("page")}`] ?? { status: "ok", count: 0, products: [] });
    };
    return { get, urls };
  }

  const product = (id: number) => ({
    id,
    title: `Game ${id}`,
    permalink: `game-${id}`,
    available: true,
    variants: [{ price: "100.0", old_price: null, barcode: null }],
  });
  const one = (ids: number[], count = ids.length): Page => ({ status: "ok", count, products: ids.map(product) });

  it("reads the retail catalogue and the new arrivals, each product once", async () => {
    const { get, urls } = pagedGet({ "shop:1": one([1, 2], 3), "shop:2": one([3], 3), "all:1": one([3, 4]) });
    const products = await crowdgamesAdapter.listCatalog(get);
    expect(products.map((item) => item.externalId)).toEqual(["1", "2", "3", "4"]);
    expect(urls).toEqual([
      "https://www.crowdgames.ru/collection/shop.json?page=1",
      "https://www.crowdgames.ru/collection/shop.json?page=2",
      "https://www.crowdgames.ru/collection/all.json?page=1",
    ]);
  });

  it("fails rather than report a catalogue shorter than the shop's own count", async () => {
    const { get } = pagedGet({ "shop:1": one([1], 3), "all:1": one([1]) });
    await expect(crowdgamesAdapter.listCatalog(get)).rejects.toThrow(/incomplete/);
  });

  it("fails when the retail catalogue has no products", async () => {
    const { get } = pagedGet({ "all:1": one([1]) });
    await expect(crowdgamesAdapter.listCatalog(get)).rejects.toThrow(/empty or unrecognised/);
  });
});
