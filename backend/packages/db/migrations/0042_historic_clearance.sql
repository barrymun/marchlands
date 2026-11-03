-- (marchlands) The historic cities as the live map had them (docs/reference/historic-cities-level-12-names.md, How
-- many there were; shared/core/src/historic.ts historicLevelAt): Romagna's last two level 14 places, (693, 759) and
-- (759, 759), stand empty, and no level 12 stands within 9 tiles of a bigger historic city (1,795 level 12s, not
-- 1,936). Only unheld historic tiles (type 13) change, so a held seat is left as it is. Each becomes free flat land,
-- level 1. The bigger cities are read from the tiles themselves and from held seats, as migration 0031 may have moved
-- one off its grid place.
UPDATE "tiles" SET "type" = 10, "level" = 1, "troops" = NULL, "forts" = NULL, "state" = NULL
WHERE "type" = 13 AND "id" IN (759 * 800 + 693, 759 * 800 + 759);
--> statement-breakpoint
WITH "big" AS (
  SELECT "id" % 800 AS "x", "id" / 800 AS "y" FROM "tiles" WHERE "type" = 13 AND "level" > 12
  UNION ALL
  SELECT t."id" % 800, t."id" / 800 FROM "cities" c JOIN "tiles" t ON t."id" = c."tile_id" WHERE c."historic_level" > 12
)
UPDATE "tiles" t SET "type" = 10, "level" = 1, "troops" = NULL, "forts" = NULL, "state" = NULL
WHERE t."type" = 13 AND t."level" = 12
  AND EXISTS (SELECT 1 FROM "big" b WHERE (b."x" - t."id" % 800) ^ 2 + (b."y" - t."id" / 800) ^ 2 <= 81);
