-- Players' heroes can't be taken prisoner any more (docs/deviations.md). Any held now go home idle, as a release sent them:
-- to the city they came from if it's still their owner's, otherwise to the owner's oldest city; the worker puts their gear
-- back on when it starts (heroGearJob). A hero whose owner has no city left has nowhere to go and is gone, as a release did.
WITH prisoner AS (
  SELECT h.id, coalesce(
    (SELECT c.id FROM cities c, jsonb_array_elements(h.buffs) b
      WHERE b->>'id' = 'homeCity' AND (b->>'param')::int = c.id AND c.player_id = h.player_id LIMIT 1),
    (SELECT c.id FROM cities c WHERE c.player_id = h.player_id ORDER BY c.id LIMIT 1)
  ) AS home
  FROM heroes h
  WHERE h.status = 4 OR h.captured_by_player_id IS NOT NULL
)
UPDATE heroes h
SET city_id = p.home,
    status = 0,
    loyalty = 70,
    captured_by_player_id = NULL,
    buffs = (SELECT coalesce(jsonb_agg(b), '[]'::jsonb) FROM jsonb_array_elements(h.buffs) b WHERE b->>'id' <> 'homeCity')
FROM prisoner p
WHERE p.id = h.id AND p.home IS NOT NULL;--> statement-breakpoint
DELETE FROM heroes WHERE status = 4 OR captured_by_player_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "heroes" DROP COLUMN "captured_by_player_id";
