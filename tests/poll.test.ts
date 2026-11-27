import { expect, test } from "vitest";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import { pollGame } from "./fixtures";
import { decodePollCells, encodePollCells, pollCellLabel, pollCells, pollStripLabel, pollSummary } from "@/lib/poll";

test("verdict sets the cell, range only flags it", () => {
  const cells = pollCells(pollGame);
  expect(cells).toHaveLength(7);
  expect(cells[0]).toMatchObject({ playerCount: "1", verdict: "recommended", inRange: false });
  expect(cells[1]).toMatchObject({ playerCount: "2", verdict: "best", inRange: true });
  expect(cells[4]).toMatchObject({ playerCount: "5", verdict: "unknown", inRange: false });
});

test("cell labels carry the vote split and the out-of-range note", () => {
  const cells = pollCells(pollGame);
  expect(pollCellLabel(cells[1])).toBe("2 игрока: лучше всего — лучше 10 (71%), реком. 4 (29%), не рек. 0 (0%)");
  expect(pollCellLabel(cells[0])).toBe(
    "1 игрок: рекомендуют — лучше 0 (0%), реком. 6 (60%), не рек. 4 (40%) · вне диапазона игроков",
  );
  expect(pollCellLabel(cells[2])).toBe("3 игрока: нет данных");
});

test("a game with no poll data gives seven unknown cells", () => {
  const cells = pollCells({ ...pollGame, playerRecommendations: emptyPlayerRecommendations() });
  expect(cells.every((cell) => cell.verdict === "unknown")).toBe(true);
});

test("strip label joins every cell", () => {
  expect(pollStripLabel(pollGame).split("; ")).toHaveLength(7);
});

test("summary names the supported counts by verdict and skips the ones outside the range", () => {
  expect(pollSummary(pollCells(pollGame))).toBe("Опрос: лучше всего на 2");
  const cells = pollCells({
    ...pollGame,
    playerRecommendations: {
      ...pollGame.playerRecommendations,
      "3": { best: 2, recommended: 9, notRecommended: 1, verdict: "recommended" },
      "4": { best: 0, recommended: 2, notRecommended: 9, verdict: "not-recommended" },
    },
  });
  expect(pollSummary(cells)).toBe("Опрос: лучше всего на 2; рекомендуют на 3; не рекомендуют на 4");
  expect(pollSummary(pollCells({ ...pollGame, playerRecommendations: emptyPlayerRecommendations() }))).toBe("Опрос: нет данных");
});

test("cells survive the short form the strip receives", () => {
  const cells = pollCells(pollGame);
  expect(decodePollCells(encodePollCells(cells))).toEqual(cells);
  expect(encodePollCells(cells).length).toBeLessThan(80);
});
