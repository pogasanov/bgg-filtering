import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { GameThumb } from "@/components/results/game-thumb";
import { PollStrip } from "@/components/results/poll-strip";
import { ResultsList } from "@/components/results/results-list";
import { ResultsBar } from "@/components/results/results-bar";
import { ResultsTable } from "@/components/results/results-table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { activeFilterChips } from "@/lib/active-filters";
import { defaultFilters } from "@/lib/url-state";
import { pollGame } from "./fixtures";

function render<P extends object>(component: ComponentType<P>, props: P) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, createElement(component, props)));
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

test("table renders one linked row per game with dashes for missing numbers", () => {
  const sparse = { ...pollGame, description: "SECRET", playingTime: null, weight: null, rank: null, minPlayers: null, maxPlayers: null };
  const html = render(ResultsTable, { games: [sparse], sort: "rank", sortDir: "asc", onSort() {}, onReset() {} });
  expect(html).toContain(`href="${pollGame.bggUrl}"`);
  expect(html).toContain('target="_blank"');
  expect(html).toContain('aria-sort="ascending"');
  expect(html.match(/—/g)!.length).toBeGreaterThanOrEqual(4);
  expect(html).toContain("Economic · Worker Placement");
  expect(html).not.toContain("SECRET");
});

test("only the active sort column announces a direction", () => {
  const html = render(ResultsTable, { games: [pollGame], sort: "weight", sortDir: "desc", onSort() {}, onReset() {} });
  expect(html.match(/aria-sort="/g)).toHaveLength(1);
  expect(html).toContain('aria-sort="descending"');
});

test("empty result shows a reset action", () => {
  const html = render(ResultsTable, { games: [], sort: "rank", sortDir: "asc", onSort() {}, onReset() {} });
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
  const html = render(ResultsList, { games: [pollGame], onReset() {} });
  expect(html.match(/<li/g)).toHaveLength(1);
  expect(html).toContain(`href="${pollGame.bggUrl}"`);
  expect(html.match(/data-verdict="/g)).toHaveLength(7);
  expect(html).toContain('data-thumb="placeholder"');
  expect(render(ResultsList, { games: [], onReset() {} })).toContain("Ничего не найдено");
});

test("on phones the strip lets taps through to the row link; on desktop it stays hoverable", () => {
  const list = render(ResultsList, { games: [pollGame], onReset() {} });
  expect(list).toMatch(/<span(?=[^>]*role="img")(?=[^>]*pointer-events-none)/);
  const table = render(ResultsTable, { games: [pollGame], sort: "rank", sortDir: "asc", onSort() {}, onReset() {} });
  expect(table).not.toMatch(/<span(?=[^>]*role="img")(?=[^>]*pointer-events-none)/);
});
