import { expect, test } from "vitest";
import { activeYearPreset, yearPresets, yearRangeLabel } from "@/lib/year-presets";

test("matches presets, custom ranges and the empty range", () => {
  expect(yearPresets.map((preset) => preset.label.ru)).toEqual(["до 2000", "2000–2009", "2010–2019", "2020+"]);
  expect(activeYearPreset(null, 1999)).toBe("pre2000");
  expect(activeYearPreset(2010, 2019)).toBe("2010s");
  expect(activeYearPreset(2020, null)).toBe("2020plus");
  expect(activeYearPreset(2015, 2024)).toBe("custom");
  expect(activeYearPreset(null, null)).toBeNull();
});

test("range label", () => {
  expect(yearRangeLabel(2015, 2024)).toBe("2015 — 2024");
  expect(yearRangeLabel(null, 1999)).toBe("до 1999");
  expect(yearRangeLabel(2020, null)).toBe("с 2020");
  expect(yearRangeLabel(null, null)).toBe("любой");
});
