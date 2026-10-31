CREATE TABLE "faction_standing" (
	"player_id" integer NOT NULL,
	"faction_id" text NOT NULL,
	"value" double precision NOT NULL,
	"at" bigint NOT NULL,
	"trade_day" integer DEFAULT 0 NOT NULL,
	"trade_gained" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "faction_standing_player_id_faction_id_pk" PRIMARY KEY("player_id","faction_id")
);
--> statement-breakpoint
ALTER TABLE "faction_standing" ADD CONSTRAINT "faction_standing_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;