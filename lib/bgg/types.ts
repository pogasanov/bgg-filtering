import type { GameOffer } from "@/lib/prices/offers";

export const playerCounts = ["1", "2", "3", "4", "5", "6", "6+"] as const;
export const verdicts = ["best", "recommended", "not-recommended"] as const;
export const matrixVerdicts = [...verdicts, "not-playable"] as const;

export type PlayerCount = (typeof playerCounts)[number];
export type RecommendationVerdict = (typeof verdicts)[number] | "unknown";
export type MatrixVerdict = (typeof matrixVerdicts)[number];

export type PlayerRecommendation = {
  best: number;
  recommended: number;
  notRecommended: number;
  verdict: RecommendationVerdict;
};

export type PlayerRecommendations = Record<PlayerCount, PlayerRecommendation>;

export type TopRankItem = {
  id: number;
  rank: number;
  title: string;
  year: number | null;
  geekRating: number | null;
  averageRating: number | null;
  numVoters: number | null;
};

export type NormalizedGame = {
  id: number;
  rank: number | null;
  title: string;
  /** BGG's alternate names that may be Russian; the Russian title is chosen among them. */
  ruNames: string[];
  year: number | null;
  thumbnailUrl: string | null;
  geekRating: number | null;
  averageRating: number | null;
  numVoters: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
  weight: number | null;
  categories: string[];
  mechanics: string[];
  languages: string[];
  playerRecommendations: PlayerRecommendations;
  bggUrl: string;
};

/** A game as the page shows it: what BGG says about it plus what the tracked shops ask for it today. */
export type ListedGame = Omit<NormalizedGame, "ruNames"> & {
  /** The Russian title, or `null` when none is known. */
  titleRu: string | null;
  /** Offers from confirmed shop links, in `shopCodes` order. */
  offers: GameOffer[];
  /** The lowest price that can be paid today: in stock and recently checked. The "price" sort value. */
  bestPrice: number | null;
};

export type MatrixSelection = {
  playerCount: PlayerCount;
  verdict: MatrixVerdict;
};

export const sortKeys = ["rank", "year", "playingTime", "weight", "geekRating", "averageRating", "numVoters", "price"] as const;
export type SortKey = (typeof sortKeys)[number];
export type SortDir = "asc" | "desc";
