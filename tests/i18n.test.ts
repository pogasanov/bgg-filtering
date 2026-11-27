import { expect, test } from "vitest";
import { mechanicLabel, mechanicMatches, mechanicNamesRu } from "@/lib/i18n/mechanics";
import { messages } from "@/lib/i18n/messages";

test("every language has every message, of the same kind", () => {
  for (const [key, value] of Object.entries(messages.ru)) {
    const en = messages.en[key as keyof typeof messages.en];
    expect(typeof en, key).toBe(typeof value);
  }
});

test("mechanics show in Russian, but keep their BGG name as the key", () => {
  expect(mechanicLabel("Worker Placement", "ru")).toBe("Размещение рабочих");
  expect(mechanicLabel("Worker Placement", "en")).toBe("Worker Placement");
  // A mechanic BGG adds later still shows, under its English name.
  expect(mechanicLabel("Brand New Mechanic", "ru")).toBe("Brand New Mechanic");
});

test("no two mechanics share a Russian name, so the list never shows a double", () => {
  const names = Object.values(mechanicNamesRu);
  expect(new Set(names).size).toBe(names.length);
});

test("a mechanic is found by its Russian or English name, ignoring case and ё", () => {
  expect(mechanicMatches("Worker Placement", "рабоч")).toBe(true);
  expect(mechanicMatches("Worker Placement", "WORKER")).toBe(true);
  expect(mechanicMatches("Re-rolling and Locking", "переброс")).toBe(true);
  expect(mechanicMatches("Layering", "слоев")).toBe(true);
  expect(mechanicMatches("Worker Placement", "кубик")).toBe(false);
  expect(mechanicMatches("Worker Placement", "  ")).toBe(true);
});
