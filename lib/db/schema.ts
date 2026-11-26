import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
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

const SHOPS = sql`('crowdgames', 'lavkaigr', 'gaga')`;

/** Every product a tracked shop lists, whether or not it has been linked to a game. */
export const shopProducts = pgTable(
  "shop_products",
  {
    shop: text("shop").$type<"crowdgames" | "lavkaigr" | "gaga">().notNull(),
    /** The shop's own product ID. */
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    vendor: text("vendor"),
    barcode: text("barcode"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shop, table.externalId] }),
    check("shop_products_shop_check", sql`${table.shop} IN ${SHOPS}`),
  ],
);

/**
 * A link between a game and a shop product. Only a confirmed link puts a price on the site.
 * `bgg_id` deliberately has no foreign key: a game that drops out of the ranked list keeps
 * its links, the owner's rejections and its price history for when it comes back.
 */
export const productLinks = pgTable(
  "product_links",
  {
    bggId: integer("bgg_id").notNull(),
    shop: text("shop").$type<"crowdgames" | "lavkaigr" | "gaga">().notNull(),
    externalId: text("external_id").notNull(),
    status: text("status").$type<"candidate" | "confirmed" | "rejected">().notNull(),
    /** Why the matcher proposed it. */
    reason: text("reason").notNull(),
    decidedBy: text("decided_by").$type<"auto" | "owner">().notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.bggId, table.shop, table.externalId] }),
    foreignKey({
      columns: [table.shop, table.externalId],
      foreignColumns: [shopProducts.shop, shopProducts.externalId],
    }).onDelete("cascade"),
    check("product_links_status_check", sql`${table.status} IN ('candidate', 'confirmed', 'rejected')`),
    check("product_links_decided_by_check", sql`${table.decidedBy} IN ('auto', 'owner')`),
    // One product per game per shop.
    uniqueIndex("uq_product_links_confirmed")
      .on(table.bggId, table.shop)
      .where(sql`${table.status} = 'confirmed'`),
    index("idx_product_links_status").on(table.status),
  ],
);

/**
 * What a linked product cost and whether it was in stock. A row is written only when
 * something changed; `price_checks` records that an unchanged product was still looked at.
 */
export const priceHistory = pgTable(
  "price_history",
  {
    shop: text("shop").$type<"crowdgames" | "lavkaigr" | "gaga">().notNull(),
    externalId: text("external_id").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    /** Whole rubles. */
    price: integer("price"),
    /** The shop's own crossed-out price. */
    oldPrice: integer("old_price"),
    available: boolean("available"),
  },
  (table) => [
    primaryKey({ columns: [table.shop, table.externalId, table.observedAt] }),
    foreignKey({
      columns: [table.shop, table.externalId],
      foreignColumns: [shopProducts.shop, shopProducts.externalId],
    }).onDelete("cascade"),
  ],
);

/** When each linked product was last read successfully, changed or not. */
export const priceChecks = pgTable(
  "price_checks",
  {
    shop: text("shop").$type<"crowdgames" | "lavkaigr" | "gaga">().notNull(),
    externalId: text("external_id").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.shop, table.externalId] }),
    foreignKey({
      columns: [table.shop, table.externalId],
      foreignColumns: [shopProducts.shop, shopProducts.externalId],
    }).onDelete("cascade"),
  ],
);

/** One row per shop per collection run. */
export const priceRuns = pgTable(
  "price_runs",
  {
    id: serial("id").primaryKey(),
    shop: text("shop").$type<"crowdgames" | "lavkaigr" | "gaga">().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    productsSeen: integer("products_seen").notNull().default(0),
    pricesChanged: integer("prices_changed").notNull().default(0),
    errorMessage: text("error_message"),
  },
  (table) => [index("idx_price_runs_shop_finished").on(table.shop, table.finishedAt)],
);

