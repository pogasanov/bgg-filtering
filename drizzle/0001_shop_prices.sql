CREATE TABLE "price_checks" (
	"shop" text NOT NULL,
	"external_id" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "price_checks_shop_external_id_pk" PRIMARY KEY("shop","external_id")
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"shop" text NOT NULL,
	"external_id" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"price" integer,
	"old_price" integer,
	"available" boolean,
	CONSTRAINT "price_history_shop_external_id_observed_at_pk" PRIMARY KEY("shop","external_id","observed_at")
);
--> statement-breakpoint
CREATE TABLE "price_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"products_seen" integer DEFAULT 0 NOT NULL,
	"prices_changed" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "product_links" (
	"bgg_id" integer NOT NULL,
	"shop" text NOT NULL,
	"external_id" text NOT NULL,
	"status" text NOT NULL,
	"reason" text NOT NULL,
	"decided_by" text NOT NULL,
	"decided_at" timestamp with time zone NOT NULL,
	CONSTRAINT "product_links_bgg_id_shop_external_id_pk" PRIMARY KEY("bgg_id","shop","external_id"),
	CONSTRAINT "product_links_status_check" CHECK ("product_links"."status" IN ('candidate', 'confirmed', 'rejected')),
	CONSTRAINT "product_links_decided_by_check" CHECK ("product_links"."decided_by" IN ('auto', 'owner'))
);
--> statement-breakpoint
CREATE TABLE "shop_products" (
	"shop" text NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"vendor" text,
	"barcode" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "shop_products_shop_external_id_pk" PRIMARY KEY("shop","external_id"),
	CONSTRAINT "shop_products_shop_check" CHECK ("shop_products"."shop" IN ('crowdgames', 'lavkaigr', 'gaga'))
);
--> statement-breakpoint
ALTER TABLE "price_checks" ADD CONSTRAINT "price_checks_shop_external_id_shop_products_shop_external_id_fk" FOREIGN KEY ("shop","external_id") REFERENCES "public"."shop_products"("shop","external_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_shop_external_id_shop_products_shop_external_id_fk" FOREIGN KEY ("shop","external_id") REFERENCES "public"."shop_products"("shop","external_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_shop_external_id_shop_products_shop_external_id_fk" FOREIGN KEY ("shop","external_id") REFERENCES "public"."shop_products"("shop","external_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_price_runs_shop_finished" ON "price_runs" USING btree ("shop","finished_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_product_links_confirmed" ON "product_links" USING btree ("bgg_id","shop") WHERE "product_links"."status" = 'confirmed';--> statement-breakpoint
CREATE INDEX "idx_product_links_status" ON "product_links" USING btree ("status");