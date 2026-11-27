import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { GamePage } from "@/components/game/game-page";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { ListedGame } from "@/lib/bgg/types";
import { gameIdFromSlug, gameName, gamePath, gameSummary } from "@/lib/game-page";
import { EMPTY_HISTORY } from "@/lib/prices/history";
import { pollGame } from "./fixtures";
import { offer, sampleHistory } from "./price-fixtures";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace() {}, refresh() {} }) }));

/** 2–4 players: best at 3, recommended at 2, not at 4; 1 is out of range. */
const game: ListedGame = {
  ...pollGame,
  mechanics: ["Worker Placement", "Cooperative Game"],
  playerRecommendations: {
    ...pollGame.playerRecommendations,
    "2": { best: 4, recommended: 10, notRecommended: 1, verdict: "recommended" },
    "3": { best: 12, recommended: 3, notRecommended: 0, verdict: "best" },
    "4": { best: 1, recommended: 3, notRecommended: 9, verdict: "not-recommended" },
  },
  offers: [offer({ shop: "lavkaigr", price: 1990 }), offer({ shop: "gaga", price: 2490, url: "https://gaga.example/p" })],
};

describe("game page helpers", () => {
  test("addresses carry the BGG id and the shown name, and the id is read back", () => {
    expect(gamePath(266192, "Крылья")).toBe("/igra/266192-krylya");
    expect(gamePath(7, "三国")).toBe("/igra/7");
    expect(gameIdFromSlug("266192-krylya")).toBe(266192);
    expect(gameIdFromSlug("266192")).toBe(266192);
    expect(gameIdFromSlug("krylya")).toBeNull();
    expect(gameIdFromSlug("0-x")).toBeNull();
    expect(gamePath(266192, "Wingspan", "en")).toBe("/game/266192-wingspan");
  });

  test("the English site names the game by its BGG title and answers in English", () => {
    expect(gameName(game, "en")).toBe("Poll Game");
    expect(gameName(game, "ru")).toBe("Опросная игра");
    expect(gameSummary(game, "en")).toBe(
      "According to the BGG player poll, Poll Game is best with 3 players, recommended with 2, not recommended with 4.",
    );
  });

  test("the summary states the poll for the supported counts and the price", () => {
    expect(gameSummary(game)).toBe(
      "По опросу игроков BGG «Опросная игра» лучше всего на 3, рекомендуют на 2, на 4 — не рекомендуют. В магазинах от 1\u00a0990\u00a0₽.",
    );
    expect(gameSummary({ ...game, offers: [offer({ available: false, price: 2100 })] })).toContain("Сейчас нет в наличии, последняя цена 2\u00a0100\u00a0₽.");
    expect(gameSummary({ ...game, offers: [] })).not.toContain("₽");
  });
});

describe("game page", () => {
  const render = (props: Parameters<typeof GamePage>[0]) =>
    renderToStaticMarkup(createElement(TooltipProvider, null, createElement(GamePage, props)));

  test("names the game, answers in a sentence and shows the poll with its votes", () => {
    const html = render({ game, history: sampleHistory });
    expect(html).toMatch(/<h1[^>]*>Опросная игра<\/h1>/);
    expect(html).toContain("Poll Game · 2019 · № 5 в рейтинге BGG");
    expect(html).toContain("лучше всего на 3, рекомендуют на 2");
    expect(html).toContain("80% · 20% · 0%");
    expect(html).toContain("вне диапазона игроков");
  });

  test("lists the shops with links out, the all-time low and the price changes", () => {
    const html = render({ game, history: sampleHistory });
    expect(html).toContain('href="https://gaga.example/p"');
    expect(html).toContain("В магазин ↗");
    expect(html).toContain("Самая низкая цена за всё время");
    expect(html).toContain("Изменения цен");
  });

  test("links mechanics to their collections, the best count to its collection, and BGG", () => {
    const html = render({ game, history: EMPTY_HISTORY });
    expect(html).toContain('href="/mehaniki/razmeshchenie-rabochih"');
    expect(html).toContain('href="/mehaniki/kooperativ"');
    expect(html).toContain('href="/na-troih"');
    expect(html).toContain(`href="${game.bggUrl}"`);
    expect(html).toContain('aria-label="Powered by BoardGameGeek"');
  });

  test("describes the product with its price range only while it can be bought", () => {
    const priced = render({ game, history: EMPTY_HISTORY });
    const data = JSON.parse(priced.match(/<script type="application\/ld\+json">(.*?)<\/script>/)![1]);
    expect(data[0]).toMatchObject({ "@type": "Product", name: "Опросная игра", alternateName: "Poll Game" });
    expect(data[0].offers).toMatchObject({ "@type": "AggregateOffer", priceCurrency: "RUB", lowPrice: 1990, highPrice: 2490, offerCount: 2 });
    expect(data[1]["@type"]).toBe("BreadcrumbList");

    const unpriced = render({ game: { ...game, offers: [] }, history: EMPTY_HISTORY });
    expect(unpriced).not.toContain('"Product"');
    expect(unpriced).toContain("Игра не найдена в отслеживаемых магазинах.");
  });
});
