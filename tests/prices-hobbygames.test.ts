import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hobbygamesAdapter, parseHobbygamesListing } from "@/lib/prices/shops/hobbygames";
import type { Get } from "@/lib/prices/types";

const fixture = readFileSync(new URL("./fixtures/prices/hobbygames-listing.html", import.meta.url), "utf8");

describe("parseHobbygamesListing", () => {
  const { products, lastPage } = parseHobbygamesListing(fixture);
  const [discounted, plain, preorder, expansion, unavailable] = products;

  it("maps a discounted card, with the shop's old price", () => {
    expect(products).toHaveLength(5);
    expect(discounted).toEqual({
      shop: "hobbygames",
      externalId: "151963",
      url: "https://hobbygames.ru/chjornaja-kniga",
      title: "Чёрная книга",
      vendor: "Hobby World",
      barcode: null,
      price: 4493,
      oldPrice: 5990,
      available: true,
      variantCount: 1,
      isExpansion: false,
    });
  });

  it("maps a card without a discount", () => {
    expect(plain).toMatchObject({ externalId: "791777", title: "Эверделл: Морозный край", price: 4990, oldPrice: null, available: true });
  });

  it("treats a pre-order as something that can be bought", () => {
    expect(preorder).toMatchObject({ externalId: "795556", price: 1490, available: true });
  });

  it("marks what the shop tags as an expansion", () => {
    expect(expansion).toMatchObject({ externalId: "791778", isExpansion: true });
    expect(plain.isExpansion).toBe(false);
  });

  it("marks a card with only a notify button unavailable, keeping its listed price", () => {
    expect(unavailable).toMatchObject({ externalId: "40551", price: 150, available: false });
  });

  it("finds the last page", () => {
    expect(lastPage).toBe(40);
  });

  it("reads the title from the link text, since the shop leaves quotes unescaped in the attribute", () => {
    const html = `<div class="row products-container "><div class="product-card  " data-index="0" data-product_id="77446" data-price="4490" data-brand="Hobby World">
      <div class="product-card-title"> <a class=" small" href="/civilizacija" title=""Цивилизация" Сида Мейера: Новый рассвет"> "Цивилизация" Сида Мейера: Новый рассвет &amp; Ко </a> </div>
      <button type="button" class="product-card-btn to-cart " data-id="77446"></button></div></div>`;
    expect(parseHobbygamesListing(html).products[0]).toMatchObject({
      externalId: "77446",
      title: '"Цивилизация" Сида Мейера: Новый рассвет & Ко',
      url: "https://hobbygames.ru/civilizacija",
    });
  });

  it("rejects a page that is not the listing", () => {
    expect(() => parseHobbygamesListing("<html><body>Проверка браузера</body></html>")).toThrow(/unrecognised/);
  });

  it("refuses a card it cannot read rather than skip it", () => {
    const broken = fixture.replace('data-product_id="151963"', "");
    expect(() => parseHobbygamesListing(broken)).toThrow(/unrecognised/);
  });
});

describe("hobbygamesAdapter.listCatalog", () => {
  const card = (id: number) => `<div class="product-card  " data-index="0" data-product_id="${id}" data-price="100" data-brand="Hobby World">
    <div class="product-card-title"><a class=" " href="/game-${id}" title="Game ${id}">Game ${id}</a></div>
    <div class="product-card-price "><div class="product-card-price__current">100&nbsp;₽</div></div>
    <button type="button" class="product-card-btn to-cart " data-id="${id}"></button></div>`;
  const page = (ids: number[], last: number) =>
    `<div class="row products-container ">${ids.map(card).join("")}</div><ul class="pagination"><li><a href="https://hobbygames.ru/mir-hobbi?page=${last}">${last}</a></li></ul>`;

  function pagedGet(pages: Record<number, string>) {
    const urls: string[] = [];
    const get: Get = async (url) => {
      urls.push(url);
      return pages[Number(new URL(url).searchParams.get("page") ?? "1")] ?? page([], 3);
    };
    return { get, urls };
  }

  it("walks the publisher's listing page by page", async () => {
    const { get, urls } = pagedGet({ 1: page([1, 2], 3), 2: page([3], 3), 3: page([4], 3) });
    const products = await hobbygamesAdapter.listCatalog(get);
    expect(products.map((item) => item.externalId)).toEqual(["1", "2", "3", "4"]);
    expect(urls).toEqual([
      "https://hobbygames.ru/mir-hobbi",
      "https://hobbygames.ru/mir-hobbi?page=2",
      "https://hobbygames.ru/mir-hobbi?page=3",
    ]);
  });

  it("fails rather than report a catalogue cut short by an empty page", async () => {
    const { get } = pagedGet({ 1: page([1], 9) });
    await expect(hobbygamesAdapter.listCatalog(get)).rejects.toThrow(/incomplete/);
  });

  it("honours the page limit", async () => {
    const { get, urls } = pagedGet({ 1: page([1], 3), 2: page([2], 3), 3: page([3], 3) });
    expect(await hobbygamesAdapter.listCatalog(get, { limit: 2 })).toHaveLength(2);
    expect(urls).toHaveLength(2);
  });

  it("fails when the first page has no products", async () => {
    const { get } = pagedGet({ 1: page([], 1) });
    await expect(hobbygamesAdapter.listCatalog(get)).rejects.toThrow(/empty or unrecognised/);
  });
});
