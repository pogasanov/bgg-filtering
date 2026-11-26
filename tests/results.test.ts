import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import { GamesProvider } from "@/components/games-state";
import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { ResultsList } from "@/components/results/results-list";
import { ResultsBar } from "@/components/results/results-bar";
import { ResultsTable } from "@/components/results/results-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { activeFilterChips } from "@/lib/active-filters";
import { defaultFilters } from "@/lib/url-state";
import { PriceCell } from "@/components/results/price-cell";
import { pollGame } from "./fixtures";
import { offer } from "./price-fixtures";

// The components read the router; outside Next there is none.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace() {}, refresh() {} }),
  useSelectedLayoutSegment: () => null,
  useParams: () => ({}),
}));

const status = {
  gameCount: 1,
  updatedAt: null,
};

function render<P extends object>(component: ComponentType<P>, props: P) {
  // The sort and reset buttons inside the results read the page state; mirror the page here.
  const provider = {
    facets: { allTags: [], allLanguages: [], yearScale: [] },
    baseTagCounts: new Map<string, number>(),
    status,
  };
  return renderToStaticMarkup(
    createElement(
      TooltipProvider,
      null,
      createElement(GamesProvider, { ...provider, children: createElement(component, props) }),
    ),
  );
}

test("poll strip marks verdicts and range without relying on colour", () => {
  const html = render(PollStrip, { game: pollGame });
  expect(html.match(/data-verdict="/g)).toHaveLength(7);
  expect(html).toMatch(/<span(?=[^>]*data-verdict="recommended")(?=[^>]*data-in-range="false")/);
  expect(html).toMatch(/<span(?=[^>]*data-verdict="best")(?=[^>]*data-in-range="true")/);
  expect(html).toContain("2 игрока: лучше всего — лучше 10 (71%)");
  expect(html).not.toContain("tabindex");
});

test("thumbnail falls back to a placeholder tile", () => {
  expect(render(GameThumb, { url: null, size: 40 })).toContain('data-thumb="placeholder"');
  const html = render(GameThumb, { url: "https://cf.geekdo-images.com/a/t.jpg", size: 40 });
  expect(html).toContain('loading="lazy"');
  expect(html).toContain('alt=""');
});

test("table renders one row per game with dashes for missing numbers", () => {
  const sparse = { ...pollGame, description: "SECRET", playingTime: null, weight: null, rank: null, minPlayers: null, maxPlayers: null };
  const html = render(ResultsTable, { games: [sparse], sort: "rank", sortDir: "asc", russian: false });
  expect(html.match(/<tr/g)).toHaveLength(2);
  expect(html).toContain('aria-sort="ascending"');
  expect(html.match(/—/g)!.length).toBeGreaterThanOrEqual(4);
  expect(html).toContain("Economic · Worker Placement");
  expect(html).not.toContain("SECRET");
});

test("only the active sort column announces a direction", () => {
  const html = render(ResultsTable, { games: [pollGame], sort: "weight", sortDir: "desc", russian: false });
  expect(html.match(/aria-sort="/g)).toHaveLength(1);
  expect(html).toContain('aria-sort="descending"');
});

test("empty result shows a reset action", () => {
  const html = render(ResultsTable, { games: [], sort: "rank", sortDir: "asc", russian: false });
  expect(html).toContain("Ничего не найдено");
  expect(html).toContain("Сбросить фильтры");
});

test("bar shows the count, chips and reset only when filtered", () => {
  const chips = activeFilterChips({ ...defaultFilters, tags: ["Economic"] });
  const html = render(ResultsBar, { shown: 47, total: 2000, chips, onChange() {}, onReset() {} });
  expect(html).toContain(">47<");
  expect(html).toContain("Убрать фильтр: Economic");
  expect(html).toContain("Сбросить всё");
  const plain = render(ResultsBar, { shown: 2000, total: 2000, chips: [], onChange() {}, onReset() {} });
  expect(plain).not.toContain("Сбросить всё");
});

test("phone list shows thumbnail, title, strip and rating per game", () => {
  const html = render(ResultsList, { games: [pollGame], russian: false });
  expect(html.match(/<li/g)).toHaveLength(1);
  expect(html.match(/data-verdict="/g)).toHaveLength(7);
  expect(html).toContain('data-thumb="placeholder"');
  expect(render(ResultsList, { games: [], russian: false })).toContain("Ничего не найдено");
});

test("on phones the strip lets taps through to the row link; on desktop it stays hoverable", () => {
  const list = render(ResultsList, { games: [pollGame], russian: false });
  expect(list).toMatch(/<span(?=[^>]*role="img")(?=[^>]*pointer-events-none)/);
  const table = render(ResultsTable, { games: [pollGame], sort: "rank", sortDir: "asc", russian: false });
  expect(table).not.toMatch(/<span(?=[^>]*role="img")(?=[^>]*pointer-events-none)/);
});

test("complexity is drawn as a five-step meter next to the number", () => {
  const html = render(ResultsTable, { games: [{ ...pollGame, weight: 3.2 }], sort: "rank", sortDir: "asc", russian: false });
  expect(html.match(/data-meter-bar="/g)).toHaveLength(5);
  expect(html.match(/data-meter-bar="on"/g)).toHaveLength(3);
  expect(html).toContain("3,2");
});

test("a game without a complexity value gets a dash and no meter", () => {
  const html = render(ResultsTable, { games: [{ ...pollGame, weight: null }], sort: "rank", sortDir: "asc", russian: false });
  expect(html).not.toContain("data-meter-bar");
});

test("'not recommended' squares use their own colour and keep an outline", () => {
  const game = {
    ...pollGame,
    playerRecommendations: {
      ...pollGame.playerRecommendations,
      "3": { best: 1, recommended: 2, notRecommended: 9, verdict: "not-recommended" as const },
    },
  };
  const html = render(PollStrip, { game });
  expect(html).toMatch(/<span(?=[^>]*data-verdict="not-recommended")(?=[^>]*class="[^"]*bg-poll-no[^"]*ring-poll-no-border)/);
});

const pricedGame = { ...pollGame, offers: [offer({ price: 1390 })], bestPrice: 1390 };

test("price cell: best in stock, sale, out-of-stock fallback, nothing", () => {
  expect(render(PriceCell, { offers: [offer({ price: 1390 })] })).toContain("1\u00a0390\u00a0₽");
  const sale = render(PriceCell, { offers: [offer({ price: 1700, salePercent: 15 })] });
  expect(sale).toContain("−15%");
  expect(sale).toContain("text-poll-best");
  const out = render(PriceCell, { offers: [offer({ price: 2100, available: false })] });
  expect(out).toContain("2\u00a0100\u00a0₽");
  expect(out).toContain("нет в наличии");
  expect(out).toContain("text-muted-foreground");
  expect(render(PriceCell, { offers: [] })).toContain("—");
  expect(render(PriceCell, { offers: [offer({ stale: true })] })).toContain("—");
});

test("table has a sortable price column and rows that toggle a panel instead of linking out", () => {
  const html = render(ResultsTable, { games: [pricedGame], sort: "price", sortDir: "asc", russian: true });
  expect(html).toContain("Цена");
  expect(html).toContain('aria-sort="ascending"');
  expect(html).toMatch(/<button(?=[^>]*aria-expanded="false")(?=[^>]*aria-controls="prices-5")/);
  expect(html).not.toContain(`href="${pollGame.bggUrl}"`);
  expect(html).toContain("1\u00a0390\u00a0₽");
  expect(html).not.toContain('id="prices-5"');
});

test("the voters column gives way to the price on narrower screens", () => {
  const html = render(ResultsTable, { games: [pricedGame], sort: "rank", sortDir: "asc", russian: true });
  expect(html.match(/hidden xl:table-cell/g)).toHaveLength(2);
});

test("phone list item toggles the same panel and shows the price", () => {
  const html = render(ResultsList, { games: [pricedGame], russian: true });
  expect(html).toMatch(/<button(?=[^>]*aria-expanded="false")(?=[^>]*aria-controls="prices-m-5")/);
  expect(html).not.toContain(`href="${pollGame.bggUrl}"`);
  expect(html).toContain("1\u00a0390\u00a0₽");
});

test("closed phone items stay cheap to render off screen", () => {
  expect(render(ResultsList, { games: [pricedGame], russian: true })).toMatch(/<li[^>]*content-visibility:auto/);
});

test("in the Russian view the rows show the Russian title, falling back to the BGG one", () => {
  const table = render(ResultsTable, { games: [pricedGame], sort: "rank", sortDir: "asc", russian: true });
  expect(table).toContain("Опросная игра");
  expect(table).not.toContain("Poll Game");
  const untranslated = render(ResultsList, { games: [{ ...pricedGame, titleRu: null }], russian: true });
  expect(untranslated).toContain("Poll Game");
});

test("outside the Russian view there are no prices and rows open BGG with the original title", () => {
  const table = render(ResultsTable, { games: [pricedGame], sort: "rank", sortDir: "asc", russian: false });
  expect(table).not.toContain("Цена");
  expect(table).not.toContain("1\u00a0390\u00a0₽");
  expect(table).not.toContain("aria-expanded=");
  expect(table).not.toContain("hidden xl:table-cell");
  expect(table).toContain(`href="${pollGame.bggUrl}"`);
  expect(table).toContain("Poll Game");
  expect(table).not.toContain("Опросная игра");

  const list = render(ResultsList, { games: [pricedGame], russian: false });
  expect(list).not.toContain("1\u00a0390\u00a0₽");
  expect(list).not.toContain("aria-expanded=");
  expect(list).toContain(`href="${pollGame.bggUrl}"`);
});
