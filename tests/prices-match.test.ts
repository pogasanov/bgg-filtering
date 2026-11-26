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

describe("matchProducts — review fixes", () => {
  it("does not confirm a title that is also the start of another listed game's name", () => {
    const first = game(31260, "Agricola", "Агрикола");
    const revised = game(200680, "Agricola (Revised Edition)", "Агрикола. Новое издание");
    expect(summary([first, revised], [product("Агрикола")])).toEqual(["31260:lavkaigr:candidate:name-within-another-game"]);
  });

  it("still confirms the longer, unambiguous title", () => {
    const first = game(31260, "Agricola", "Агрикола");
    const revised = game(200680, "Agricola (Revised Edition)", "Агрикола. Новое издание");
    expect(summary([first, revised], [product("Агрикола. Новое издание")])).toEqual(["200680:lavkaigr:confirmed:exact-title"]);
  });

  it("joins only a Latin name with a Cyrillic one", () => {
    // Two names in one script must never confirm; at most the owner is asked.
    expect(summary([game(1, "Dune", "Imperium")], [product("Dune: Imperium")])).toEqual(["1:lavkaigr:candidate:title-contains-name"]);
    expect(summary([game(2, "Дюна", "Империя")], [product("Дюна: Империя")])).toEqual(["2:lavkaigr:candidate:title-contains-name"]);
    expect(summary([game(3, "Apiary", "Апиарий")], [product("Apiary (Апиарий)")])).toEqual(["3:lavkaigr:confirmed:exact-title"]);
  });
});

describe("matchProducts — what a full catalogue showed", () => {
  it("confirms the Russian edition when a shop also lists the import under its original name", () => {
    const spaceBase = game(1, "Space Base", "Космобаза");
    const russian = product("Космобаза");
    const links = matchProducts([spaceBase], [product("Space Base"), russian]);
    expect(links).toEqual([
      { bggId: 1, shop: "lavkaigr", externalId: russian.externalId, status: "confirmed", reason: "exact-title" },
    ]);
  });

  it("still asks when two products carry the Russian name", () => {
    expect(summary([game(1, "Space Base", "Космобаза")], [product("Космобаза"), product("Космобаза")])).toEqual([
      "1:lavkaigr:candidate:several-products",
      "1:lavkaigr:candidate:several-products",
    ]);
  });

  it("confirms a base game whose name starts another game's name with a real subtitle", () => {
    const base = game(266192, "Wingspan", "Крылья");
    const asia = game(366161, "Wingspan Asia", "Крылья: Азия");
    expect(summary([base, asia], [product("Крылья")])).toEqual(["266192:lavkaigr:confirmed:exact-title"]);
  });

  it("still asks when the other game is the same name plus edition words", () => {
    const first = game(1, "Pax Pamir", "Пакс Памир");
    const second = game(2, "Pax Pamir: Second Edition", "Пакс Памир. Второе издание");
    expect(summary([first, second], [product("Пакс Памир")])).toEqual(["1:lavkaigr:candidate:name-within-another-game"]);
  });

  it("reads through the shop's generic prefix", () => {
    expect(summary([game(1, "Bomb Busters", "Это бомба!")], [product("Настольная игра Это Бомба!")])).toEqual([
      "1:lavkaigr:confirmed:exact-title",
    ]);
    expect(summary([game(2, "Fromage", "Фромаж")], [product("Настольная игра «Фромаж»")])).toEqual([
      "2:lavkaigr:confirmed:exact-title",
    ]);
  });

  it("ignores marked-down, damaged and second-hand listings", () => {
    const brass = game(1, "Brass: Birmingham", "Brass. Бирмингем");
    expect(summary([brass], [product("Brass. Бирмингем (уценённый товар)")])).toEqual([]);
    expect(summary([brass], [product("Brass. Бирмингем (Уценка)")])).toEqual([]);
    expect(summary([brass], [product("Brass. Бирмингем (мятая коробка)")])).toEqual([]);
    expect(summary([brass], [product("Brass. Бирмингем (Комиссионная)")])).toEqual([]);
    expect(summary([brass], [product("Brass. Бирмингем (Игра без коробки)")])).toEqual([]);
  });
});

describe("matchProducts — imports", () => {
  const lords: GameNames = { bggId: 1, primaryName: "Lords of Waterdeep", names: ["Lords of Waterdeep"], publisherShops: [] };
  const resArcana: GameNames = { bggId: 2, primaryName: "Res Arcana", names: ["Res Arcana"], publisherShops: ["gaga"] };

  it("ignores an original-language title in a shop that is not the game's Russian publisher", () => {
    expect(summary([lords], [product("Lords of Waterdeep")])).toEqual([]);
    expect(summary([lords], [product("Lords of Waterdeep: Deluxe")])).toEqual([]);
  });

  it("confirms an original-language title in the Russian publisher's own shop", () => {
    expect(summary([resArcana], [product("Res Arcana", { shop: "gaga" })])).toEqual(["2:gaga:confirmed:exact-title"]);
    expect(summary([resArcana], [product("Res Arcana", { shop: "lavkaigr" })])).toEqual([]);
  });

  it("confirms a Russian title anywhere", () => {
    const game1: GameNames = { bggId: 3, primaryName: "Calico", names: ["Calico", "Котики"], publisherShops: ["crowdgames"] };
    expect(summary([game1], [product("Котики", { shop: "lavkaigr" })])).toEqual(["3:lavkaigr:confirmed:exact-title"]);
  });
});

describe("matchProducts — expansions the shop marks itself", () => {
  it("ignores a product the shop tags as an expansion, whatever its title", () => {
    const everdell = game(1, "Everdell", "Эверделл");
    expect(summary([everdell], [product("Эверделл: Морозный край. Зимние припасы", { isExpansion: true })])).toEqual([]);
    expect(summary([everdell], [product("Эверделл", { isExpansion: true })])).toEqual([]);
  });
});

