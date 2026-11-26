import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import type { ListedGame } from "@/lib/bgg/types";

/** 2–4 players; poll votes exist for 1 (out of range) and 2 only. */
export const pollGame: ListedGame = {
  id: 5, rank: 5, title: "Poll Game", titleRu: "Опросная игра", year: 2019, thumbnailUrl: null,
  geekRating: 8, averageRating: 8.1, numVoters: 500, minPlayers: 2, maxPlayers: 4, playingTime: 90, weight: 3.2,
  categories: ["Economic"], mechanics: ["Worker Placement"], languages: [],
  playerRecommendations: {
    ...emptyPlayerRecommendations(),
    "1": { best: 0, recommended: 6, notRecommended: 4, verdict: "recommended" },
    "2": { best: 10, recommended: 4, notRecommended: 0, verdict: "best" },
  },
  bggUrl: "https://boardgamegeek.com/boardgame/5",
  offers: [],
  bestPrice: null,
};
