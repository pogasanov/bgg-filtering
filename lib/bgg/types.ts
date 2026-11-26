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

/** A game as the page shows it. Descriptions are never parsed or stored, so it is the full game. */
export type ListedGame = NormalizedGame;

export type MatrixSelection = {
  playerCount: PlayerCount;
  verdict: MatrixVerdict;
};

export const sortKeys = ["rank", "year", "playingTime", "weight", "geekRating", "averageRating", "numVoters"] as const;
export type SortKey = (typeof sortKeys)[number];
export type SortDir = "asc" | "desc";
