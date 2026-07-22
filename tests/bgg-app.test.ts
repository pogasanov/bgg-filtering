import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { BggApp } from "@/components/bgg-app";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import type { CacheStatus } from "@/lib/cache/store";
import type { NormalizedGame } from "@/lib/bgg/types";

const status: CacheStatus = {
  gameCount: 3,
  cacheUpdatedAt: null,
  latestSync: {
    status: null,
    startedAt: null,
    finishedAt: null,
    fetchedCount: null,
    error: null,
  },
  syncLocked: false,
};

function makeGame(id: number, year: number | null, languages: string[] = []): NormalizedGame {
  return {
    id,
    rank: id,
    title: "Game " + id,
    year,
    description: "",
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

describe("shadcn control composition", () => {
  test("renders the open year domain as a two-thumb slider", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [makeGame(1, 1995), makeGame(2, 2020), makeGame(3, null)],
        initialStatus: status,
      }),
    );

    expect(slotCount(html, "slider")).toBe(1);
    expect(slotCount(html, "slider-thumb")).toBe(2);
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="3"');
    expect(html).not.toContain('aria-valuemin="1994"');
    expect(html).toContain(">No min<");
    expect(html).toContain(">No max<");
    expect(html).not.toContain('class="year-range-input"');
  });

  test("gives an extreme year outlier only one ordinal step", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [
          makeGame(1, -2200),
          makeGame(2, 2020),
          makeGame(3, 2021),
          makeGame(4, 2022),
        ],
        initialStatus: { ...status, gameCount: 4 },
      }),
    );

    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="5"');
    expect(html).not.toContain('aria-valuemin="-2201"');
  });

  test("disables the year slider when no known years exist", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [makeGame(1, null)],
        initialStatus: { ...status, gameCount: 1 },
      }),
    );

    expect(slotCount(html, "slider")).toBe(1);
    expect(html).toContain('data-disabled=""');
  });

  test("renders shadcn form, matrix, and scrolling controls", () => {
    const game = {
      ...makeGame(1, 2024, ["German", "English", "German"]),
      categories: ["Strategy"],
    };
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [game],
        initialStatus: { ...status, gameCount: 1 },
      }),
    );

    expect(html).toContain("Translation language");
    expect(html).toContain("Any language");
    expect(slotCount(html, "select-trigger")).toBe(2);
    expect(slotCount(html, "checkbox")).toBe(1);
    expect(slotCount(html, "scroll-area")).toBe(1);
    expect(slotCount(html, "table")).toBe(1);
  });

  test("renders empty-cache guidance as an alert", () => {
    const html = renderToStaticMarkup(
      createElement(BggApp, {
        initialGames: [],
        initialStatus: { ...status, gameCount: 0 },
      }),
    );

    expect(slotCount(html, "alert")).toBe(1);
    expect(html).toContain("SQLite cache is empty");
  });
});
