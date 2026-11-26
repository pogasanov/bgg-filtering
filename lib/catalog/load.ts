import { unstable_cache } from "next/cache";
import { getDb, hasDatabaseUrl } from "@/lib/db/client";
import { getCatalog } from "./store";
import { EMPTY_CATALOG, type Catalog } from "./types";

export const CATALOG_TAG = "bgg-catalog";

const cachedCatalog = unstable_cache(async () => getCatalog(getDb()), ["bgg-catalog"], {
  tags: [CATALOG_TAG],
  revalidate: 86400,
});

/**
 * The catalog shown on the site. Reads go through the Next.js data cache, so a page view
 * never queries the database; the sync worker invalidates CATALOG_TAG after each run.
 * Without DATABASE_URL a local build renders an empty catalog; on Vercel that is a misconfiguration.
 */
export async function loadCatalog(): Promise<Catalog> {
  if (!hasDatabaseUrl()) {
    if (process.env.VERCEL === "1") throw new Error("DATABASE_URL is not set");
    return EMPTY_CATALOG;
  }
  return cachedCatalog();
}
