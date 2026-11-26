import { expect, test } from "vitest";
import { chartSeries } from "@/lib/prices/chart";
import type { GameHistory } from "@/lib/prices/history";
import { NOW } from "./price-fixtures";
import { sampleHistory } from "./price-fixtures";

const day = (date: string) => Date.parse(`${date}T00:00:00.000Z`);

test("steps carry forward, break while out of stock and end at the last check", () => {
  const { rows, shops } = chartSeries(sampleHistory, "all", NOW);
  expect(shops).toEqual(["lavkaigr", "gaga"]);
  expect(rows.map((row) => row.t)).toEqual([
    day("2026-08-01"), day("2026-11-20"), day("2026-12-01"), day("2026-12-05"), day("2026-12-09"),
  ]);
  expect(rows.map((row) => row.lavkaigr)).toEqual([2000, null, 1700, 1700, 1700]);
  expect(rows.map((row) => row.gaga)).toEqual([undefined, undefined, undefined, 1900, 1900]);
});

test("a bounded range starts with the price in force at its start", () => {
  const { rows, pointCount } = chartSeries(sampleHistory, "30d", NOW);
  expect(rows[0]).toMatchObject({ t: day("2026-11-10"), lavkaigr: 2000 });
  expect(rows[0].gaga).toBeUndefined();
  expect(pointCount).toBe(3);
});

test("a single observation is one point, and no history is no rows", () => {
  const one: GameHistory = {
    lowest: null,
    shops: [{ shop: "gaga", checkedAt: "2026-12-05T00:00:00.000Z", points: [{ at: "2026-12-05T00:00:00.000Z", price: 1900, available: true }] }],
  };
  expect(chartSeries(one, "90d", NOW)).toMatchObject({ pointCount: 1, shops: ["gaga"] });
  expect(chartSeries(one, "90d", NOW).rows).toEqual([{ t: day("2026-12-05"), gaga: 1900 }]);
  expect(chartSeries({ shops: [], lowest: null }, "90d", NOW)).toEqual({ rows: [], shops: [], pointCount: 0 });
});
