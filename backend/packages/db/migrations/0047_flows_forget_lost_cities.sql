-- (marchlands) A city a player lost goes from their flows (dropCityFromFlows): take off the ones lost before that did.
-- Only cities no longer the player's go; a flow left with none stays, and won't run until one is chosen.
CREATE OR REPLACE FUNCTION pg_temp.own_cities(list jsonb, player int) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(jsonb_agg(e.value ORDER BY e.ordinality), '[]'::jsonb)
  FROM jsonb_array_elements(list) WITH ORDINALITY AS e
  WHERE EXISTS (SELECT 1 FROM "cities" c WHERE c."id" = e.value::text::int AND c."player_id" = player)
$$;--> statement-breakpoint
UPDATE "flows" f SET
  "cities" = CASE WHEN jsonb_typeof(f."cities") = 'array' THEN pg_temp.own_cities(f."cities", f."player_id") ELSE f."cities" END,
  "city_override" = CASE WHEN jsonb_typeof(f."city_override") = 'array' THEN pg_temp.own_cities(f."city_override", f."player_id") ELSE f."city_override" END,
  "run_cities" = pg_temp.own_cities(f."run_cities", f."player_id"),
  "army_ids" = coalesce(
    (SELECT jsonb_object_agg(a.key, a.value) FROM jsonb_each(f."army_ids") AS a
     WHERE EXISTS (SELECT 1 FROM "cities" c WHERE c."id" = a.key::int AND c."player_id" = f."player_id")),
    '{}'::jsonb);
