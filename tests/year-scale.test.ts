import { describe, expect, test } from "vitest";
import { buildYearScale, closestYear, positionForYear, yearAtPosition } from "@/lib/year-scale";

describe("year scale", () => {
  const scale = [-2200, 1995, 2020, 2025];

  test("sorts and deduplicates known years", () => {
    expect(buildYearScale([2025, null, -2200, 2020, 2025, 1995])).toEqual(scale);
  });

  test("maps ordinal positions to represented years", () => {
    expect(yearAtPosition(scale, 0)).toBeNull();
    expect(yearAtPosition(scale, 1)).toBe(-2200);
    expect(yearAtPosition(scale, 3)).toBe(2020);
    expect(yearAtPosition(scale, scale.length + 1)).toBeNull();
  });

  test("maps years to one-based ordinal positions", () => {
    expect(positionForYear(scale, -2200)).toBe(1);
    expect(positionForYear(scale, 2020)).toBe(3);
    expect(positionForYear([], 2020)).toBeNull();
  });

  test("reconciles missing years to the closest represented year", () => {
    expect(closestYear(scale, 2019)).toBe(2020);
    expect(closestYear([2000, 2020], 2010)).toBe(2000);
    expect(closestYear([], 2020)).toBeNull();
    expect(positionForYear(scale, 2019)).toBe(3);
  });
});
