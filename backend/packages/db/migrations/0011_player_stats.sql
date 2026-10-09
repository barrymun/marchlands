-- (marchlands) lord statistics (game stats.ts): counters per lord, city and day or month
CREATE TABLE "player_stats" (
	"player_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"period" text NOT NULL,
	"counters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "player_stats_player_id_city_id_period_pk" PRIMARY KEY("player_id","city_id","period")
);
--> statement-breakpoint
ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- (marchlands) adds two counter maps key by key (stats batches merge into player_stats with it)
CREATE OR REPLACE FUNCTION stats_add(a jsonb, b jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  FROM (
    SELECT k, sum(v) AS v
    FROM (
      SELECT key AS k, value::numeric AS v FROM jsonb_each_text(a)
      UNION ALL
      SELECT key, value::numeric FROM jsonb_each_text(b)
    ) kv
    GROUP BY k
  ) sums
$$;
--> statement-breakpoint
-- when counting began (migration 0012 restarted it)
INSERT INTO "world_state" ("key", "value", "updated_at")
VALUES ('statsStartedAt', jsonb_build_object('at', (extract(epoch FROM now()) * 1000)::bigint), (extract(epoch FROM now()) * 1000)::bigint)
ON CONFLICT ("key") DO NOTHING;
