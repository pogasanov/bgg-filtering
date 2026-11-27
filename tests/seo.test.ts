import { describe, expect, test } from "vitest";
import { canonicalPath, editionsPhrase, viewDescription, viewHeading, viewMetadata, viewTitle, websiteJsonLd } from "@/lib/seo";
import { defaultFilters } from "@/lib/url-state";

describe("view headings and titles", () => {
  test("the full Russian list has the site's own heading and title", () => {
    expect(viewHeading(defaultFilters)).toBe("Лучшие настолки по числу игроков");
    expect(viewTitle(defaultFilters, 1)).toBe("Лучшие настолки по числу игроков — по голосам BoardGameGeek");
    expect(viewTitle(defaultFilters, 3)).toBe("Лучшие настолки по числу игроков — страница 3");
    expect(viewDescription(defaultFilters)).toContain("на двоих, на троих");
  });

  test("one player-count choice reads as a phrase", () => {
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] })).toBe("Лучшие настолки на двоих");
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "6+", verdict: "recommended" }] })).toBe(
      "Настолки, которые рекомендуют на семерых и больше",
    );
  });

  test("other filters are listed after the base, and the sort is left out", () => {
    const filters = {
      ...defaultFilters,
      matrix: [{ playerCount: "4" as const, verdict: "best" as const }],
      tags: ["Cooperative Game"],
      minYear: 2015,
      language: "English",
      sort: "year" as const,
    };
    expect(viewHeading(filters)).toBe("Лучшие настолки на четверых: Кооператив, с 2015, английские издания");
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "3", verdict: "not-playable" }, { playerCount: "1", verdict: "best" }] })).toBe(
      "Лучшие настолки по числу игроков: 1 игрок: лучше всего, 3 игрока: нельзя играть",
    );
  });

  test("editions are named in the site's language, with the BGG name as a fallback", () => {
    expect(editionsPhrase("")).toBeNull();
    expect(editionsPhrase("Russian")).toBe("русские издания");
    expect(editionsPhrase("German")).toBe("немецкие издания");
    expect(editionsPhrase("Esperanto")).toBe("издания на языке Esperanto");
    expect(editionsPhrase("German", "en")).toBe("German editions");
    expect(editionsPhrase("Esperanto", "en")).toBe("Esperanto editions");
  });

  test("only the Russian view promises shop prices", () => {
    expect(viewDescription({ ...defaultFilters, language: "Russian", tags: ["Economic"] })).toContain("цены в российских магазинах");
    expect(viewDescription({ ...defaultFilters, tags: ["Economic"] })).not.toContain("цены");
    expect(viewDescription({ ...defaultFilters, language: "Russian", tags: ["Economic"] }, "en")).toContain("prices in Russian shops");
  });

  test("the English site reads in English", () => {
    expect(viewTitle(defaultFilters, 1, "en")).toBe("Best board games by player count — from BoardGameGeek votes");
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] }, "en")).toBe("Best 2-player board games");
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "1", verdict: "best" }] }, "en")).toBe("Best solo board games");
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "6+", verdict: "best" }] }, "en")).toBe("Best board games for 7+ players");
    expect(viewHeading({ ...defaultFilters, tags: ["Worker Placement"] }, "en")).toBe("Best Worker Placement board games");
    expect(viewTitle({ ...defaultFilters, language: "English" }, 2, "en")).toBe("Best board games by player count: English editions — page 2");
  });
});

describe("collections in headings and canonical addresses", () => {
  test("one mechanic reads as a phrase with its Russian name", () => {
    expect(viewHeading({ ...defaultFilters, tags: ["Worker Placement"] })).toBe("Лучшие настолки с механикой «Размещение рабочих»");
  });

  test("a view that is a collection points to the collection's address", () => {
    expect(canonicalPath({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }], sort: "year" }, 1)).toBe("/na-dvoih");
    expect(canonicalPath({ ...defaultFilters, tags: ["Cooperative Game"] }, 1)).toBe("/mehaniki/kooperativ");
    expect(canonicalPath({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] }, 2)).toBe("/?m=2%3Abest&page=2");
    expect(canonicalPath({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] }, 1, "en")).toBe("/best-2-player-board-games");
    expect(canonicalPath({ ...defaultFilters, tags: ["Cooperative Game"] }, 1, "en")).toBe("/mechanics/cooperative-game");
    // A collection is every edition: with a language chosen it is an ordinary view.
    expect(canonicalPath({ ...defaultFilters, language: "Russian", matrix: [{ playerCount: "2", verdict: "best" }] }, 1)).toBe("/ru?m=2%3Abest");
  });
});

describe("canonical addresses", () => {
  test("keep the filters, language and page and drop the sort", () => {
    expect(canonicalPath(defaultFilters, 1)).toBe("/");
    expect(canonicalPath(defaultFilters, 2)).toBe("/?page=2");
    expect(canonicalPath({ ...defaultFilters, language: "English", sort: "rating" as never, sortDir: "asc" }, 1)).toBe("/en");
    expect(canonicalPath({ ...defaultFilters, tags: ["Economic"], sort: "year", sortDir: "asc" }, 3)).toBe("/?tag=Economic&page=3");
  });

  test("metadata carries the title, canonical and share texts; searches are kept out of the index", () => {
    const meta = viewMetadata({ ...defaultFilters, language: "Russian" }, 2);
    expect(meta.title).toEqual({ absolute: "Лучшие настолки по числу игроков: русские издания — страница 2" });
    expect(meta.alternates?.canonical).toBe("/ru?page=2");
    expect(meta.openGraph).toMatchObject({ url: "/ru?page=2", siteName: "Настолки по числу игроков", locale: "ru_RU" });
    expect(meta.robots).toBeUndefined();
    expect(viewMetadata({ ...defaultFilters, search: "крылья" }, 1).robots).toEqual({ index: false, follow: true });
  });

  test("point to the same page on each language's site, the English one for everyone else", () => {
    const collection = viewMetadata({ ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] }, 1);
    expect(collection.alternates?.languages).toEqual({
      en: "https://mynextboardgame.com/best-2-player-board-games",
      ru: "https://ru.mynextboardgame.com/na-dvoih",
      "x-default": "https://mynextboardgame.com/best-2-player-board-games",
    });
    expect(viewMetadata({ ...defaultFilters, language: "English" }, 2).alternates?.languages).toMatchObject({
      en: "https://mynextboardgame.com/en?page=2",
      ru: "https://ru.mynextboardgame.com/en?page=2",
    });
  });
});

describe("the home page's WebSite record", () => {
  test("names the site, its other names and its address", () => {
    expect(websiteJsonLd()).toMatchObject({
      "@type": "WebSite",
      name: "Настолки по числу игроков",
      alternateName: ["My Next Board Game", "ru.mynextboardgame.com"],
      url: "https://ru.mynextboardgame.com/",
      inLanguage: "ru",
    });
  });
});
