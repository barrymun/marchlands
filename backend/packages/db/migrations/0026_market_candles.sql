CREATE TABLE "market_candles" (
	"res_type" smallint NOT NULL,
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"start" bigint NOT NULL,
	"open" double precision NOT NULL,
	"high" double precision NOT NULL,
	"low" double precision NOT NULL,
	"close" double precision NOT NULL,
	"volume" bigint NOT NULL,
	"gold" bigint NOT NULL,
	"trades" integer NOT NULL,
	CONSTRAINT "market_candles_res_type_scope_period_start_pk" PRIMARY KEY("res_type","scope","period","start")
);
--> statement-breakpoint
CREATE INDEX "market_candles_period_start_idx" ON "market_candles" USING btree ("period","start");