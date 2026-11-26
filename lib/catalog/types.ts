import type { ListedGame } from "@/lib/bgg/types";

export type CatalogStatus = {
  gameCount: number;
  /** ISO timestamp of the latest successful or partial sync run. */
  updatedAt: string | null;
};

export type Catalog = {
  games: ListedGame[];
  status: CatalogStatus;
};

export type SyncRunResult = {
  status: "success" | "partial" | "error";
  fetchedCount: number;
  failedIds: number[];
  errorMessage: string | null;
};

export const EMPTY_CATALOG: Catalog = {
  games: [],
  status: { gameCount: 0, updatedAt: null },
};
