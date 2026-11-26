import { Pool, type PoolClient } from "pg";

export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs one or more statements without parameters. */
  exec(sql: string): Promise<void>;
  /** Runs `fn` in a transaction. A nested call runs `fn` inside the current transaction. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

function clientDb(client: PoolClient): Db {
  const db: Db = {
    async query<T>(text: string, params?: unknown[]) {
      const result = await client.query(text, params);
      return result.rows as T[];
    },
    async exec(sql: string) {
      await client.query(sql);
    },
    transaction: (fn) => fn(db),
  };
  return db;
}

export function createPgDb(pool: Pool): Db {
  return {
    async query<T>(text: string, params?: unknown[]) {
      const result = await pool.query(text, params);
      return result.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(clientDb(client));
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

let pool: Pool | undefined;
let db: Db | undefined;

export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb(): Db {
  if (!db) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 5000 });
    db = createPgDb(pool);
  }
  return db;
}

export async function closeDb(): Promise<void> {
  const current = pool;
  pool = undefined;
  db = undefined;
  await current?.end();
}
