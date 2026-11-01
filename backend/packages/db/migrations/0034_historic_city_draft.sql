ALTER TABLE "cities" ADD COLUMN "draft_auto" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "draft_day" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cities" ADD COLUMN "drafts_used" smallint DEFAULT 0 NOT NULL;