import { afterEach, describe, expect, test, vi } from "vitest";
import { loadFrame, loadGameCount, loadGamesView } from "@/lib/catalog/load";
import { emptyCatalogFrame, emptyGamesView } from "@/lib/games-view";
import { defaultFilters } from "@/lib/url-state";

afterEach(() => vi.unstubAllEnvs());

describe("catalog loaders", () => {
  test("return an empty catalog locally without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");

    expect(await loadGamesView(defaultFilters, 1)).toEqual(emptyGamesView());
    expect(await loadFrame()).toEqual(emptyCatalogFrame());
    expect(await loadGameCount()).toBe(0);
  });

  test("throw on Vercel without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "1");

    await expect(loadGamesView(defaultFilters, 1)).rejects.toThrow("DATABASE_URL is not set");
    await expect(loadFrame()).rejects.toThrow("DATABASE_URL is not set");
  });
});
