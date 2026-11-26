import { closeDb, getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

async function main() {
  try {
    const applied = await runMigrations(getDb());
    console.log(applied.length > 0 ? `Applied: ${applied.join(", ")}` : "No pending migrations.");
  } finally {
    await closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
