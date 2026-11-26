import { expect, test } from "vitest";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import { pollGame } from "./fixtures";
import { pollCellLabel, pollCells, pollStripLabel } from "@/lib/poll";

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
