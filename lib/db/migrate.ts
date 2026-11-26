import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createPool } from "./client";
import * as schema from "./schema";

export const MIGRATIONS_FOLDER = "drizzle";

/**
 * Applies the Drizzle migrations in ./drizzle that have not run yet. Neon recommends the direct
 * (non-pooled) connection for schema changes, so DATABASE_URL_UNPOOLED wins when it is set.
 */
export async function runMigrations(
  connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
): Promise<void> {
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");
  const pool = createPool(connectionString, 1);
  try {
    await migrate(drizzle(pool, { schema }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}
