-- (marchlands) restart lord statistics: drop everything counted so far (including what was backfilled from
-- reports, which made battle counters cover a longer span than the rest) and count from now on
DELETE FROM "player_stats";--> statement-breakpoint
DELETE FROM "world_state" WHERE "key" = 'statsBackfilled';--> statement-breakpoint
UPDATE "world_state" SET "value" = jsonb_build_object('at', (extract(epoch FROM now()) * 1000)::bigint), "updated_at" = (extract(epoch FROM now()) * 1000)::bigint
WHERE "key" = 'statsStartedAt';
