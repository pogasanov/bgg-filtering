import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { Db } from "./client";

export async function runMigrations(db: Db, dir = "db/migrations"): Promise<string[]> {
  await db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );

  const directory = resolve(dir);
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  const applied = new Set(
    (await db.query<{ name: string }>("SELECT name FROM schema_migrations")).map((row) => row.name),
  );

  const appliedNow: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(join(directory, file), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
    });
    appliedNow.push(file);
  }

  return appliedNow;
}
