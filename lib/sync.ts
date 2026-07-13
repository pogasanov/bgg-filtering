import { fetchGameDetails, fetchTopRankItems } from "@/lib/bgg/client";
import { createCacheStore } from "@/lib/cache/store";

export async function syncBggCache(limit = 500) {
  const token = process.env.BGG_TOKEN;
  if (!token) {
    throw new Error("BGG_TOKEN is not set. Add it to .env.local before syncing.");
  }

  const store = createCacheStore();
  const syncStart = store.tryStartSync();
  if (!syncStart.started) {
    store.close();
    return { started: false, fetchedCount: 0 };
  }

  try {
    const ranks = await fetchTopRankItems(limit);
    store.insertRankSnapshot("boardgamegeek:browse:boardgame", ranks.rawPayload);
    const details = await fetchGameDetails(
      ranks.items.map((item) => item.id),
      token,
    );
    const rankedById = new Map(ranks.items.map((item) => [item.id, item]));
    const mergedGames = details.games.map((game) => {
      const rank = rankedById.get(game.id);
      return {
        ...game,
        rank: rank?.rank ?? game.rank,
        geekRating: rank?.geekRating ?? game.geekRating,
        averageRating: rank?.averageRating ?? game.averageRating,
        numVoters: rank?.numVoters ?? game.numVoters,
      };
    });

    store.upsertGames(mergedGames, details.rawXmlByGameId);
    store.finishSync(syncStart.syncRunId, "success", mergedGames.length);
    return { started: true, fetchedCount: mergedGames.length };
  } catch (error) {
    store.finishSync(syncStart.syncRunId, "error", 0, error instanceof Error ? error.message : String(error));
    throw error;
  } finally {
    store.close();
  }
}
