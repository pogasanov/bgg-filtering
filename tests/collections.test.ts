import { describe, expect, test } from "vitest";
import {
  collectionPath,
  mechanicCollectionFilters,
  mechanicCollectionPath,
  mechanicFromSlug,
  mechanicSlug,
  playerCollectionFilters,
  playerCollectionPath,
  playerCollections,
  playerCountFromSlug,
} from "@/lib/collections";
import { playerCounts } from "@/lib/bgg/types";
import { mechanicNamesRu } from "@/lib/i18n/mechanics";
import { slugify } from "@/lib/translit";
import { defaultFilters } from "@/lib/url-state";

describe("transliteration", () => {
  test("turns Russian and accented Latin names into address segments", () => {
    expect(slugify("Крылья")).toBe("krylya");
    expect(slugify("Дюна: Империя – Восстание")).toBe("dyuna-imperiya-vosstanie");
    expect(slugify("Ёжик в тумане")).toBe("ezhik-v-tumane");
    expect(slugify("Pokémon: Café")).toBe("pokemon-cafe");
    expect(slugify("7 Wonders Duel")).toBe("7-wonders-duel");
    expect(slugify("三国")).toBe("");
  });
});

describe("collections", () => {
  test("every poll column has a 'best with N' collection, found back from its address", () => {
    expect(playerCollections.map((collection) => collection.playerCount)).toEqual([...playerCounts]);
    expect(playerCollectionPath("2")).toBe("/na-dvoih");
    expect(playerCountFromSlug("na-bolshuyu-kompaniyu")).toBe("6+");
    expect(playerCountFromSlug("en")).toBeNull();
  });

  test("mechanic addresses read in Russian, are unique and lead back to the mechanic", () => {
    expect(mechanicSlug("Worker Placement")).toBe("razmeshchenie-rabochih");
    expect(mechanicCollectionPath("Cooperative Game")).toBe("/mehaniki/kooperativ");
    const names = Object.keys(mechanicNamesRu);
    expect(new Set(names.map(mechanicSlug)).size).toBe(names.length);
    expect(mechanicFromSlug("kooperativ", names)).toBe("Cooperative Game");
    expect(mechanicFromSlug("nothing-like-it", names)).toBeNull();
  });

  test("a view that is exactly one collection has its address; anything more does not", () => {
    expect(collectionPath(playerCollectionFilters("3"), 1)).toBe("/na-troih");
    expect(collectionPath({ ...playerCollectionFilters("3"), sort: "year" }, 1)).toBe("/na-troih");
    expect(collectionPath(mechanicCollectionFilters("Cooperative Game"), 1)).toBe("/mehaniki/kooperativ");
    expect(collectionPath(playerCollectionFilters("3"), 2)).toBeNull();
    expect(collectionPath({ ...playerCollectionFilters("3"), language: "English" }, 1)).toBeNull();
    expect(collectionPath({ ...playerCollectionFilters("3"), tags: ["Economic"] }, 1)).toBeNull();
    expect(collectionPath({ ...defaultFilters, matrix: [{ playerCount: "3", verdict: "recommended" }] }, 1)).toBeNull();
    expect(collectionPath({ ...playerCollectionFilters("3"), minYear: 2010 }, 1)).toBeNull();
    expect(collectionPath(defaultFilters, 1)).toBeNull();
  });
});
