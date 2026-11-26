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
  function pagedGet(pages: Record<number, unknown>) {
    const urls: string[] = [];
    const get: Get = async (url) => {
      urls.push(url);
      const page = Number(new URL(url).searchParams.get("page"));
      return JSON.stringify(pages[page] ?? { status: "ok", count: 3, products: [] });
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

  it("pages until it has every product", async () => {
    const { get, urls } = pagedGet({
      1: { status: "ok", count: 3, products: [product(1), product(2)] },
      2: { status: "ok", count: 3, products: [product(3)] },
    });
    const products = await crowdgamesAdapter.listCatalog(get);
    expect(products.map((item) => item.externalId)).toEqual(["1", "2", "3"]);
    expect(urls).toEqual([
      "https://www.crowdgames.ru/collection/all.json?page=1",
      "https://www.crowdgames.ru/collection/all.json?page=2",
    ]);
  });

  it("fails rather than report a catalogue shorter than the shop's own count", async () => {
    const { get, urls } = pagedGet({ 1: { status: "ok", count: 3, products: [product(1)] } });
    await expect(crowdgamesAdapter.listCatalog(get)).rejects.toThrow(/incomplete/);
    expect(urls).toHaveLength(2);
  });

  it("fails when the first page has no products", async () => {
    const { get } = pagedGet({ 1: { status: "ok", count: 0, products: [] } });
    await expect(crowdgamesAdapter.listCatalog(get)).rejects.toThrow(/empty or unrecognised/);
  });
});
