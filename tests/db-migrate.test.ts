import { describe, expect, test } from "vitest";
import { runMigrations } from "@/lib/db/migrate";
import { createTestDb } from "./helpers/test-db";

describe("database migrations", () => {
  test("applies the init migration once and creates every table", async () => {
    const { db, close } = await createTestDb();
    try {
      const tables = await db.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' order by 1",
      );
      expect(tables.map((table) => table.table_name)).toEqual([
        "game_languages",
        "game_tags",
        "games",
        "player_recommendations",
        "ranked_games",
        "schema_migrations",
        "sync_lock",
        "sync_runs",
      ]);
      expect(await runMigrations(db)).toEqual([]);
    } finally {
      await close();
    }
  });
});
