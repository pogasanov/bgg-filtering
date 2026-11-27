import { expect, test } from "vitest";
import { playerCounts } from "@/lib/bgg/types";
import { formatNumber, formatUpdatedDate, languageLabel, matrixCellLabel, playersLabel, sortLabel } from "@/lib/labels";

test("player-count plurals", () => {
  expect(playerCounts.map((count) => playersLabel(count))).toEqual([
    "1 игрок", "2 игрока", "3 игрока", "4 игрока", "5 игроков", "6 игроков", "7+ игроков",
  ]);
  expect(playerCounts.map((count) => playersLabel(count, "en"))).toEqual([
    "1 player", "2 players", "3 players", "4 players", "5 players", "6 players", "7+ players",
  ]);
});

test("matrix cell label", () => {
  expect(matrixCellLabel({ playerCount: "2", verdict: "best" })).toBe("2 игрока: лучше всего");
  expect(matrixCellLabel({ playerCount: "6+", verdict: "not-playable" })).toBe("7+ игроков: нельзя играть");
  expect(matrixCellLabel({ playerCount: "2", verdict: "best" }, "en")).toBe("2 players: best");
});

test("missing numbers render as a dash and digits are fixed", () => {
  expect(formatNumber(null)).toBe("—");
  expect(formatNumber(8.4, 2)).toBe("8,40");
  expect(formatNumber(2.66, 1)).toBe("2,7");
});

test("labels follow the interface language, Russian by default", () => {
  expect(sortLabel("weight")).toBe("Сложность");
  expect(sortLabel("weight", "en")).toBe("Weight");
  expect(languageLabel("")).toBe("Любой язык");
  expect(languageLabel("", "en")).toBe("Any language");
  expect(languageLabel("Russian", "en")).toBe("Russian");
  expect(formatUpdatedDate("2026-11-22T10:00:00.000Z", "en")).toBe("Updated 22/11/2026");
});
