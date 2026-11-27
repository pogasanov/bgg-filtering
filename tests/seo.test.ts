import { describe, expect, test } from "vitest";
import { canonicalPath, editionsPhrase, viewDescription, viewHeading, viewMetadata, viewTitle } from "@/lib/seo";
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
    expect(viewHeading(filters)).toBe("Лучшие настолки на четверых: Cooperative Game, с 2015, английские издания");
    expect(viewHeading({ ...defaultFilters, matrix: [{ playerCount: "3", verdict: "not-playable" }, { playerCount: "1", verdict: "best" }] })).toBe(
      "Лучшие настолки по числу игроков: 1 игрок: лучше всего, 3 игрока: нельзя играть",
    );
  });

  test("editions are named in Russian, with the BGG name as a fallback", () => {
    expect(editionsPhrase("Russian")).toBeNull();
    expect(editionsPhrase("")).toBe("все издания");
    expect(editionsPhrase("German")).toBe("немецкие издания");
    expect(editionsPhrase("Esperanto")).toBe("издания на языке Esperanto");
  });

  test("only the Russian view promises shop prices", () => {
    expect(viewDescription({ ...defaultFilters, tags: ["Economic"] })).toContain("цены в российских магазинах");
    expect(viewDescription({ ...defaultFilters, language: "English" })).not.toContain("цены");
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
    const meta = viewMetadata({ ...defaultFilters, language: "" }, 2);
    expect(meta.title).toEqual({ absolute: "Лучшие настолки по числу игроков: все издания — страница 2" });
    expect(meta.alternates?.canonical).toBe("/any?page=2");
    expect(meta.openGraph).toMatchObject({ url: "/any?page=2", siteName: "Настолки по числу игроков" });
    expect(meta.robots).toBeUndefined();
    expect(viewMetadata({ ...defaultFilters, search: "крылья" }, 1).robots).toEqual({ index: false, follow: true });
  });
});
