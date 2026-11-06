-- (marchlands) Distance now goes the shorter way round the map (tileDistance, docs/deviations.md): armies marching when
-- this came in were timed the long way. Each march is shortened in the ratio of the two distances, which keeps the speed
-- it set off with, and one already out longer than that lands now. An army set to land at a chosen second keeps it: one
-- still waiting to leave, in a wave plan, or landing on a whole second, as only a chosen landing time does.
WITH "clock" AS (
  SELECT (extract(epoch FROM now()) * 1000)::bigint AS "now"
), "marching" AS (
  SELECT a."id", a."start_time", a."reach_time",
    sqrt(power(a."start_tile_id" % 800 - a."target_tile_id" % 800, 2) + power(a."start_tile_id" / 800 - a."target_tile_id" / 800, 2)) AS "straight",
    sqrt(
      power(least(abs(a."start_tile_id" % 800 - a."target_tile_id" % 800), 800 - abs(a."start_tile_id" % 800 - a."target_tile_id" % 800)), 2) +
      power(least(abs(a."start_tile_id" / 800 - a."target_tile_id" / 800), 800 - abs(a."start_tile_id" / 800 - a."target_tile_id" / 800)), 2)
    ) AS "wrapped"
  FROM "armies" a, "clock" c
  WHERE a."direction" IN (1, 2) AND a."start_time" <= c."now" AND a."reach_time" > c."now" AND a."reach_time" % 1000 <> 0
    AND NOT EXISTS (SELECT 1 FROM "war_plan_waves" w WHERE w."army_id" = a."id")
), "fixed" AS (
  SELECT m."id", greatest(c."now", m."start_time" + round((m."reach_time" - m."start_time") * m."wrapped" / m."straight")::bigint) AS "reach"
  FROM "marching" m, "clock" c
  WHERE m."wrapped" < m."straight"
), "moved" AS (
  UPDATE "armies" a SET "reach_time" = f."reach" FROM "fixed" f WHERE a."id" = f."id" RETURNING a."id"
)
UPDATE "timed_events" e SET "due_at" = f."reach"
FROM "fixed" f
WHERE e."ref_key" = 'army:' || f."id" AND e."type" = 'army';
