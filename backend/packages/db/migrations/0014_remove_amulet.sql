-- (marchlands) no gambling: the Amulet (every player.box.gambling.* copy and prize) and the prizes only it gave,
-- hero helms (a random hero) and troop battalions, are removed from the game (core REMOVED_ITEMS); drop them
-- from lords' items. The daily gift is now a fixed bundle of resources (BALANCE.dailyGift).
UPDATE "players" SET "items" = "items"
  - ARRAY['player.box.hero.a', 'player.box.hero.b', 'player.box.hero.c', 'player.box.hero.d', 'player.box.troop.a', 'player.box.troop.b', 'player.box.troop.c', 'player.box.troop.d']
  - coalesce((SELECT array_agg(k) FROM jsonb_object_keys("items") AS k WHERE k LIKE 'player.box.gambling.%'), ARRAY[]::text[])
WHERE "items" ?| ARRAY['player.box.hero.a', 'player.box.hero.b', 'player.box.hero.c', 'player.box.hero.d', 'player.box.troop.a', 'player.box.troop.b', 'player.box.troop.c', 'player.box.troop.d']
   OR EXISTS (SELECT 1 FROM jsonb_object_keys("items") AS k WHERE k LIKE 'player.box.gambling.%');
