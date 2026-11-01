CREATE TABLE "war_plan_waves" (
	"id" serial PRIMARY KEY NOT NULL,
	"plan_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"hero_id" integer,
	"mission" smallint NOT NULL,
	"troops" jsonb NOT NULL,
	"position" smallint NOT NULL,
	"army_id" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "war_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"alliance_id" integer,
	"name" text NOT NULL,
	"target_tile_id" integer NOT NULL,
	"land_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "war_plan_waves" ADD CONSTRAINT "war_plan_waves_plan_id_war_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."war_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_plan_waves" ADD CONSTRAINT "war_plan_waves_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_plan_waves" ADD CONSTRAINT "war_plan_waves_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "war_plans" ADD CONSTRAINT "war_plans_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "war_plan_waves_plan_idx" ON "war_plan_waves" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "war_plans_player_idx" ON "war_plans" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "war_plans_alliance_idx" ON "war_plans" USING btree ("alliance_id");