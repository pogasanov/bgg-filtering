import { PGlite } from "@electric-sql/pglite";
import type { SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { resultRows, type Db } from "@/lib/db/client";
import { MIGRATIONS_FOLDER } from "@/lib/db/migrate";
import * as schema from "@/lib/db/schema";

/** Applies the same Drizzle migrations the production database gets. */
export async function migrateTestDb(db: Db): Promise<void> {
  await migrate(db as unknown as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
}

/** An in-memory Postgres (PGlite) with every migration applied. */
export async function createTestDb(): Promise<{ db: Db; close(): Promise<void> }> {
  const pglite = await PGlite.create();
  const db = drizzle(pglite, { schema }) as unknown as Db;
  await migrateTestDb(db);
  return { db, close: () => pglite.close() };
}

/** Raw SQL rows, for assertions on tables the store does not expose. */
export async function rows<T>(db: Db, query: SQL): Promise<T[]> {
  return resultRows<T>(await db.execute(query));
}
