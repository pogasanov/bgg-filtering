import { expect, test } from "vitest";
import { clampPage, pageCount, pageItems, pageSlice, PAGE_SIZE } from "@/lib/pagination";

test("a page holds 100 items and an empty list still has one page", () => {
  expect(PAGE_SIZE).toBe(100);
  expect(pageCount(0)).toBe(1);
  expect(pageCount(100)).toBe(1);
  expect(pageCount(101)).toBe(2);
});

test("clamps a page number to the pages that exist", () => {
  expect(clampPage(3, 250)).toBe(3);
  expect(clampPage(9, 250)).toBe(3);
  expect(clampPage(0, 250)).toBe(1);
  expect(clampPage(Number.NaN, 250)).toBe(1);
});

test("slices the items of one page", () => {
  const items = Array.from({ length: 250 }, (_, index) => index + 1);
  expect(pageSlice(items, 1)).toHaveLength(100);
  expect(pageSlice(items, 2)[0]).toBe(101);
  expect(pageSlice(items, 3)).toHaveLength(50);
});

test("lists every page while there are few and collapses distant ones into gaps", () => {
  expect(pageItems(1, 1)).toEqual([1]);
  expect(pageItems(2, 5)).toEqual([1, 2, 3, 4, 5]);
  expect(pageItems(1, 20)).toEqual([1, 2, "gap", 20]);
  expect(pageItems(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
  expect(pageItems(3, 20)).toEqual([1, 2, 3, 4, "gap", 20]);
});
