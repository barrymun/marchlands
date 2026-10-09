-- (marchlands) free lord actions and no loyalty for lords' cities:
-- renaming (once a day) and changing the flag are free, the Inn is re-rolled for gold, demolishing is instant,
-- level-10 buildings need no Michelangelo's Script, there are no chat icons or alliance member-limit items, and
-- lords' cities have no loyalty or grievance (barbarian cities keep theirs). The City Teleporter picks the tile,
-- so Adv City Teleporters become City Teleporters. Items for all of these are removed (core REMOVED_ITEMS).
ALTER TABLE "alliances" DROP COLUMN "pact_until";--> statement-breakpoint
ALTER TABLE "cities" DROP COLUMN "loyalty";--> statement-breakpoint
ALTER TABLE "cities" DROP COLUMN "grievance";
--> statement-breakpoint
UPDATE "players" SET "items" = jsonb_set("items" - 'player.more.castle.1.a', '{consume.move.1}',
  to_jsonb(coalesce(("items"->>'consume.move.1')::int, 0) + ("items"->>'player.more.castle.1.a')::int))
WHERE "items" ? 'player.more.castle.1.a';--> statement-breakpoint
UPDATE "players" SET "items" = "items" - ARRAY['player.name.1.a', 'consume.changeflag.1', 'consume.refreshtavern.1', 'player.destroy.1.a', 'consume.blueprint.1', 'player.speak.bronze_publicity_ambassador.permanent', 'player.speak.bronze_publicity_ambassador.permanent.15', 'player.speak.silver_publicity_ambassador.15', 'player.speak.silver_publicity_ambassador.permanent', 'player.speak.gold_publicity_ambassador.15', 'player.speak.gold_publicity_ambassador.permanent', 'consume.hegemony.1', 'alliance.ritual_of_pact.advanced', 'alliance.ritual_of_pact.premium', 'alliance.ritual_of_pact.ultimate', 'player.heart.1.a', 'hero.reset.1.a']
WHERE "items" ?| ARRAY['player.name.1.a', 'consume.changeflag.1', 'consume.refreshtavern.1', 'player.destroy.1.a', 'consume.blueprint.1', 'player.speak.bronze_publicity_ambassador.permanent', 'player.speak.bronze_publicity_ambassador.permanent.15', 'player.speak.silver_publicity_ambassador.15', 'player.speak.silver_publicity_ambassador.permanent', 'player.speak.gold_publicity_ambassador.15', 'player.speak.gold_publicity_ambassador.permanent', 'consume.hegemony.1', 'alliance.ritual_of_pact.advanced', 'alliance.ritual_of_pact.premium', 'alliance.ritual_of_pact.ultimate', 'player.heart.1.a', 'hero.reset.1.a'];--> statement-breakpoint
UPDATE "players" SET "buffs" = coalesce((SELECT jsonb_agg(b) FROM jsonb_array_elements("buffs") b WHERE b->>'id' <> 'ChatIconBuff'), '[]'::jsonb),
  "misc" = "misc" - 'icon'
WHERE "buffs" @> '[{"id": "ChatIconBuff"}]' OR "misc" ? 'icon';--> statement-breakpoint
UPDATE "cities" SET "misc" = "misc" - 'loyaltyTickAt' WHERE "misc" ? 'loyaltyTickAt';
