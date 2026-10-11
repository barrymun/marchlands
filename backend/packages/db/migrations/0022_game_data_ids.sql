-- (marchlands) Game data names are no longer stored as English: the client names troops, buildings, tiles, ranks …
-- by id in the player's language. Positions become messages, and a few stored labels become ids.
CREATE OR REPLACE FUNCTION pg_temp.legacy(t text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_build_object('code', 'common.legacyText', 'params', jsonb_build_object('text', t))
$$;--> statement-breakpoint
-- a position as stored text: "Hill Lv.3 (12,34)", "Land Lv.2 (…)", "Flat (…)", or "<city name> (x,y)"
CREATE OR REPLACE FUNCTION pg_temp.pos(t text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m text[];
BEGIN
  IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
  m := regexp_match(t, '^(Forest|Desert|Hill|Swamp|Grass|Lake|Barbarian''s City|Land) Lv\.(\d+) \((\d+),(\d+)\)$');
  IF m IS NOT NULL THEN
    RETURN jsonb_build_object('code', 'world.position.tile', 'params', jsonb_build_object(
      'tile', jsonb_build_object('ref', 'tile', 'id',
        CASE m[1] WHEN 'Forest' THEN 1 WHEN 'Desert' THEN 2 WHEN 'Hill' THEN 3 WHEN 'Swamp' THEN 4 WHEN 'Grass' THEN 5
          WHEN 'Lake' THEN 6 WHEN 'Barbarian''s City' THEN 12 ELSE 11 END),
      'level', m[2]::int, 'x', m[3]::int, 'y', m[4]::int));
  END IF;
  m := regexp_match(t, '^Flat \((\d+),(\d+)\)$');
  IF m IS NOT NULL THEN
    RETURN jsonb_build_object('code', 'world.position.place', 'params', jsonb_build_object(
      'tile', jsonb_build_object('ref', 'tile', 'id', 10), 'x', m[1]::int, 'y', m[2]::int));
  END IF;
  m := regexp_match(t, '^(.*) \((\d+),(\d+)\)$');
  IF m IS NOT NULL THEN
    RETURN jsonb_build_object('code', 'world.position.city', 'params', jsonb_build_object('name', m[1], 'x', m[2]::int, 'y', m[3]::int));
  END IF;
  RETURN pg_temp.legacy(t);
END $$;--> statement-breakpoint
ALTER TABLE "armies" ALTER COLUMN "start_pos_name" SET DATA TYPE jsonb USING coalesce(pg_temp.pos("start_pos_name"), pg_temp.legacy(''));--> statement-breakpoint
ALTER TABLE "armies" ALTER COLUMN "target_pos_name" SET DATA TYPE jsonb USING coalesce(pg_temp.pos("target_pos_name"), pg_temp.legacy(''));--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "start_pos" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "start_pos" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "start_pos" SET DATA TYPE jsonb USING pg_temp.pos("start_pos");--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "target_pos" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "target_pos" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "reports" ALTER COLUMN "target_pos" SET DATA TYPE jsonb USING pg_temp.pos("target_pos");--> statement-breakpoint

-- a battle's defender name: barbarian cities and a valley's own defenders are named by the client now
UPDATE "reports" SET "body" = jsonb_set("body", '{battle,defender,player}', '""')
  WHERE "body" ->> 'kind' = 'battle' AND "body" #>> '{battle,defender,player}' IN ('Barbarian''s City', 'Valley defenders');--> statement-breakpoint

-- bookmarks keep the tile type; a barbarian city has no name of its own
UPDATE "players" SET "castle_signs" = (
  SELECT coalesce(jsonb_agg(
    CASE WHEN s ->> 'name' = 'Barbarian''s City' THEN (s - 'name') || '{"type":12}' ELSE s || '{"type":11}' END ORDER BY i), '[]')
  FROM jsonb_array_elements("castle_signs") WITH ORDINALITY AS e(s, i))
  WHERE jsonb_typeof("castle_signs") = 'array' AND jsonb_array_length("castle_signs") > 0;--> statement-breakpoint

-- alliance events: rank names are references now
UPDATE "alliance_events" SET "message" = jsonb_set("message", '{params,rank}', jsonb_build_object('ref', 'rank', 'id',
    CASE "message" #>> '{params,rank,code}' WHEN 'alliance.rank.host' THEN 4 WHEN 'alliance.rank.viceHost' THEN 5
      WHEN 'alliance.rank.presbyter' THEN 6 WHEN 'alliance.rank.officer' THEN 7 ELSE 8 END))
  WHERE "message" #>> '{params,rank,code}' LIKE 'alliance.rank.%';--> statement-breakpoint

-- system mail has no sender name; the client labels it
UPDATE "mails" SET "other_player_name" = '' WHERE "other_player_name" = 'System' AND "other_player_id" IS NULL;
