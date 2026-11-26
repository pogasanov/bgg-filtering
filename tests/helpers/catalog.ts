import { sql } from "drizzle-orm";
import type { NormalizedGame } from "@/lib/bgg/types";
import { replaceRankedGames, upsertGames } from "@/lib/catalog/store";
import type { Db } from "@/lib/db/client";

const NOW = new Date("2026-11-30T03:00:00.000Z");

/** Stores exactly these games as the ranked catalog, in place of whatever the database held. */
export async function storeCatalog(db: Db, games: NormalizedGame[]): Promise<void> {
  await db.execute(sql`delete from ranked_games`);
  await db.execute(sql`delete from games`);
  await replaceRankedGames(
    db,
    games.map((game, index) => ({
      id: game.id,
      rank: game.rank ?? 1000 + index,
      title: game.title,
      year: game.year,
      geekRating: game.geekRating,
      averageRating: game.averageRating,
      numVoters: game.numVoters,
    })),
    NOW,
  );
  await upsertGames(db, games, NOW);
}
