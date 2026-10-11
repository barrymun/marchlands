-- (marchlands) Messages and the API send shares, not percents: the client shows a share (0.25) as a percent in the
-- player's language. Stored buff messages (player and hero buffs, battle report bonuses, queued pushes) held
-- their percent as a number ("percent": 25); it becomes a share param.
CREATE FUNCTION pg_temp.shares(j jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE out jsonb;
BEGIN
  CASE jsonb_typeof(j)
    WHEN 'array' THEN
      SELECT coalesce(jsonb_agg(pg_temp.shares(e) ORDER BY i), '[]'::jsonb) INTO out FROM jsonb_array_elements(j) WITH ORDINALITY AS t(e, i);
      RETURN out;
    WHEN 'object' THEN
      SELECT coalesce(jsonb_object_agg(key, pg_temp.shares(value)), '{}'::jsonb) INTO out FROM jsonb_each(j);
      IF out->>'code' LIKE 'buff.%' AND jsonb_typeof(out->'params'->'percent') = 'number' THEN
        out := jsonb_set(out, '{params,percent}', jsonb_build_object('share', (out->'params'->>'percent')::float8 / 100));
      END IF;
      RETURN out;
    ELSE
      RETURN j;
  END CASE;
END $$;--> statement-breakpoint
UPDATE "players" SET "buffs" = pg_temp.shares("buffs") WHERE "buffs"::text LIKE '%"buff.%';--> statement-breakpoint
UPDATE "heroes" SET "buffs" = pg_temp.shares("buffs") WHERE "buffs"::text LIKE '%"buff.%';--> statement-breakpoint
UPDATE "reports" SET "body" = pg_temp.shares("body") WHERE "body"::text LIKE '%"buff.%';--> statement-breakpoint
UPDATE "push_messages" SET "data" = pg_temp.shares("data") WHERE "data"::text LIKE '%"buff.%';--> statement-breakpoint
-- the cached zone statistics held a settled percent (rate); the next read recomputes them with a settled share
DELETE FROM "world_state" WHERE "key" = 'zones';
