ALTER TABLE "cities" ADD COLUMN "loyalty" smallint DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "loyalty_at" bigint DEFAULT 0 NOT NULL;