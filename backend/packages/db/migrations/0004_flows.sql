CREATE TABLE "flows" (
	"id" text PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"name" text NOT NULL,
	"actions" jsonb NOT NULL,
	"cities" jsonb DEFAULT '"all"'::jsonb NOT NULL,
	"repeat" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"next_action" integer DEFAULT 0 NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"run_cities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"city_override" jsonb,
	"army_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"queued_at" bigint DEFAULT 0 NOT NULL,
	"not_before" bigint DEFAULT 0 NOT NULL,
	"wait_until" bigint DEFAULT 0 NOT NULL,
	"run_started_at" bigint DEFAULT 0 NOT NULL,
	"stop_reason" text,
	"last_run" jsonb,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flows" ADD CONSTRAINT "flows_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "flows_player_idx" ON "flows" USING btree ("player_id","created_at");--> statement-breakpoint
-- (evony-re) flows move from players.misc.flows into their own table, keeping their order
INSERT INTO "flows" ("id", "player_id", "name", "actions", "cities", "created_at")
SELECT f->>'id', p."id", f->>'name', f->'actions', COALESCE(f->'cities', '"all"'::jsonb), (EXTRACT(EPOCH FROM now()) * 1000)::bigint + t.ord
FROM "players" p, jsonb_array_elements(p."misc"->'flows') WITH ORDINALITY AS t(f, ord)
WHERE jsonb_typeof(p."misc"->'flows') = 'array'
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE "players" SET "misc" = "misc" - 'flows' WHERE "misc" ? 'flows';
