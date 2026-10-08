-- (evony-re) the Merchant Fleet item (consume.transaction.1) is removed from the game: drop it from
-- every lord's items, along with any MerchantFleetBuff still running and its expiry event
UPDATE "players" SET "items" = "items" - 'consume.transaction.1' WHERE "items" ? 'consume.transaction.1';--> statement-breakpoint
UPDATE "players" SET "buffs" = COALESCE((SELECT jsonb_agg(b) FROM jsonb_array_elements("buffs") AS b WHERE b->>'id' <> 'MerchantFleetBuff'), '[]'::jsonb)
WHERE "buffs" @> '[{"id": "MerchantFleetBuff"}]'::jsonb;--> statement-breakpoint
DELETE FROM "timed_events" WHERE "type" = 'buff.expire' AND "payload"->>'buffId' = 'MerchantFleetBuff';
