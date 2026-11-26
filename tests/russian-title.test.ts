import { describe, expect, test } from "vitest";
import { russianTitle } from "@/lib/bgg/russian-title";

describe("russianTitle", () => {
  test("skips Ukrainian, Bulgarian and non-Cyrillic names", () => {
    expect(russianTitle(["Кодові імена", "Кодови имена: Тандем", "Кодовые имена. Дуэт", "コードネーム"])).toBe("Кодовые имена. Дуэт");
    expect(russianTitle(["Під полум'ям небес", "Вторжение с небес"])).toBe("Вторжение с небес");
    expect(russianTitle(["Кръв и Ярост", "Кровь и Ярость", "Лють крові"])).toBe("Кровь и Ярость");
  });

  test("prefers names with letters only Russian has, the shortest of them", () => {
    expect(russianTitle(["Codenames: Кодовые Имена XXL", "Кодовые Имена"])).toBe("Кодовые Имена");
  });

  test("without such letters takes the longest Cyrillic name", () => {
    expect(russianTitle(["Сучасне мистецтво", "Современное искусство"])).toBe("Современное искусство");
  });

  test("is null when no name looks Russian", () => {
    expect(russianTitle([])).toBeNull();
    expect(russianTitle(["Домініон (друге видання)", "ドミニオン"])).toBeNull();
  });
});
