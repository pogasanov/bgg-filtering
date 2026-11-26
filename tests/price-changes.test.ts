import { expect, test } from "vitest";
import { changeRows } from "@/lib/prices/changes";
import type { GameHistory } from "@/lib/prices/history";
import { offer, sampleHistory } from "./price-fixtures";

const offers = [
  offer({ shop: "lavkaigr", url: "https://lavka.example/p" }),
  offer({ shop: "gaga", url: "https://gaga.example/p" }),
];

test("lists every change, newest first, with the shop's product page", () => {
  const rows = changeRows(sampleHistory, offers);
  expect(rows.map((row) => [row.at.slice(0, 10), row.shop, row.price])).toEqual([
    ["2026-12-05", "gaga", 1900],
    ["2026-12-01", "lavkaigr", 1700],
    ["2026-11-20", "lavkaigr", 2000],
    ["2026-08-01", "lavkaigr", 2000],
  ]);
  expect(rows[0].url).toBe("https://gaga.example/p");
  expect(rows[1].url).toBe("https://lavka.example/p");
});

test("the change is measured against the same shop's previous price", () => {
  const rows = changeRows(sampleHistory, offers);
  expect(rows.map((row) => row.changePercent)).toEqual([null, -15, null, null]);
});

test("marks out-of-stock rows and each shop's current row", () => {
  const rows = changeRows(sampleHistory, offers);
  expect(rows.map((row) => row.available)).toEqual([true, true, false, true]);
  expect(rows.map((row) => row.current)).toEqual([true, true, false, false]);
});

test("a rise is positive, an unpriced row has no change, and stale shops are flagged", () => {
  const history: GameHistory = {
    lowest: null,
    shops: [
      {
        shop: "crowdgames",
        checkedAt: "2026-12-01T00:00:00.000Z",
        points: [
          { at: "2026-10-01T00:00:00.000Z", price: 1000, available: true },
          { at: "2026-10-10T00:00:00.000Z", price: null, available: true },
          { at: "2026-11-01T00:00:00.000Z", price: 1100, available: true },
        ],
      },
    ],
  };
  const rows = changeRows(history, [offer({ shop: "crowdgames", stale: true, checkedAt: "2026-12-01T00:00:00.000Z" })]);
  expect(rows.map((row) => row.changePercent)).toEqual([10, null, null]);
  expect(rows[0]).toMatchObject({ stale: true, checkedAt: "2026-12-01T00:00:00.000Z" });
  expect(rows[1].stale).toBe(false);
});

test("a shop missing from the current offers still lists its rows, without a link", () => {
  expect(changeRows(sampleHistory, []).every((row) => row.url === null)).toBe(true);
  expect(changeRows({ shops: [], lowest: null }, offers)).toEqual([]);
});
