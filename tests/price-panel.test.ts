import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PricePanelView } from "@/components/prices/price-panel";
import { ShopList } from "@/components/prices/shop-list";
import type { GameHistory } from "@/lib/prices/history";
import { NOW, offer } from "./price-fixtures";

function render<P extends object>(component: ComponentType<P>, props: P) {
  return renderToStaticMarkup(createElement(component, props));
}

const BGG = "https://boardgamegeek.com/boardgame/1";

test("no confirmed shop: a message and the BGG link, nothing else", () => {
  const html = render(PricePanelView, { offers: [], bggUrl: BGG, state: { status: "loading" }, onRetry() {}, now: NOW });
  expect(html).toContain("Игра не найдена в отслеживаемых магазинах.");
  expect(html).toContain(`href="${BGG}"`);
  expect(html).not.toContain("aria-busy");
});

test("shop list links to the product, shows sale, stock and stale state", () => {
  const html = render(ShopList, {
    bggUrl: BGG,
    lowest: { price: 1500, at: "2026-10-01T00:00:00.000Z", shop: "gaga" },
    offers: [
      offer({ shop: "crowdgames", url: "https://crowdgames.ru/p/1", price: 1700, salePercent: 15 }),
      offer({ shop: "lavkaigr", price: 1900, available: false }),
      offer({ shop: "gaga", price: 2100, stale: true, checkedAt: "2026-12-01T05:00:00.000Z" }),
    ],
  });
  expect(html).toMatch(/<a(?=[^>]*href="https:\/\/crowdgames\.ru\/p\/1")(?=[^>]*target="_blank")[^>]*>CrowdGames</);
  expect(html).toContain("−15%");
  expect(html).toContain("нет в наличии");
  expect(html).toContain("проверено 01.12.2026");
  expect(html).toContain("Минимум за всё время");
  expect(html).toContain("1 500 ₽");
  expect(html).toContain(`href="${BGG}"`);
  expect(html).not.toContain("utm_");
});

test("a failed history load keeps the shops and offers a retry", () => {
  const html = render(PricePanelView, { offers: [offer()], bggUrl: BGG, state: { status: "error" }, onRetry() {}, now: NOW });
  expect(html).toContain("Не удалось загрузить историю цен");
  expect(html).toContain("Повторить");
  expect(html).toContain("Лавка игр");
});

test("while loading, the shops are already there and the chart area is marked busy", () => {
  const html = render(PricePanelView, { offers: [offer()], bggUrl: BGG, state: { status: "loading" }, onRetry() {}, now: NOW });
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("Лавка игр");
});

test("one data point still renders the chart, with no caption about missing history", () => {
  const one: GameHistory = {
    lowest: null,
    shops: [{ shop: "lavkaigr", checkedAt: "2026-12-09T00:00:00.000Z", points: [{ at: "2026-12-09T00:00:00.000Z", price: 2000, available: true }] }],
  };
  const html = render(PricePanelView, { offers: [offer()], bggUrl: BGG, state: { status: "ready", history: one }, onRetry() {}, now: NOW });
  expect(html).toContain('data-slot="chart"');
  expect(html).toContain("90 дней");
  expect(html).not.toContain("История цен");
});
