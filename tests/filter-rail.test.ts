import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { FilterRail, type FilterRailProps } from "@/components/filters/filter-rail";
import type { CatalogStatus } from "@/lib/catalog/types";
import { defaultFilters } from "@/lib/url-state";

const status: CatalogStatus = {
  gameCount: 3,
  updatedAt: "2026-11-22T10:00:00.000Z",
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

test("mechanics show counts and keep selected mechanics that left the data", () => {
  const html = render({ filters: { ...defaultFilters, tags: ["Gone Tag"] } });
  expect(html).toContain("Gone Tag");
  expect(html).toContain(">12<");
  expect(html.indexOf("Gone Tag")).toBeLessThan(html.indexOf("Economic"));
});

test("mechanics are titled and named in Russian, with the BGG name kept for the URL", () => {
  const html = render();
  expect(html).toContain(">Механики<");
  expect(html).not.toContain("Категории");
  expect(html).toMatch(/data-mechanic="Worker Placement"[^>]*title="Worker Placement"/);
  expect(html).toContain(">Размещение рабочих<");
});

test("mechanics list the most common first, hide the empty ones and fold the rest", () => {
  const names = Array.from({ length: 14 }, (_, index) => `Mechanic ${index + 1}`);
  const html = render({
    allTags: [...names, "Unused"],
    tagCounts: new Map([...names.map((name, index): [string, number] => [name, 100 - index]), ["Unused", 0]]),
  });
  const listed = [...html.matchAll(/data-mechanic="([^"]+)"/g)].map((match) => match[1]);
  expect(listed).toEqual(names.slice(0, 10));
  expect(html).toContain("Ещё 4");
  expect(html).not.toContain('data-mechanic="Unused"');
});

test("groups show a per-group counter only when something is active", () => {
  expect(render()).not.toContain("Сбросить: Игроки × вердикт");
  const html = render({ filters: { ...defaultFilters, matrix: [{ playerCount: "2", verdict: "best" }] } });
  expect(html).toContain("Сбросить: Игроки × вердикт");
});

test("footer carries the BGG mark and the update date, and nothing is a card", () => {
  const html = render();
  expect(html).toContain('aria-label="Powered by BoardGameGeek"');
  expect(html).toContain("Обновлено 22.11.2026");
  expect(html).not.toContain('data-slot="card"');
});

test("the public footer has no sync control", () => {
  expect(render()).not.toContain("Синхрониз");
});

test("the update date is the UTC day whatever the server timezone", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Asia/Yekaterinburg";
  try {
    const html = render({ status: { gameCount: 3, updatedAt: "2026-11-22T23:30:00.000Z" } });
    expect(html).toContain("Обновлено 22.11.2026");
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("says when the data has never been updated", () => {
  expect(render({ status: { gameCount: 0, updatedAt: null } })).toContain("Ещё не обновлялось");
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
