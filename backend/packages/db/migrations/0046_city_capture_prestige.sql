ALTER TABLE "cities" ADD COLUMN "capture_prestige" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "captured_at" bigint DEFAULT 0 NOT NULL;