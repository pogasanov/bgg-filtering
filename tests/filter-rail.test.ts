import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FilterRail, type FilterRailProps } from "@/components/filters/filter-rail";
import type { CacheStatus } from "@/lib/cache/store";
import { defaultFilters } from "@/lib/url-state";

const status: CacheStatus = {
  gameCount: 3,
  cacheUpdatedAt: "2026-11-22T10:00:00.000Z",
  latestSync: { status: null, startedAt: null, finishedAt: null, fetchedCount: null, error: null },
  syncLocked: false,
};

function render(overrides: Partial<FilterRailProps> = {}) {
  const props: FilterRailProps = {
    filters: defaultFilters,
    onChange() {},
    allTags: ["Economic", "Worker Placement"],
    tagCounts: new Map([["Economic", 12], ["Worker Placement", 7]]),
    allLanguages: ["English", "German"],
    yearScale: [1995, 2010, 2020],
    status,
    syncing: false,
    syncError: null,
    onSync() {},
    ...overrides,
  };
  return renderToStaticMarkup(createElement(FilterRail, props));
}

function slotCount(html: string, slot: string) {
  return html.match(new RegExp(`data-slot="${slot}"`, "g"))?.length ?? 0;
}

test("matrix is 28 textless toggle cells with accessible names", () => {
  const html = render({ filters: { ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] } });
  expect(html.match(/data-matrix-cell="/g)).toHaveLength(28);
  expect(html).toMatch(/<button(?=[^>]*data-matrix-cell="2:best")(?=[^>]*aria-pressed="true")/);
  expect(html).toMatch(/<button(?=[^>]*data-matrix-cell="3:best")(?=[^>]*aria-pressed="false")/);
  expect(html).toContain('aria-label="2 игрока: лучше всего"');
  expect(html).not.toContain(">Selected<");
});

test("year shows presets and hides the slider until a custom range", () => {
  const plain = render();
  expect(slotCount(plain, "slider")).toBe(0);
  expect(plain).toContain("2010–2019");
  expect(plain).toContain("Свой…");
  expect(slotCount(render({ filters: { ...defaultFilters, minYear: 2015, maxYear: 2024 } }), "slider")).toBe(1);
});

test("tags show counts and keep selected tags that left the data", () => {
  const html = render({ filters: { ...defaultFilters, tags: ["Gone Tag"] } });
  expect(html).toContain("Gone Tag");
  expect(html).toContain(">12<");
  expect(html.indexOf("Gone Tag")).toBeLessThan(html.indexOf("Economic"));
});

test("groups show a per-group counter only when something is active", () => {
  expect(render()).not.toContain("Сбросить: Игроки × вердикт");
  const html = render({ filters: { ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] } });
  expect(html).toContain("Сбросить: Игроки × вердикт");
});

test("footer carries the BGG mark and sync state, and nothing is a card", () => {
  const html = render({ syncError: "boom", syncing: true });
  expect(html).toContain('aria-label="Powered by BoardGameGeek"');
  expect(html).toContain("Синхронизация…");
  expect(html).toContain("boom");
  expect(html).toContain("22.11.2026");
  expect(html).not.toContain('data-slot="card"');
});

test("the footer sits outside the scrolling groups so the BGG mark never scrolls away", () => {
  const html = render();
  const scroll = html.indexOf("data-rail-scroll");
  const footer = html.indexOf("data-rail-footer");
  expect(scroll).toBeGreaterThan(-1);
  expect(footer).toBeGreaterThan(scroll);
  expect(html.slice(scroll, footer)).toContain("overflow-y-auto");
  expect(html.slice(0, footer)).not.toContain("Powered by BoardGameGeek");
  expect(html.slice(footer)).toContain("Powered by BoardGameGeek");
});
