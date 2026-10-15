-- (marchlands) Disbanding troops and destroying fortifications refunds part of their training cost, up to the
-- player's refund credit (players.misc.refundCredit), which finished training adds to. Units players own already
-- were trained before the credit existed: each starts with one unit of credit (its full cost), wherever it is (in
-- a city, injured, or away in an army). Training still queued adds its credit when it completes.
WITH "units" AS (
  SELECT c."player_id", e."key", e."value"::numeric AS "n" FROM "cities" c, jsonb_each_text(c."troops") e WHERE c."player_id" IS NOT NULL
  UNION ALL
  SELECT c."player_id", e."key", e."value"::numeric FROM "cities" c, jsonb_each_text(c."injured_troops") e WHERE c."player_id" IS NOT NULL
  UNION ALL
  SELECT c."player_id", e."key", e."value"::numeric FROM "cities" c, jsonb_each_text(c."forts") e WHERE c."player_id" IS NOT NULL
  UNION ALL
  SELECT a."player_id", e."key", e."value"::numeric FROM "armies" a, jsonb_each_text(a."troops") e
), "credit" AS (
  SELECT "player_id", jsonb_object_agg("key", "total") AS "credit"
  FROM (SELECT "player_id", "key", sum("n") AS "total" FROM "units" GROUP BY "player_id", "key" HAVING sum("n") > 0) s
  GROUP BY "player_id"
)
UPDATE "players" p SET "misc" = p."misc" || jsonb_build_object('refundCredit', "credit"."credit") FROM "credit" WHERE "credit"."player_id" = p."id";
