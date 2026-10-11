-- (marchlands) tiles now reference their city and player (released on delete). Release tiles whose city or
-- player no longer exists first, or the constraints cannot be added: a castle goes back to flat land (10), a
-- valley or captured city loses its owner.
UPDATE "tiles" SET "type" = 10, "city_id" = NULL, "owner_player_id" = NULL WHERE "city_id" IS NOT NULL AND "city_id" NOT IN (SELECT "id" FROM "cities");--> statement-breakpoint
UPDATE "tiles" SET "owner_city_id" = NULL, "owner_player_id" = NULL, "troops" = NULL, "state" = NULL WHERE "owner_city_id" IS NOT NULL AND "owner_city_id" NOT IN (SELECT "id" FROM "cities");--> statement-breakpoint
UPDATE "tiles" SET "owner_player_id" = NULL WHERE "owner_player_id" IS NOT NULL AND "owner_player_id" NOT IN (SELECT "id" FROM "players");--> statement-breakpoint
ALTER TABLE "tiles" ADD CONSTRAINT "tiles_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiles" ADD CONSTRAINT "tiles_owner_city_id_cities_id_fk" FOREIGN KEY ("owner_city_id") REFERENCES "public"."cities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tiles" ADD CONSTRAINT "tiles_owner_player_id_players_id_fk" FOREIGN KEY ("owner_player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tiles_city_idx" ON "tiles" USING btree ("city_id") WHERE "tiles"."city_id" is not null;--> statement-breakpoint
CREATE INDEX "tiles_owner_player_idx" ON "tiles" USING btree ("owner_player_id") WHERE "tiles"."owner_player_id" is not null;