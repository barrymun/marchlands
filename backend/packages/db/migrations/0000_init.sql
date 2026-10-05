CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"ban_reason" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"last_login_at" bigint DEFAULT 0 NOT NULL,
	"last_login_ip" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliance_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"alliance_id" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliance_relations" (
	"alliance_id" integer NOT NULL,
	"target_alliance_id" integer NOT NULL,
	"relation" smallint NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "alliance_relations_alliance_id_target_alliance_id_pk" PRIMARY KEY("alliance_id","target_alliance_id")
);
--> statement-breakpoint
CREATE TABLE "alliance_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"alliance_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"kind" text NOT NULL,
	"invited_by_name" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliances" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"founder_name" text NOT NULL,
	"leader_player_id" integer,
	"note" text DEFAULT '' NOT NULL,
	"intro" text DEFAULT '' NOT NULL,
	"motd" text DEFAULT '' NOT NULL,
	"max_members" integer DEFAULT 500 NOT NULL,
	"pact_until" bigint DEFAULT 0 NOT NULL,
	"war_cooldown_until" bigint DEFAULT 0 NOT NULL,
	"prestige" double precision DEFAULT 0 NOT NULL,
	"honor" double precision DEFAULT 0 NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"city_count" integer DEFAULT 0 NOT NULL,
	"prestige_rank" integer DEFAULT 0 NOT NULL,
	"honor_rank" integer DEFAULT 0 NOT NULL,
	"members_rank" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "armies" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"hero_id" integer,
	"mission" smallint NOT NULL,
	"direction" smallint NOT NULL,
	"start_tile_id" integer NOT NULL,
	"target_tile_id" integer NOT NULL,
	"target_player_id" integer,
	"troops" jsonb NOT NULL,
	"resources" jsonb NOT NULL,
	"start_time" bigint NOT NULL,
	"reach_time" bigint NOT NULL,
	"rest_time" bigint DEFAULT 0 NOT NULL,
	"start_pos_name" text NOT NULL,
	"target_pos_name" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"alliance_id" integer,
	"from_player_id" integer,
	"from_name" text NOT NULL,
	"to_player_id" integer,
	"message" text NOT NULL,
	"sent_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"tile_id" integer NOT NULL,
	"name" text NOT NULL,
	"logo_url" text DEFAULT 'images/icon/cityLogo/citylogo_01.png' NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"allow_alliance" boolean DEFAULT false NOT NULL,
	"go_out_for_battle" boolean DEFAULT true NOT NULL,
	"gold" double precision DEFAULT 0 NOT NULL,
	"food" double precision DEFAULT 0 NOT NULL,
	"wood" double precision DEFAULT 0 NOT NULL,
	"stone" double precision DEFAULT 0 NOT NULL,
	"iron" double precision DEFAULT 0 NOT NULL,
	"resources_at" bigint NOT NULL,
	"population" double precision DEFAULT 0 NOT NULL,
	"loyalty" double precision DEFAULT 100 NOT NULL,
	"grievance" double precision DEFAULT 0 NOT NULL,
	"tax_rate" smallint DEFAULT 10 NOT NULL,
	"buildings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"troops" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"injured_troops" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"forts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"troop_queues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fort_queue" jsonb DEFAULT '{"nextQueueId":1,"queue":[]}'::jsonb NOT NULL,
	"work_rates" jsonb DEFAULT '{"gold":100,"food":100,"wood":100,"stone":100,"iron":100}'::jsonb NOT NULL,
	"store_percent" jsonb DEFAULT '{"gold":0,"food":25,"wood":25,"stone":25,"iron":25}'::jsonb NOT NULL,
	"misc" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heroes" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer,
	"city_id" integer NOT NULL,
	"in_tavern" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"logo_url" text NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"experience" double precision DEFAULT 0 NOT NULL,
	"upgrade_exp" double precision DEFAULT 100 NOT NULL,
	"loyalty" integer DEFAULT 70 NOT NULL,
	"base_power" integer NOT NULL,
	"base_management" integer NOT NULL,
	"base_stratagem" integer NOT NULL,
	"power" integer NOT NULL,
	"management" integer NOT NULL,
	"stratagem" integer NOT NULL,
	"power_added" integer DEFAULT 0 NOT NULL,
	"management_added" integer DEFAULT 0 NOT NULL,
	"stratagem_added" integer DEFAULT 0 NOT NULL,
	"power_buff_added" integer DEFAULT 0 NOT NULL,
	"management_buff_added" integer DEFAULT 0 NOT NULL,
	"stratagem_buff_added" integer DEFAULT 0 NOT NULL,
	"remain_point" integer DEFAULT 0 NOT NULL,
	"buffs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"captured_by_player_id" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mails" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"type" smallint NOT NULL,
	"other_player_id" integer,
	"other_player_name" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"sent_at" bigint NOT NULL,
	"read_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"res_type" smallint NOT NULL,
	"side" smallint NOT NULL,
	"price" double precision NOT NULL,
	"amount" bigint NOT NULL,
	"filled" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"city_id" integer NOT NULL,
	"order_id" integer,
	"res_type" smallint NOT NULL,
	"amount" bigint NOT NULL,
	"price" double precision NOT NULL,
	"start_time" bigint NOT NULL,
	"end_time" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_relations" (
	"player_id" integer NOT NULL,
	"other_player_id" integer NOT NULL,
	"kind" text NOT NULL,
	"created_at" bigint NOT NULL,
	CONSTRAINT "player_relations_player_id_other_player_id_kind_pk" PRIMARY KEY("player_id","other_player_id","kind")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"name" text NOT NULL,
	"sex" smallint DEFAULT 0 NOT NULL,
	"flag" text DEFAULT '' NOT NULL,
	"face_url" text DEFAULT '' NOT NULL,
	"alliance_id" integer,
	"alliance_rank" smallint DEFAULT 0 NOT NULL,
	"alliance_joined_at" bigint DEFAULT 0 NOT NULL,
	"prestige" double precision DEFAULT 0 NOT NULL,
	"honor" double precision DEFAULT 0 NOT NULL,
	"cents" integer DEFAULT 0 NOT NULL,
	"title" smallint DEFAULT 0 NOT NULL,
	"beginner" boolean DEFAULT true NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"research" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"items" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"buffs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"castle_signs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"misc" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"population" integer DEFAULT 0 NOT NULL,
	"prestige_rank" integer DEFAULT 0 NOT NULL,
	"honor_rank" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"last_login_at" bigint DEFAULT 0 NOT NULL,
	"last_seen_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"player_ids" integer[] NOT NULL,
	"cmd" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quest_progress" (
	"player_id" integer NOT NULL,
	"quest_id" integer NOT NULL,
	"status" smallint DEFAULT 0 NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "quest_progress_player_id_quest_id_pk" PRIMARY KEY("player_id","quest_id")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"type_id" smallint DEFAULT 1 NOT NULL,
	"army_type" smallint DEFAULT 0 NOT NULL,
	"is_attack" boolean DEFAULT false NOT NULL,
	"is_back" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"start_pos" text DEFAULT '' NOT NULL,
	"target_pos" text DEFAULT '' NOT NULL,
	"body" jsonb NOT NULL,
	"event_time" bigint NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiles" (
	"id" integer PRIMARY KEY NOT NULL,
	"type" smallint NOT NULL,
	"level" smallint NOT NULL,
	"city_id" integer,
	"owner_city_id" integer,
	"owner_player_id" integer,
	"troops" jsonb,
	"forts" jsonb,
	"state" jsonb,
	"updated_at" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timed_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"due_at" bigint NOT NULL,
	"player_id" integer,
	"city_id" integer,
	"ref_key" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alliance_events" ADD CONSTRAINT "alliance_events_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_relations" ADD CONSTRAINT "alliance_relations_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_relations" ADD CONSTRAINT "alliance_relations_target_alliance_id_alliances_id_fk" FOREIGN KEY ("target_alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_requests" ADD CONSTRAINT "alliance_requests_alliance_id_alliances_id_fk" FOREIGN KEY ("alliance_id") REFERENCES "public"."alliances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_requests" ADD CONSTRAINT "alliance_requests_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armies" ADD CONSTRAINT "armies_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "armies" ADD CONSTRAINT "armies_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "cities_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heroes" ADD CONSTRAINT "heroes_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "heroes" ADD CONSTRAINT "heroes_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mails" ADD CONSTRAINT "mails_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_orders" ADD CONSTRAINT "market_orders_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_shipments" ADD CONSTRAINT "market_shipments_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_shipments" ADD CONSTRAINT "market_shipments_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_relations" ADD CONSTRAINT "player_relations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_relations" ADD CONSTRAINT "player_relations_other_player_id_players_id_fk" FOREIGN KEY ("other_player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "players" ADD CONSTRAINT "players_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_progress" ADD CONSTRAINT "quest_progress_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_username_lower_idx" ON "accounts" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_email_lower_idx" ON "accounts" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "alliance_events_idx" ON "alliance_events" USING btree ("alliance_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "alliance_requests_unique_idx" ON "alliance_requests" USING btree ("alliance_id","player_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "alliances_name_lower_idx" ON "alliances" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "armies_player_idx" ON "armies" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "armies_city_idx" ON "armies" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "armies_target_tile_idx" ON "armies" USING btree ("target_tile_id");--> statement-breakpoint
CREATE INDEX "armies_target_player_idx" ON "armies" USING btree ("target_player_id");--> statement-breakpoint
CREATE INDEX "chat_channel_time_idx" ON "chat_messages" USING btree ("channel","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cities_tile_idx" ON "cities" USING btree ("tile_id");--> statement-breakpoint
CREATE INDEX "cities_player_idx" ON "cities" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "heroes_city_idx" ON "heroes" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "heroes_player_idx" ON "heroes" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "mails_player_type_idx" ON "mails" USING btree ("player_id","type","sent_at");--> statement-breakpoint
CREATE INDEX "market_orders_book_idx" ON "market_orders" USING btree ("res_type","side","price","created_at");--> statement-breakpoint
CREATE INDEX "market_orders_city_idx" ON "market_orders" USING btree ("city_id");--> statement-breakpoint
CREATE INDEX "market_shipments_city_idx" ON "market_shipments" USING btree ("city_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_account_idx" ON "players" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "players_name_lower_idx" ON "players" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "players_alliance_idx" ON "players" USING btree ("alliance_id");--> statement-breakpoint
CREATE INDEX "players_prestige_idx" ON "players" USING btree ("prestige");--> statement-breakpoint
CREATE INDEX "push_messages_created_idx" ON "push_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reports_player_time_idx" ON "reports" USING btree ("player_id","event_time");--> statement-breakpoint
CREATE INDEX "tiles_owner_city_idx" ON "tiles" USING btree ("owner_city_id") WHERE "tiles"."owner_city_id" is not null;--> statement-breakpoint
CREATE INDEX "tiles_type_idx" ON "tiles" USING btree ("type");--> statement-breakpoint
CREATE INDEX "timed_events_due_idx" ON "timed_events" USING btree ("due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "timed_events_ref_idx" ON "timed_events" USING btree ("ref_key");