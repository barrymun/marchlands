-- (marchlands) Wall space per fortification is now trap 1, abatis 2, archer tower 3, rolling log 4, trebuchet 5 (was
-- 1, 1, 2, 3, 4; BALANCE.fortSpace). A player city whose built and queued fortifications no longer fit its walls
-- (BALANCE.wallSpace by Walls level) has built ones taken down until they fit, every type in the same proportion
-- (rounded down), with their full training cost returned to the city. Queued ones are kept and count as space used.
-- Refunding the full cost uses up the player's refund credit for the units taken down (players.misc.refundCredit,
-- see 0024), and the player is sent a system mail for each city.
CREATE TEMP TABLE "fort_refund" ("city_id" int, "player_id" int, "key" text, "n" numeric, "food" numeric, "wood" numeric, "stone" numeric, "iron" numeric);--> statement-breakpoint
WITH "fort" ("key", "id", "space", "food", "wood", "stone", "iron") AS (
  VALUES ('trap', 14, 1, 50, 500, 100, 50), ('abatis', 15, 2, 100, 1200, 0, 150), ('arrowTower', 16, 3, 200, 2000, 1000, 500),
    ('rollingLogs', 17, 4, 300, 6000, 0, 0), ('rockfall', 18, 5, 600, 0, 8000, 0)
), "space" AS (
  SELECT c."id", c."player_id",
    (ARRAY[0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000])[
      least(10, coalesce((SELECT max((b->>'level')::int) FROM jsonb_array_elements(c."buildings") b WHERE (b->>'typeId')::int = 32), 0)) + 1
    ] AS "cap",
    coalesce((SELECT sum((q->>'count')::numeric * f."space") FROM jsonb_array_elements(c."fort_queue"->'queue') q JOIN "fort" f ON f."id" = (q->>'troopId')::int), 0) AS "queued",
    coalesce((SELECT sum(e."value"::numeric * f."space") FROM jsonb_each_text(c."forts") e JOIN "fort" f ON f."key" = e."key"), 0) AS "built"
  FROM "cities" c WHERE c."player_id" IS NOT NULL
), "over" AS (
  SELECT "id", "player_id", greatest("cap" - "queued", 0) AS "room", "built" FROM "space" WHERE "built" > 0 AND "built" + "queued" > "cap"
), "removed" AS (
  SELECT o."id", o."player_id", f."key", f."food", f."wood", f."stone", f."iron", e."value"::numeric - floor(e."value"::numeric * o."room" / o."built") AS "n"
  FROM "over" o JOIN "cities" c ON c."id" = o."id" CROSS JOIN LATERAL jsonb_each_text(c."forts") e JOIN "fort" f ON f."key" = e."key"
)
INSERT INTO "fort_refund" SELECT "id", "player_id", "key", "n", "n" * "food", "n" * "wood", "n" * "stone", "n" * "iron" FROM "removed" WHERE "n" > 0;--> statement-breakpoint
UPDATE "cities" c SET
  "forts" = c."forts" || r."forts",
  "food" = c."food" + r."food", "wood" = c."wood" + r."wood", "stone" = c."stone" + r."stone", "iron" = c."iron" + r."iron"
FROM (
  SELECT f."city_id", jsonb_object_agg(f."key", (c2."forts"->>f."key")::numeric - f."n") AS "forts",
    sum(f."food") AS "food", sum(f."wood") AS "wood", sum(f."stone") AS "stone", sum(f."iron") AS "iron"
  FROM "fort_refund" f JOIN "cities" c2 ON c2."id" = f."city_id" GROUP BY f."city_id"
) r WHERE c."id" = r."city_id";--> statement-breakpoint
UPDATE "players" p SET "misc" = jsonb_set(p."misc", '{refundCredit}', (
  SELECT coalesce(jsonb_object_agg(e."key", e."value"::numeric - coalesce(u."n", 0)) FILTER (WHERE e."value"::numeric - coalesce(u."n", 0) > 0), '{}'::jsonb)
  FROM jsonb_each_text(p."misc"->'refundCredit') e
  LEFT JOIN (SELECT "key", sum("n") AS "n" FROM "fort_refund" WHERE "player_id" = p."id" GROUP BY "key") u ON u."key" = e."key"
))
WHERE p."misc" ? 'refundCredit' AND EXISTS (SELECT 1 FROM "fort_refund" f WHERE f."player_id" = p."id");--> statement-breakpoint
INSERT INTO "mails" ("player_id", "type", "title", "content", "system", "sent_at")
SELECT f."player_id", 2, '', '',
  jsonb_build_object(
    'title', jsonb_build_object('code', 'training.mail.wallSpaceRefund.title'),
    'content', jsonb_build_object('code', 'training.mail.wallSpaceRefund.content', 'params', jsonb_build_object('city', c."name", 'count', sum(f."n")))
  ),
  (extract(epoch FROM now()) * 1000)::bigint
FROM "fort_refund" f JOIN "cities" c ON c."id" = f."city_id" GROUP BY f."player_id", f."city_id", c."name";--> statement-breakpoint
DROP TABLE "fort_refund";
