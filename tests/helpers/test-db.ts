import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { Db } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

function transactionDb(tx: Transaction): Db {
  const db: Db = {
    async query<T>(text: string, params?: unknown[]) {
      return (await tx.query<T>(text, params)).rows;
    },
    async exec(sql: string) {
      await tx.exec(sql);
    },
    transaction: (fn) => fn(db),
  };
  return db;
}

/** An in-memory Postgres (PGlite) with every migration applied. */
export async function createTestDb(): Promise<{ db: Db; close(): Promise<void> }> {
  const pglite = await PGlite.create();
  const db: Db = {
    async query<T>(text: string, params?: unknown[]) {
      return (await pglite.query<T>(text, params)).rows;
    },
    async exec(sql: string) {
      await pglite.exec(sql);
    },
    transaction: (fn) => pglite.transaction((tx) => fn(transactionDb(tx))),
  };
  await runMigrations(db);
  return { db, close: () => pglite.close() };
}
