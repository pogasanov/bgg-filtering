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
