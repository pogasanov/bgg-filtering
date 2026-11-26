import { sql } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import { createTestDb, migrateTestDb, rows } from "./helpers/test-db";

describe("database migrations", () => {
  test("drizzle migrations create every table and apply only once", async () => {
    const { db, close } = await createTestDb();
    try {
      const tables = await rows<{ table_name: string }>(
        db,
        sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
      );
      expect(tables.map((table) => table.table_name)).toEqual([
        "game_languages",
        "game_tags",
        "games",
        "player_recommendations",
        "price_checks",
        "price_history",
        "price_runs",
        "product_links",
        "ranked_games",
        "shop_products",
        "sync_lock",
        "sync_runs",
      ]);

      await migrateTestDb(db);
      const [{ count }] = await rows<{ count: number }>(
        db,
        sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
      );
      expect(count).toBe(5);
    } finally {
      await close();
    }
  });
});
