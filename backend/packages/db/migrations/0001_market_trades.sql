CREATE TABLE "market_trades" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"res_type" smallint NOT NULL,
	"price" double precision NOT NULL,
	"amount" bigint NOT NULL,
	"gold" bigint NOT NULL,
	"taker_side" smallint NOT NULL,
	"buyer_player_id" integer,
	"seller_player_id" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE INDEX "market_trades_res_time_idx" ON "market_trades" USING btree ("res_type","created_at");--> statement-breakpoint
CREATE INDEX "market_trades_buyer_idx" ON "market_trades" USING btree ("buyer_player_id");--> statement-breakpoint
CREATE INDEX "market_trades_seller_idx" ON "market_trades" USING btree ("seller_player_id");