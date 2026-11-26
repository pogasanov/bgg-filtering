import { attachDatabasePool } from "@vercel/functions";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "./schema";

/** A Drizzle database over any Postgres driver: node-postgres in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Rows of a raw `db.execute(sql\`…\`)` result; node-postgres and PGlite both return `{ rows }`. */
export function resultRows<T>(result: unknown): T[] {
  return (result as { rows: T[] }).rows;
}

/**
 * A pool that survives idle-client errors (pooler restarts, dropped connections) instead of
 * crashing the process, and gives up on a connection attempt after 10 s instead of hanging.
 */
export function createPool(connectionString: string, max: number): Pool {
  const created = new Pool({ connectionString, max, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10_000 });
  created.on("error", (error) => {
    console.error("Postgres pool error", error);
  });
  return created;
}

export function createDb(pool: Pool): Db {
  return drizzle(pool, { schema }) as unknown as Db;
}

let pool: Pool | undefined;
let db: Db | undefined;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * The app's database: node-postgres over Neon's pooled connection string. On Vercel Fluid compute
 * the pool is attached so idle clients are released before a function instance is suspended.
 */
export function getDb(): Db {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = createPool(connectionString, 3);
    attachDatabasePool(pool);
    db = createDb(pool);
  }
  return db;
}

export async function closeDb(): Promise<void> {
  const current = pool;
  pool = undefined;
  db = undefined;
  await current?.end();
}
