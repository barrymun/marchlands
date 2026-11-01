ALTER TABLE "cities" ADD COLUMN "historic_level" smallint;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "truce_until" bigint DEFAULT 0 NOT NULL;