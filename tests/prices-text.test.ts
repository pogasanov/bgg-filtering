import { describe, expect, it } from "vitest";
import { normalizeTitle, parseRubles } from "@/lib/prices/text";

describe("normalizeTitle", () => {
  it("normalizes case, ё, quotes, punctuation and whitespace", () => {
    expect(normalizeTitle("  «Крылья»:  Птицы Океании ")).toBe("крылья птицы океании");
    expect(normalizeTitle("Ёжики")).toBe("ежики");
    expect(normalizeTitle("Apiary (Апиарий)")).toBe("apiary апиарий");
    expect(normalizeTitle("Brass. Бирмингем")).toBe("brass бирмингем");
    expect(normalizeTitle("7 Wonders – Duel!")).toBe("7 wonders duel");
  });
});

describe("parseRubles", () => {
  it("reads whole rubles and rejects everything else", () => {
    expect(parseRubles("2 790 руб.")).toBe(2790);
    expect(parseRubles("2 790 ₽")).toBe(2790);
    expect(parseRubles("1190.0")).toBe(1190);
    expect(parseRubles(990)).toBe(990);
    expect(parseRubles("от 990 руб.")).toBeNull();
    expect(parseRubles("0")).toBeNull();
    expect(parseRubles("")).toBeNull();
    expect(parseRubles(null)).toBeNull();
    expect(parseRubles("1190.50")).toBeNull();
  });
});

describe("parseRubles — review fixes", () => {
  it("refuses thousands written with a dot or comma, which could be read as one ruble", () => {
    expect(parseRubles("1.000")).toBeNull();
    expect(parseRubles("1,000")).toBeNull();
    expect(parseRubles("2.000 руб.")).toBeNull();
  });

  it("refuses two numbers run together", () => {
    expect(parseRubles("3 990 2 990")).toBeNull();
    expect(parseRubles("4 990 3 990 руб.")).toBeNull();
    expect(parseRubles("12 34")).toBeNull();
  });

  it("still reads grouped and plain amounts", () => {
    expect(parseRubles("16 990 руб.")).toBe(16990);
    expect(parseRubles("1 234 567")).toBe(1234567);
    expect(parseRubles("990,00 ₽")).toBe(990);
  });
});
