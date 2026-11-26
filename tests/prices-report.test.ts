import { describe, expect, it } from "vitest";
import type { Link } from "@/lib/prices/match";
import { buildReport, formatReport, type ShopOutcome } from "@/lib/prices/report";
import type { GameNames, ShopCode, ShopProduct } from "@/lib/prices/types";

function product(shop: ShopCode, externalId: string, title: string, price: number | null = 1000): ShopProduct {
  return {
    shop,
    externalId,
    url: `https://${shop}.example/${externalId}`,
    title,
    vendor: null,
    barcode: null,
    price,
    oldPrice: null,
    available: true,
    variantCount: 1,
  };
}

const games: GameNames[] = [
  { bggId: 1, primaryName: "Wingspan", names: ["Wingspan", "Крылья"] },
  { bggId: 2, primaryName: "Citadels", names: ["Citadels"] },
  { bggId: 3, primaryName: "Root", names: ["Root"] },
];

const outcomes: ShopOutcome[] = [
  { shop: "crowdgames", products: [product("crowdgames", "a", "Крылья", 4490)] },
  { shop: "lavkaigr", products: [product("lavkaigr", "b", "Крылья", 5990), product("lavkaigr", "c", "Цитадели. Делюкс")] },
];

const links: Link[] = [
  { bggId: 1, shop: "crowdgames", externalId: "a", status: "confirmed", reason: "exact-title" },
  { bggId: 1, shop: "lavkaigr", externalId: "b", status: "confirmed", reason: "exact-title" },
  { bggId: 2, shop: "lavkaigr", externalId: "c", status: "candidate", reason: "title-contains-name" },
];

describe("buildReport", () => {
  const report = buildReport(games, outcomes, links);

  it("counts games by their best outcome", () => {
    expect(report.games).toBe(3);
    expect(report.gamesWithConfirmed).toBe(1);
    expect(report.gamesWithOnlyCandidates).toBe(1);
    expect(report.gamesWithNothing).toBe(1);
  });

  it("counts products and links per shop", () => {
    expect(report.shops).toEqual([
      { shop: "crowdgames", error: null, products: 1, confirmed: 1, candidates: 0 },
      { shop: "lavkaigr", error: null, products: 2, confirmed: 1, candidates: 1 },
    ]);
  });

  it("samples only confirmed links, with what is needed to check them by eye", () => {
    expect(report.sample).toEqual([
      { game: "Wingspan", shop: "crowdgames", title: "Крылья", price: 4490, url: "https://crowdgames.example/a" },
      { game: "Wingspan", shop: "lavkaigr", title: "Крылья", price: 5990, url: "https://lavkaigr.example/b" },
    ]);
  });

  it("limits the sample to twenty links", () => {
    const manyProducts = Array.from({ length: 30 }, (_, index) => product("gaga", String(index), `Game ${index}`));
    const manyGames = manyProducts.map((_, index) => ({ bggId: index, primaryName: `Game ${index}`, names: [`Game ${index}`] }));
    const manyLinks: Link[] = manyProducts.map((item, index) => ({
      bggId: index,
      shop: "gaga",
      externalId: item.externalId,
      status: "confirmed",
      reason: "exact-title",
    }));
    expect(buildReport(manyGames, [{ shop: "gaga", products: manyProducts }], manyLinks).sample).toHaveLength(20);
  });

  it("carries a failed shop without throwing", () => {
    const failed = buildReport(games, [outcomes[0], { shop: "gaga", error: "HTTP 403" }], links.slice(0, 1));
    expect(failed.shops[1]).toEqual({ shop: "gaga", error: "HTTP 403", products: 0, confirmed: 0, candidates: 0 });
  });
});

describe("formatReport", () => {
  it("names each shop and the three game counts", () => {
    const text = formatReport(buildReport(games, outcomes, links));
    expect(text).toContain("crowdgames");
    expect(text).toContain("lavkaigr");
    expect(text).toMatch(/confirmed.*\b1\b/i);
    expect(text).toMatch(/only candidates.*\b1\b/i);
    expect(text).toMatch(/nothing.*\b1\b/i);
    expect(text).toContain("https://crowdgames.example/a");
  });

  it("flags a failed shop", () => {
    const text = formatReport(buildReport(games, [{ shop: "gaga", error: "HTTP 403" }], []));
    expect(text).toMatch(/gaga.*FAILED.*HTTP 403/);
  });
});
