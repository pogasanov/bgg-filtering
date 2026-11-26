CREATE TABLE "game_languages" (
	"game_id" integer NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "game_languages_game_id_name_pk" PRIMARY KEY("game_id","name")
);
--> statement-breakpoint
CREATE TABLE "game_tags" (
	"game_id" integer NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "game_tags_game_id_kind_name_pk" PRIMARY KEY("game_id","kind","name"),
	CONSTRAINT "game_tags_kind_check" CHECK ("game_tags"."kind" IN ('category', 'mechanic'))
);
--> statement-breakpoint
CREATE TABLE "games" (
	"bgg_id" integer PRIMARY KEY NOT NULL,
	"rank" integer,
	"title" text NOT NULL,
	"year" integer,
	"geek_rating" double precision,
	"average_rating" double precision,
	"num_voters" integer,
	"min_players" integer,
	"max_players" integer,
	"playing_time" integer,
	"weight" double precision,
	"bgg_url" text NOT NULL,
	"thumbnail_url" text,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_recommendations" (
	"game_id" integer NOT NULL,
	"player_count" text NOT NULL,
	"best_votes" integer NOT NULL,
	"recommended_votes" integer NOT NULL,
	"not_recommended_votes" integer NOT NULL,
	"verdict" text NOT NULL,
	CONSTRAINT "player_recommendations_game_id_player_count_pk" PRIMARY KEY("game_id","player_count")
);
--> statement-breakpoint
CREATE TABLE "ranked_games" (
	"bgg_id" integer PRIMARY KEY NOT NULL,
	"rank" integer NOT NULL,
	"title" text NOT NULL,
	"year" integer,
	"geek_rating" double precision,
	"average_rating" double precision,
	"num_voters" integer,
	"imported_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_lock" (
	"id" integer PRIMARY KEY NOT NULL,
	"sync_run_id" integer NOT NULL,
	"locked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sync_lock_singleton_check" CHECK ("sync_lock"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"failed_ids" integer[] DEFAULT '{}' NOT NULL,
	"error_message" text,
	CONSTRAINT "sync_runs_status_check" CHECK ("sync_runs"."status" IN ('running', 'success', 'partial', 'error'))
);
--> statement-breakpoint
ALTER TABLE "game_languages" ADD CONSTRAINT "game_languages_game_id_games_bgg_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("bgg_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_tags" ADD CONSTRAINT "game_tags_game_id_games_bgg_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("bgg_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_recommendations" ADD CONSTRAINT "player_recommendations_game_id_games_bgg_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("bgg_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_lock" ADD CONSTRAINT "sync_lock_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_game_languages_name" ON "game_languages" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_game_tags_name" ON "game_tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_games_rank" ON "games" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "idx_player_recommendations_lookup" ON "player_recommendations" USING btree ("player_count","verdict");--> statement-breakpoint
CREATE INDEX "idx_ranked_games_rank" ON "ranked_games" USING btree ("rank");