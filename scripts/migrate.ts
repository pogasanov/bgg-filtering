import { runMigrations } from "@/lib/db/migrate";

runMigrations()
  .then(() => console.log("Migrations are up to date."))
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
