import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { CatalogShell } from "@/components/catalog-shell";
import { Results } from "@/components/results/results";
import { TooltipProvider } from "@/components/ui/tooltip";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import type { CatalogStatus } from "@/lib/catalog/types";
import type { ListedGame } from "@/lib/bgg/types";
import type { GameFilters } from "@/lib/filtering";
import { catalogFrame, gamesView } from "@/lib/games-view";
import { defaultFilters, serializeFilters } from "@/lib/url-state";

// The controls read the router; outside Next there is none. A non-empty query stands for a document
// opened on the filtered view, an empty one for the static first page.
let query = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace() {}, refresh() {} }),
  useSelectedLayoutSegment: () => (query ? "view" : null),
  useSearchParams: () => new URLSearchParams(query),
}));

const status: CatalogStatus = {
  gameCount: 3,
  updatedAt: null,
};

function makeGame(id: number, year: number | null, languages: string[] = []): ListedGame {
  return {
    id,
    rank: id,
    title: "Game " + id,
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
    offers: [],
    bestPrice: null,
  };
}

function slotCount(html: string, slot: string) {
  return html.match(new RegExp(`data-slot="${slot}"`, "g"))?.length ?? 0;
}

function render(games: ListedGame[], filters: GameFilters = defaultFilters, page = 1) {
  query = serializeFilters(filters);
  const frame = catalogFrame({ games, status: { ...status, gameCount: games.length } });
  // The root layout provides the tooltip context and the route's page provides the results; mirror both here.
  return renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(CatalogShell, {
        frame,
        children: createElement(Results, { view: gamesView(games, filters, page), filters }),
      }),
    ),
  );
}

describe("catalog page", () => {
  test("renders the rail, search, count and one table without cards or a hero", () => {
    const html = render([makeGame(1, 2000), makeGame(2, 2020)]);
    expect(html.match(/data-matrix-cell="/g)).toHaveLength(28);
    expect(html).toContain('aria-label="Поиск по названию"');
    expect(slotCount(html, "table")).toBe(1);
    expect(slotCount(html, "card")).toBe(0);
    expect(html).not.toContain("<h1");
    expect(html).toContain('aria-label="Powered by BoardGameGeek"');
  });

  test("applies initial filters from the URL", () => {
    const html = render([makeGame(1, 1990), makeGame(2, 2020)], { ...defaultFilters, minYear: 2010 });
    expect(html).toContain("Game 2<");
    expect(html).not.toContain("Game 1<");
    expect(html).toContain("Убрать фильтр: с 2010");
  });

  test("empty catalog says the data is not loaded yet instead of showing the table", () => {
    const html = render([]);
    expect(slotCount(html, "alert")).toBe(1);
    expect(html).toContain("Игр пока нет");
    expect(html).not.toContain("BGG_TOKEN");
    expect(slotCount(html, "table")).toBe(0);
  });

  test("describes the site as public and non-commercial", () => {
    const html = render([makeGame(1, 2000)]);
    expect(html).toContain("Некоммерческий сайт.");
    expect(html).not.toContain("личного");
  });

  test("has a phone filter trigger, sort control and a BGG footer outside the rail", () => {
    const html = render([makeGame(1, 2000)], { ...defaultFilters, tags: ["X"] });
    expect(html).toMatch(/<button[^>]*aria-label="Фильтры, активных: 1"/);
    expect(html).toContain('aria-label="Сортировка"');
    expect(html.match(/aria-label="Powered by BoardGameGeek"/g)!.length).toBeGreaterThanOrEqual(2);
  });

  test("keeps the search bar pinned to the top while the results scroll", () => {
    const html = render([makeGame(1, 2000)]);
    expect(html).toMatch(/<div(?=[^>]*data-search-bar)(?=[^>]*class="[^"]*\bsticky\b[^"]*\btop-0\b)/);
  });

  test("shows 100 games per page and links to the other pages with the filters kept", () => {
    const games = Array.from({ length: 250 }, (_, index) => makeGame(index + 1, 2000));
    const filters = { ...defaultFilters, minYear: 1990 };
    const html = render(games, filters, 2);
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

  test("shows no page links while everything fits on one page", () => {
    expect(render([makeGame(1, 2000)])).not.toContain("Страницы результатов");
  });

  test("shows no legend under the results", () => {
    expect(render([makeGame(1, 2000)])).not.toContain("Опрос по числу игроков");
  });
});
