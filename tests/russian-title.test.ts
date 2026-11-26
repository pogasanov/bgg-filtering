import { describe, expect, test } from "vitest";
import { buildShopTitleIndex, pickRussianTitle, russianCandidates } from "@/lib/bgg/russian-title";

const noEvidence = { linkedTitles: [], shopIndex: buildShopTitleIndex([]) };

describe("russianCandidates", () => {
  test("drops Ukrainian, Bulgarian, Serbian and non-Cyrillic names", () => {
    expect(
      russianCandidates([
        "Кодові імена",
        "Під полум'ям небес",
        "Кръв и Ярост",
        "Кодови имена: Тандем",
        "コードネーム",
        "Kinfire. Сходження: Грот Марнославства",
        "Ктулху та друзі",
        "З молотка!",
        "Kinfire: Предания – Чертоги тщеславия",
      ]),
    ).toEqual(["Кодови имена: Тандем", "Kinfire: Предания – Чертоги тщеславия"]);
  });

  test("keeps one of names that differ only in case or punctuation", () => {
    expect(russianCandidates(["Каркасон", "каркасон", "Каркассон"])).toEqual(["Каркасон", "Каркассон"]);
  });
});

describe("pickRussianTitle", () => {
  test("prefers the name the game's own shop product is sold under", () => {
    const evidence = { linkedTitles: ["Настольная игра Серп. Базовая"], shopIndex: buildShopTitleIndex([]) };
    expect(pickRussianTitle(["Коса", "Серп"], evidence)).toBe("Серп");
  });

  test("then a name a Russian shop sells something under, as whole words", () => {
    const shopIndex = buildShopTitleIndex(["Плавники", "Набор ресурсов для игры \"Рибокрай\"", "Серпантин", "Коса и камень"]);
    expect(pickRussianTitle(["Рибокрай", "Плавники"], { linkedTitles: [], shopIndex })).toBe("Плавники");
    expect(pickRussianTitle(["Серп", "Коса"], { linkedTitles: [], shopIndex })).toBe("Коса");
  });

  test("then a name with a letter only Russian has, the shortest", () => {
    expect(pickRussianTitle(["Codenames: Кодовые Имена XXL", "Кодовые Имена", "Кодови имена"], noEvidence)).toBe("Кодовые Имена");
  });

  test("Russian adjective endings count as a Russian mark", () => {
    expect(pickRussianTitle(["Unmatched: Битва Легенд, Том Второй", "Unmatched: Битва легенд. Частина друга"], noEvidence)).toBe(
      "Unmatched: Битва Легенд, Том Второй",
    );
  });

  test("a candidate the winner starts with replaces it", () => {
    const shopIndex = buildShopTitleIndex(["Azul: Летний дворец. Mini"]);
    expect(pickRussianTitle(["Azul: Летний дворец", "Azul: Летний дворец. Mini"], { linkedTitles: [], shopIndex })).toBe("Azul: Летний дворец");
  });

  test("otherwise the longest name", () => {
    expect(pickRussianTitle(["Сучасне мистецтво", "Современное искусство"], noEvidence)).toBe("Современное искусство");
    expect(pickRussianTitle(russianCandidates(["Kinfire: Предания – Чертоги тщеславия", "Kinfire. Сходження: Грот Марнославства"]), noEvidence)).toBe(
      "Kinfire: Предания – Чертоги тщеславия",
    );
  });

  test("is null without candidates", () => {
    expect(pickRussianTitle([], noEvidence)).toBeNull();
  });
});
