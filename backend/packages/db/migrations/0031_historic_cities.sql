-- (marchlands) Historic cities (docs/features/historical-cities.md) on a world that already exists: Atlantis (level
-- 18) at (0, 0), a capital (16) in the middle of each state, level 14s every 66 tiles from 33 and level 12s every 18
-- from 9 across the 800 x 800 map, as shared/core/src/historic.ts historicLevelAt places them. Whatever stood there
-- (flat land, a valley, a barbarian city) is replaced. Where a player's city or a held valley or city stands on the
-- place, the seat goes on the nearest tile (within 5) that holds neither. A new world gets them from ensureWorld.
CREATE OR REPLACE FUNCTION pg_temp.historic_level(x int, y int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN x = 0 AND y = 0 THEN 18
    WHEN x % 200 = 100 AND y % 200 = 100 THEN 16
    WHEN x >= 33 AND (x - 33) % 66 = 0 AND y >= 33 AND (y - 33) % 66 = 0
      AND NOT (((x - 33) / 66) % 3 = 1 AND ((y - 33) / 66) % 3 = 1) THEN 14
    WHEN x >= 9 AND (x - 9) % 18 = 0 AND y >= 9 AND (y - 9) % 18 = 0 THEN 12
  END
$$;
--> statement-breakpoint
DO $$
DECLARE
  r record;
  target int;
BEGIN
  FOR r IN
    SELECT "id", pg_temp.historic_level("id" % 800, "id" / 800) AS "lvl" FROM "tiles"
    WHERE pg_temp.historic_level("id" % 800, "id" / 800) IS NOT NULL ORDER BY "id"
  LOOP
    target := r."id";
    IF EXISTS (SELECT 1 FROM "tiles" WHERE "id" = r."id" AND ("city_id" IS NOT NULL OR "owner_city_id" IS NOT NULL)) THEN
      SELECT t."id" INTO target FROM "tiles" t
      WHERE t."city_id" IS NULL AND t."owner_city_id" IS NULL AND t."type" <> 13
        AND abs(t."id" % 800 - r."id" % 800) <= 5 AND abs(t."id" / 800 - r."id" / 800) <= 5
      ORDER BY greatest(abs(t."id" % 800 - r."id" % 800), abs(t."id" / 800 - r."id" / 800)), t."id"
      LIMIT 1;
    END IF;
    IF target IS NOT NULL THEN
      UPDATE "tiles" SET "type" = 13, "level" = r."lvl", "troops" = NULL, "forts" = NULL, "state" = NULL
      WHERE "id" = target;
    END IF;
  END LOOP;
END $$;
