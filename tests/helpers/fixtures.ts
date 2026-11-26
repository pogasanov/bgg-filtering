import { vi } from "vitest";
import { emptyPlayerRecommendations } from "@/lib/bgg/parser";
import type { NormalizedGame, TopRankItem } from "@/lib/bgg/types";
import type { SyncLog } from "@/lib/sync";

export function makeGame(id: number, overrides: Partial<NormalizedGame> = {}): NormalizedGame {
  return {
    id,
    rank: id,
    title: `Game ${id}`,
    titleRu: null,
    year: 2020,
    thumbnailUrl: null,
    geekRating: 7.5,
    averageRating: 8,
    numVoters: 100,
    minPlayers: 1,
    maxPlayers: 4,
    playingTime: 60,
    weight: 2,
    categories: ["Strategy"],
    mechanics: ["Hand Management"],
    languages: ["English"],
    playerRecommendations: emptyPlayerRecommendations(),
    bggUrl: `https://boardgamegeek.com/boardgame/${id}`,
    ...overrides,
  };
}

export function makeRanked(id: number, overrides: Partial<TopRankItem> = {}): TopRankItem {
  return {
    id,
    rank: id,
    title: `Game ${id}`,
    year: 2020,
    geekRating: 7,
    averageRating: 7.9,
    numVoters: 90,
    ...overrides,
  };
}

export function spyLog() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies SyncLog;
}
