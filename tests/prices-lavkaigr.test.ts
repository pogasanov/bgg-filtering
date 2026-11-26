import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lavkaigrAdapter, parseLavkaListing } from "@/lib/prices/shops/lavkaigr";
import type { Get } from "@/lib/prices/types";

const fixture = readFileSync(new URL("./fixtures/prices/lavkaigr-listing.html", import.meta.url), "utf8");

describe("parseLavkaListing", () => {
  const { products, lastPage } = parseLavkaListing(fixture);

  it("maps a product block", () => {
    expect(products).toHaveLength(4);
    expect(products[0]).toEqual({
      shop: "lavkaigr",
      externalId: "13753",
      url: "https://www.lavkaigr.ru/shop/family/narezka-kubikami/",
      title: "Нарезка кубиками",
      vendor: null,
      barcode: null,
      price: 2250,
      oldPrice: null,
      available: true,
      variantCount: 1,
    });
    expect(products[2].title).toBe("Slay the Spire. Срази Шпиль. Коллекционное издание");
    expect(products[2].price).toBe(16990);
  });

  it("marks a block without a buy button unavailable and reads its listed price", () => {
    expect(products[3]).toMatchObject({ externalId: "16705", title: "Котики Киото", available: false, price: 3990 });
  });

  it("finds the last page", () => {
    expect(lastPage).toBe(130);
  });

  it("decodes HTML entities in titles", () => {
    const html = fixture.replace("Нарезка кубиками", "Tom &amp; Jerry &quot;Deluxe&quot;");
    expect(parseLavkaListing(html).products[0].title).toBe('Tom & Jerry "Deluxe"');
  });

  it("rejects a page that is not the listing", () => {
    expect(() => parseLavkaListing("<html><body>Проверка браузера</body></html>")).toThrow(/unrecognised/);
  });
});

describe("lavkaigrAdapter.listCatalog", () => {
  const block = (id: number) => `<div class="block"><div>
    <div class="photo-block" data-id="${id}"><a href="/shop/x/game-${id}/" class="photo"></a></div>
    <h3><a class="game-name" href="/shop/x/game-${id}/">Game ${id}</a></h3>
    <p class="price">100 руб.</p>
    <div class="bottom"><a href="#" data-id="${id}" data-price="100" class="btn buy-mini">Купить</a></div>
  </div></div>`;
  const page = (ids: number[], last: number) =>
    `<div class="product-list row">${ids.map(block).join("")}</div><div class="pagenator"><a href="?page=${last}">${last}</a></div>`;

  function pagedGet(pages: Record<number, string>) {
    const urls: string[] = [];
    const get: Get = async (url) => {
      urls.push(url);
      return pages[Number(new URL(url).searchParams.get("page"))] ?? page([], 3);
    };
    return { get, urls };
  }

  it("walks every page and de-duplicates by product ID", async () => {
    const { get, urls } = pagedGet({ 1: page([1, 2], 3), 2: page([2, 3], 3), 3: page([4], 3) });
    const products = await lavkaigrAdapter.listCatalog(get);
    expect(products.map((item) => item.externalId)).toEqual(["1", "2", "3", "4"]);
    expect(urls).toEqual([1, 2, 3].map((n) => `https://www.lavkaigr.ru/shop/?page=${n}`));
  });

  it("fails rather than report a catalogue cut short by an empty page", async () => {
    const { get, urls } = pagedGet({ 1: page([1], 9) });
    await expect(lavkaigrAdapter.listCatalog(get)).rejects.toThrow(/incomplete/);
    expect(urls).toHaveLength(2);
  });

  it("honours the page limit", async () => {
    const { get, urls } = pagedGet({ 1: page([1], 3), 2: page([2], 3), 3: page([3], 3) });
    expect(await lavkaigrAdapter.listCatalog(get, { limit: 2 })).toHaveLength(2);
    expect(urls).toHaveLength(2);
  });

  it("fails when the first page has no products", async () => {
    const { get } = pagedGet({ 1: page([], 1) });
    await expect(lavkaigrAdapter.listCatalog(get)).rejects.toThrow(/empty or unrecognised/);
  });
});

describe("parseLavkaListing — review fixes", () => {
  const listing = (blocks: string, after = "") =>
    `<div class="product-list row">${blocks}</div><div class="pagenator"><a href="?page=2">2</a></div>${after}`;
  const outOfStock = `<div class="block"><div>
    <div class="photo-block" data-id="7"><a href="/shop/x/seven/" class="photo"></a></div>
    <h3><a class="game-name" href="/shop/x/seven/">Seven</a></h3>
    <p class="price">3 990 руб.</p>
    <div class="bottom"><a href="#" data-id="7" class="btn lite add_alert">Уведомить о наличии</a></div>
  </div></div>`;

  it("does not take a buy button from outside the product list", () => {
    const html = listing(outOfStock, '<a href="#" data-id="99" data-price="111" class="btn buy-mini">Купить</a>');
    expect(parseLavkaListing(html).products[0]).toMatchObject({ externalId: "7", price: 3990, available: false });
  });

  it("ignores a buy button that belongs to another product", () => {
    const html = listing(outOfStock.replace("</div></div>", '<a href="#" data-id="99" data-price="111" class="btn buy-mini">Купить</a></div></div>'));
    expect(parseLavkaListing(html).products[0]).toMatchObject({ externalId: "7", price: 3990, available: false });
  });

  it("gives no price when an old and a new price are listed together", () => {
    const html = listing(outOfStock.replace("3 990 руб.", "<s>4 990</s> 3 990 руб."));
    expect(parseLavkaListing(html).products[0].price).toBeNull();
  });
});
