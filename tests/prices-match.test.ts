import { describe, expect, it } from "vitest";
import { matchProducts } from "@/lib/prices/match";
import type { GameNames, ShopCode, ShopProduct } from "@/lib/prices/types";

let nextId = 1;
function product(title: string, overrides: Partial<ShopProduct> = {}): ShopProduct {
  const externalId = String(nextId++);
  return {
    shop: "lavkaigr",
    externalId,
    url: `https://shop.example/${externalId}`,
    title,
    vendor: null,
    barcode: null,
    price: 1000,
    oldPrice: null,
    available: true,
    variantCount: 1,
    ...overrides,
  };
}

const game = (bggId: number, ...names: string[]): GameNames => ({ bggId, primaryName: names[0], names });
const wingspan = game(266192, "Wingspan", "Крылья");

const summary = (games: GameNames[], products: ShopProduct[]) =>
  matchProducts(games, products).map((link) => `${link.bggId}:${link.shop}:${link.status}:${link.reason}`);

describe("matchProducts — confirmation", () => {
  it("confirms an exact Russian title", () => {
    const item = product("Крылья");
    expect(matchProducts([wingspan], [item])).toEqual([
      { bggId: 266192, shop: "lavkaigr", externalId: item.externalId, status: "confirmed", reason: "exact-title" },
    ]);
  });

  it("confirms regardless of case, quotes and ё", () => {
    expect(summary([game(1, "Ёжики в тумане")], [product("«ЕЖИКИ в тумане»")])).toEqual(["1:lavkaigr:confirmed:exact-title"]);
  });

  it("confirms two names of the game joined in either order", () => {
    expect(summary([wingspan], [product("Крылья (Wingspan)")])).toEqual(["266192:lavkaigr:confirmed:exact-title"]);
    expect(summary([wingspan], [product("Wingspan (Крылья)")])).toEqual(["266192:lavkaigr:confirmed:exact-title"]);
  });

  it("confirms the same title independently in two shops", () => {
    const links = summary([wingspan], [product("Крылья"), product("Крылья", { shop: "gaga" })]);
    expect(links.sort()).toEqual(["266192:gaga:confirmed:exact-title", "266192:lavkaigr:confirmed:exact-title"]);
  });

  it("confirms a game whose own name contains a stop word", () => {
    const boxed = game(5, "Подарочный набор приключений");
    expect(summary([boxed], [product("Подарочный набор приключений")])).toEqual(["5:lavkaigr:confirmed:exact-title"]);
  });
});

describe("matchProducts — never matched", () => {
  it("ignores expansions and accessories", () => {
    expect(summary([wingspan], [product("Крылья. Дополнение Птицы Океании")])).toEqual([]);
    expect(summary([wingspan], [product("Крылья: дополнения")])).toEqual([]);
    expect(summary([wingspan], [product("Крылья. Подарочный набор")])).toEqual([]);
    expect(summary([wingspan], [product("Протекторы для игры Крылья")])).toEqual([]);
    expect(summary([wingspan], [product("Wingspan: European Expansion")])).toEqual([]);
  });

  it("ignores a product with several variants even when the title is exact", () => {
    expect(summary([wingspan], [product("Крылья", { variantCount: 2 })])).toEqual([]);
  });

  it("does not match a short name inside a longer title", () => {
    expect(summary([game(2, "Root")], [product("Root: большая коробка")])).toEqual([]);
  });

  it("matches whole words only", () => {
    expect(summary([game(478, "Citadels", "Цитадели")], [product("Цитаделина и друзья")])).toEqual([]);
  });

  it("does nothing with products that resemble no game", () => {
    expect(summary([wingspan], [product("Каркассон")])).toEqual([]);
  });
});

describe("matchProducts — candidates", () => {
  it("offers several products with the same qualifying title instead of confirming one", () => {
    expect(summary([wingspan], [product("Крылья"), product("Крылья")])).toEqual([
      "266192:lavkaigr:candidate:several-products",
      "266192:lavkaigr:candidate:several-products",
    ]);
  });

  it("offers a product to both games when two games share a name", () => {
    const links = summary([game(10, "Brass"), game(11, "Brass")], [product("Brass")]);
    expect(links.sort()).toEqual([
      "10:lavkaigr:candidate:claimed-by-several-games",
      "11:lavkaigr:candidate:claimed-by-several-games",
    ]);
  });

  it("offers a title that contains the game's name", () => {
    expect(summary([wingspan], [product("Крылья. Юбилейное издание")])).toEqual([
      "266192:lavkaigr:candidate:title-contains-name",
    ]);
  });

  it("does not offer a product already confirmed for another game", () => {
    const anniversary = game(20, "Крылья. Юбилейное издание");
    expect(summary([wingspan, anniversary], [product("Крылья. Юбилейное издание")])).toEqual([
      "20:lavkaigr:confirmed:exact-title",
    ]);
  });

  it("offers a differently titled product with the barcode of a confirmed one in another shop", () => {
    const links = summary(
      [wingspan],
      [
        product("Крылья", { shop: "crowdgames", barcode: "4600000000017" }),
        product("Настольная игра про птиц", { shop: "gaga", barcode: "4600000000017" }),
      ],
    );
    expect(links.sort()).toEqual(["266192:crowdgames:confirmed:exact-title", "266192:gaga:candidate:barcode"]);
  });

  it("never matches on a missing or empty barcode", () => {
    const links = summary(
      [wingspan],
      [
        product("Крылья", { shop: "crowdgames", barcode: null }),
        product("Что-то другое", { shop: "gaga", barcode: null }),
        product("Ещё что-то", { shop: "gaga", barcode: "" }),
      ],
    );
    expect(links).toEqual(["266192:crowdgames:confirmed:exact-title"]);
  });

  it("keeps at most five candidates per game per shop, shortest titles first", () => {
    const suffixes = ["а", "аб", "абв", "абвг", "абвгд", "абвгде", "абвгдеж", "абвгдежз"];
    const products = suffixes.map((suffix) => product(`Крылья ${suffix}`));
    const links = matchProducts([wingspan], [...products].reverse());
    expect(links).toHaveLength(5);
    const kept = links.map((link) => products.find((item) => item.externalId === link.externalId)?.title);
    expect(kept.sort()).toEqual(suffixes.slice(0, 5).map((suffix) => `Крылья ${suffix}`).sort());
  });

  it("keeps a barcode candidate ahead of title candidates when capping", () => {
    const shop: ShopCode = "gaga";
    const titled = ["а", "аб", "абв", "абвг", "абвгд"].map((suffix) => product(`Крылья ${suffix}`, { shop }));
    const byBarcode = product("Очень длинное название совсем другого вида", { shop, barcode: "4600000000017" });
    const links = matchProducts(
      [wingspan],
      [product("Крылья", { shop: "crowdgames", barcode: "4600000000017" }), ...titled, byBarcode],
    ).filter((link) => link.shop === shop);
    expect(links).toHaveLength(5);
    expect(links.some((link) => link.externalId === byBarcode.externalId && link.reason === "barcode")).toBe(true);
  });
});
