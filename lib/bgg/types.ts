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
  year: number | null;
  description: string;
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

export type MatrixSelection = {
  playerCount: PlayerCount;
  verdict: MatrixVerdict;
};

export type SortKey = "rank" | "geekRating" | "averageRating" | "year";
