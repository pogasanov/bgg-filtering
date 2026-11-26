import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { CatalogShell } from "@/components/catalog-shell";
import { Results } from "@/components/results/results";
import { TooltipProvider } from "@/components/ui/tooltip";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import { queryCatalogFrame, queryGamesView } from "@/lib/catalog/query";
import type { Db } from "@/lib/db/client";
import type { NormalizedGame } from "@/lib/bgg/types";
import type { GameFilters } from "@/lib/filtering";
import { defaultFilters, serializeFilters } from "@/lib/url-state";
import { storeCatalog } from "./helpers/catalog";
import { createTestDb } from "./helpers/test-db";

// The controls read the router; outside Next there is none. A non-empty query stands for a document
// opened on the filtered view, an empty one for the static first page.
let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace() {}, refresh() {} }),
  useSelectedLayoutSegment: () => (query ? "view" : null),
  useSearchParams: () => new URLSearchParams(query),
  useParams: () => ({}),
}));

let db: Db;
let close: () => Promise<void>;

beforeAll(async () => {
  ({ db, close } = await createTestDb());
});

afterAll(() => close());

function makeGame(id: number, year: number | null, languages: string[] = ["Russian"]): NormalizedGame {
  return {
    id,
    rank: id,
    title: "Game " + id,
    titleRu: null,
    year,
    thumbnailUrl: null,
    geekRating: 8,
    averageRating: 8,
    numVoters: 100,
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 60,
    weight: 2,
    categories: [],
    mechanics: [],
    languages,
    playerRecommendations: emptyPlayerRecommendations(),
    bggUrl: "https://boardgamegeek.com/boardgame/" + id,
  };
}

function slotCount(html: string, slot: string) {
  return html.match(new RegExp(`data-slot="${slot}"`, "g"))?.length ?? 0;
}

async function render(games: NormalizedGame[], filters: GameFilters = defaultFilters, page = 1) {
  await storeCatalog(db, games);
  const frame = await queryCatalogFrame(db);
  const view = await queryGamesView(db, filters, page);
  query = serializeFilters(filters);
  // The root layout provides the tooltip context and the route's page provides the results; mirror both here.
  return renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(CatalogShell, {
        frame,
        children: createElement(Results, { view, filters }),
      }),
    ),
  );
}

describe("catalog page", () => {
  test("renders the rail, search, count and one table without cards or a hero", async () => {
    const html = await render([makeGame(1, 2000), makeGame(2, 2020)]);
    expect(html.match(/data-matrix-cell="/g)).toHaveLength(28);
    expect(html).toContain('aria-label="Поиск по названию"');
    expect(slotCount(html, "table")).toBe(1);
    expect(slotCount(html, "card")).toBe(0);
    expect(html).not.toContain("<h1");
    expect(html).toContain('aria-label="Powered by BoardGameGeek"');
  });

  test("applies initial filters from the URL", async () => {
    const html = await render([makeGame(1, 1990), makeGame(2, 2020)], { ...defaultFilters, minYear: 2010 });
    expect(html).toContain("Game 2<");
    expect(html).not.toContain("Game 1<");
    expect(html).toContain("Убрать фильтр: с 2010");
  });

  test("empty catalog says the data is not loaded yet instead of showing the table", async () => {
    const html = await render([]);
    expect(slotCount(html, "alert")).toBe(1);
    expect(html).toContain("Игр пока нет");
    expect(html).not.toContain("BGG_TOKEN");
    expect(slotCount(html, "table")).toBe(0);
  });

  test("describes the site as public and non-commercial", async () => {
    const html = await render([makeGame(1, 2000)]);
    expect(html).toContain("Некоммерческий сайт.");
    expect(html).not.toContain("личного");
  });

  test("has a phone filter trigger, sort control and a BGG footer outside the rail", async () => {
    const html = await render([makeGame(1, 2000)], { ...defaultFilters, tags: ["X"] });
    expect(html).toMatch(/<button[^>]*aria-label="Фильтры, активных: 2"/);
    expect(html).toContain('aria-label="Сортировка"');
    expect(html.match(/aria-label="Powered by BoardGameGeek"/g)!.length).toBeGreaterThanOrEqual(2);
  });

  test("keeps the search bar pinned to the top while the results scroll", async () => {
    const html = await render([makeGame(1, 2000)]);
    expect(html).toMatch(/<div(?=[^>]*data-search-bar)(?=[^>]*class="[^"]*\bsticky\b[^"]*\btop-0\b)/);
  });

  test("shows 100 games per page and links to the other pages with the filters kept", async () => {
    const games = Array.from({ length: 250 }, (_, index) => makeGame(index + 1, 2000));
    const filters = { ...defaultFilters, minYear: 1990 };
    const html = await render(games, filters, 2);
    expect(html.match(/data-slot="table-row"/g)).toHaveLength(101);
    expect(html).toContain("Game 101<");
    expect(html).toContain("Game 200<");
    expect(html).not.toContain("Game 100<");
    expect(html).not.toContain("Game 201<");
    expect(html).toContain("101–200 из 250");
    expect(html).toMatch(/<span[^>]*aria-current="page"[^>]*>2</);
    expect(html).toContain('href="/?ymin=1990"');
    expect(html).toContain('href="/?ymin=1990&amp;page=3"');
  });

  test("opens on Russian with a chip to clear it, and links pages of another language under its prefix", async () => {
    const russian = await render([makeGame(1, 2000)]);
    expect(russian).toContain('aria-label="Убрать фильтр: Русский"');
    expect(russian).not.toContain("Сбросить всё");

    const games = Array.from({ length: 150 }, (_, index) => makeGame(index + 1, 2000, ["English"]));
    const english = await render(games, { ...defaultFilters, language: "English" });
    expect(english).toContain('href="/en?page=2"');
  });

  test("shows no page links while everything fits on one page", async () => {
    expect(await render([makeGame(1, 2000)])).not.toContain("Страницы результатов");
  });

  test("shows no legend under the results", async () => {
    expect(await render([makeGame(1, 2000)])).not.toContain("Опрос по числу игроков");
  });
});
