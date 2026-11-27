import { expect, test } from "vitest";
import { playerCounts } from "@/lib/bgg/types";
import { formatNumber, matrixCellLabel, playersLabel } from "@/lib/labels";

test("player-count plurals", () => {
  expect(playerCounts.map(playersLabel)).toEqual([
    "1 игрок", "2 игрока", "3 игрока", "4 игрока", "5 игроков", "6 игроков", "7+ игроков",
  ]);
});

test("matrix cell label", () => {
  expect(matrixCellLabel({ playerCount: "2", verdict: "best" })).toBe("2 игрока: лучше всего");
  expect(matrixCellLabel({ playerCount: "6+", verdict: "not-playable" })).toBe("7+ игроков: нельзя играть");
});

test("missing numbers render as a dash and digits are fixed", () => {
  expect(formatNumber(null)).toBe("—");
  expect(formatNumber(8.4, 2)).toBe("8,40");
  expect(formatNumber(2.66, 1)).toBe("2,7");
});
