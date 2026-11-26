import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PriceChanges } from "@/components/prices/price-changes";
import { PricePanelView } from "@/components/prices/price-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ChangeRow } from "@/lib/prices/changes";
import type { GameHistory } from "@/lib/prices/history";
import { offer, sampleHistory } from "./price-fixtures";

function render<P extends object>(component: ComponentType<P>, props: P) {
  return renderToStaticMarkup(createElement(TooltipProvider, null, createElement(component, props)));
}

const BGG = "https://boardgamegeek.com/boardgame/1";
const offers = [offer({ shop: "lavkaigr", url: "https://lavka.example/p" }), offer({ shop: "gaga", url: "https://gaga.example/p" })];

function row(overrides: Partial<ChangeRow>): ChangeRow {
  return {
    id: "lavkaigr:2026-12-01T00:00:00.000Z",
    at: "2026-12-01T00:00:00.000Z",
    shop: "lavkaigr",
    url: "https://lavka.example/p",
    price: 1700,
    available: true,
    changePercent: null,
    current: false,
    stale: false,
    checkedAt: null,
    ...overrides,
  };
}

test("no confirmed shop: a message and the BGG link, nothing else", () => {
  const html = render(PricePanelView, { offers: [], bggUrl: BGG, state: { status: "loading" }, onRetry() {} });
  expect(html).toContain("Игра не найдена в отслеживаемых магазинах.");
  expect(html).toContain(`href="${BGG}"`);
  expect(html).not.toContain("aria-busy");
});

test("the ready panel is a table of price changes, with no chart and no event column", () => {
  const html = render(PricePanelView, { offers, bggUrl: BGG, state: { status: "ready", history: sampleHistory }, onRetry() {} });
  expect(html.match(/<tr/g)).toHaveLength(5);
  for (const head of ["Дата", "Магазин", "Цена", "Изменение"]) expect(html).toContain(`>${head}<`);
  expect(html).not.toContain("Событие");
  expect(html).not.toContain('data-slot="chart"');
  expect(html).toContain("Минимум за всё время");
  expect(html).toContain("Цены обновлены 09.12.2026");
  expect(html).toContain(`href="${BGG}"`);
});

test("each change row opens the shop's product page in a new tab, with no added parameters", () => {
  const html = render(PriceChanges, { rows: [row({ shop: "gaga", id: "g", url: "https://gaga.example/p" })] });
  expect(html).toMatch(/<a(?=[^>]*href="https:\/\/gaga\.example\/p")(?=[^>]*target="_blank")(?=[^>]*after:absolute)[^>]*>GaGa</);
  expect(html).not.toContain("utm_");
});

test("the change column shows drops, rises, out-of-stock and stale shops", () => {
  const html = render(PriceChanges, {
    rows: [
      row({ id: "a", changePercent: -15 }),
      row({ id: "b", changePercent: 10 }),
      row({ id: "c", available: false }),
      row({ id: "d", current: true, stale: true, checkedAt: "2026-12-01T05:00:00.000Z" }),
      row({ id: "e", price: null }),
    ],
  });
  expect(html).toContain("−15%");
  expect(html).toContain("+10%");
  expect(html).toContain("нет в наличии");
  expect(html).toContain("проверено 01.12.2026");
  expect(html).toContain("нет цены");
});

test("a long history shows the latest changes and offers the rest", () => {
  const rows = Array.from({ length: 12 }, (_, index) => row({ id: `r${index}` }));
  const html = render(PriceChanges, { rows });
  expect(html.match(/<tr/g)).toHaveLength(9);
  expect(html).toContain("Показать все (12)");
  expect(render(PriceChanges, { rows: rows.slice(0, 8) })).not.toContain("Показать все");
});

test("a failed history load offers a retry and keeps the BGG link", () => {
  const html = render(PricePanelView, { offers: [offer()], bggUrl: BGG, state: { status: "error" }, onRetry() {} });
  expect(html).toContain("Не удалось загрузить историю цен");
  expect(html).toContain("Повторить");
  expect(html).toContain(`href="${BGG}"`);
});

test("while loading, the table area is marked busy", () => {
  const html = render(PricePanelView, { offers: [offer()], bggUrl: BGG, state: { status: "loading" }, onRetry() {} });
  expect(html).toContain('aria-busy="true"');
});

test("one recorded price is simply one row", () => {
  const one: GameHistory = {
    lowest: null,
    shops: [{ shop: "lavkaigr", checkedAt: "2026-12-09T00:00:00.000Z", points: [{ at: "2026-12-09T00:00:00.000Z", price: 2000, available: true }] }],
  };
  const html = render(PricePanelView, { offers: [offer()], bggUrl: BGG, state: { status: "ready", history: one }, onRetry() {} });
  expect(html.match(/<tr/g)).toHaveLength(2);
  expect(html).toContain("2 000 ₽");
});
