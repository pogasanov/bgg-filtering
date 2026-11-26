import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));

import { loadCatalog } from "@/lib/catalog/load";
import { EMPTY_CATALOG } from "@/lib/catalog/types";

afterEach(() => vi.unstubAllEnvs());

describe("loadCatalog", () => {
  test("returns an empty catalog locally without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "");

    expect(await loadCatalog()).toEqual(EMPTY_CATALOG);
  });

  test("throws on Vercel without DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("VERCEL", "1");

    await expect(loadCatalog()).rejects.toThrow("DATABASE_URL is not set");
  });
});
