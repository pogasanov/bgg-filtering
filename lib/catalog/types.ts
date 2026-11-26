export type CatalogStatus = {
  gameCount: number;
  /** ISO timestamp of the latest successful or partial sync run. */
  updatedAt: string | null;
};

export type SyncRunResult = {
  status: "success" | "partial" | "error";
  fetchedCount: number;
  failedIds: number[];
  errorMessage: string | null;
};
