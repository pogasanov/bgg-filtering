import { importRanks } from "@/lib/bgg/import-ranks";
import { DEFAULT_RANKED_LIMIT } from "@/lib/bgg/ranks";
import { closeDb, getDb } from "@/lib/db/client";

const USAGE = `Usage: pnpm bgg:import-ranks <boardgames_ranks.csv> [--limit N] (default ${DEFAULT_RANKED_LIMIT})`;

function parseArgs(argv: string[]): { csvPath: string; limit: number } | null {
  const [csvPath, ...rest] = argv;
  if (!csvPath || csvPath.startsWith("--")) return null;
  let limit = DEFAULT_RANKED_LIMIT;
  if (rest.length > 0) {
    if (rest.length !== 2 || rest[0] !== "--limit") return null;
    limit = Number(rest[1]);
    if (!Number.isInteger(limit) || limit < 1) return null;
  }
  return { csvPath, limit };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.error(USAGE);
    process.exit(1);
  }
  try {
    const result = await importRanks(getDb(), args.csvPath, args.limit, new Date());
    console.log(`Imported ${result.ranked} ranked games, removed ${result.removedGames} games.`);
  } finally {
    await closeDb();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
