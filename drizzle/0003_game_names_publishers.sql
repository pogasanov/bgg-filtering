ALTER TABLE "games" ADD COLUMN "alternate_names" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "publisher_ids" integer[] DEFAULT '{}' NOT NULL;