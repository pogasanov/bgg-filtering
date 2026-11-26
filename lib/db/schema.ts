import { sql } from "drizzle-orm";
import {
  check,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** The imported top-N list. The weekly sync refreshes details for exactly these games. */
export const rankedGames = pgTable(
  "ranked_games",
  {
    bggId: integer("bgg_id").primaryKey(),
    rank: integer("rank").notNull(),
    title: text("title").notNull(),
    year: integer("year"),
    geekRating: doublePrecision("geek_rating"),
    averageRating: doublePrecision("average_rating"),
    numVoters: integer("num_voters"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_ranked_games_rank").on(table.rank)],
);

export const games = pgTable(
  "games",
  {
    bggId: integer("bgg_id").primaryKey(),
    rank: integer("rank"),
    title: text("title").notNull(),
    year: integer("year"),
    geekRating: doublePrecision("geek_rating"),
    averageRating: doublePrecision("average_rating"),
    numVoters: integer("num_voters"),
    minPlayers: integer("min_players"),
    maxPlayers: integer("max_players"),
    playingTime: integer("playing_time"),
    weight: doublePrecision("weight"),
    bggUrl: text("bgg_url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("idx_games_rank").on(table.rank)],
);

export const gameTags = pgTable(
  "game_tags",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.bggId, { onDelete: "cascade" }),
    kind: text("kind").$type<"category" | "mechanic">().notNull(),
    name: text("name").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.kind, table.name] }),
    check("game_tags_kind_check", sql`${table.kind} IN ('category', 'mechanic')`),
    index("idx_game_tags_name").on(table.name),
  ],
);

export const gameLanguages = pgTable(
  "game_languages",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.bggId, { onDelete: "cascade" }),
    name: text("name").notNull(),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.name] }), index("idx_game_languages_name").on(table.name)],
);

export const playerRecommendations = pgTable(
  "player_recommendations",
  {
    gameId: integer("game_id")
      .notNull()
      .references(() => games.bggId, { onDelete: "cascade" }),
    playerCount: text("player_count").notNull(),
    bestVotes: integer("best_votes").notNull(),
    recommendedVotes: integer("recommended_votes").notNull(),
    notRecommendedVotes: integer("not_recommended_votes").notNull(),
    verdict: text("verdict").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.playerCount] }),
    index("idx_player_recommendations_lookup").on(table.playerCount, table.verdict),
  ],
);

export const syncRuns = pgTable(
  "sync_runs",
  {
    id: serial("id").primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    status: text("status").$type<"running" | "success" | "partial" | "error">().notNull(),
    fetchedCount: integer("fetched_count").notNull().default(0),
    failedIds: integer("failed_ids").array().notNull().default(sql`'{}'`),
    errorMessage: text("error_message"),
  },
  (table) => [check("sync_runs_status_check", sql`${table.status} IN ('running', 'success', 'partial', 'error')`)],
);

/** At most one row: the run that currently holds the sync lock. */
export const syncLock = pgTable(
  "sync_lock",
  {
    id: integer("id").primaryKey(),
    syncRunId: integer("sync_run_id")
      .notNull()
      .references(() => syncRuns.id, { onDelete: "cascade" }),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull(),
  },
  (table) => [check("sync_lock_singleton_check", sql`${table.id} = 1`)],
);
