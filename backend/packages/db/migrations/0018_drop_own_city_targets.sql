-- (marchlands) a barbarian city captured by a lord is now taken off every flow's attack targets as it is
-- captured. This removes the ones captured before: targets that are a city of the flow's own lord.
UPDATE "flows" f SET "actions" = (
  SELECT jsonb_agg(
    CASE WHEN a->>'type' = 'attackTargets' THEN jsonb_set(a, '{targets}', COALESCE((
      SELECT jsonb_object_agg(k, COALESCE((
        SELECT jsonb_agg(t ORDER BY i) FROM jsonb_array_elements(v) WITH ORDINALITY AS e(t, i)
        WHERE (t #>> '{}')::int NOT IN (SELECT "tile_id" FROM "cities" WHERE "player_id" = f."player_id")
      ), '[]'::jsonb))
      FROM jsonb_each(a->'targets') AS x(k, v)
    ), '{}'::jsonb))
    ELSE a END ORDER BY n)
  FROM jsonb_array_elements(f."actions") WITH ORDINALITY AS y(a, n)
)
WHERE EXISTS (
  SELECT 1 FROM "cities" c
  WHERE c."player_id" = f."player_id"
    AND jsonb_path_exists(f."actions", '$[*] ? (@.type == "attackTargets").targets.*[*] ? (@ == $t)', jsonb_build_object('t', c."tile_id"))
);
