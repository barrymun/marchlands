-- (marchlands) Price candles from the trades made before market_candles existed: one per resource and minute,
-- hour and day of real time, as the market service writes them for new trades. The worker deletes minute and
-- hour candles once they are old (BALANCE.marketCandles).
INSERT INTO "market_candles" ("res_type", "scope", "period", "start", "open", "high", "low", "close", "volume", "gold", "trades")
SELECT t."res_type", 'world', p."period", t."created_at" - t."created_at" % p."ms" AS "start",
  (array_agg(t."price" ORDER BY t."created_at", t."id"))[1],
  max(t."price"),
  min(t."price"),
  (array_agg(t."price" ORDER BY t."created_at" DESC, t."id" DESC))[1],
  sum(t."amount"),
  sum(t."gold"),
  count(*)
FROM "market_trades" t,
  (VALUES ('minute', 60000::bigint), ('hour', 3600000::bigint), ('day', 86400000::bigint)) AS p("period", "ms")
GROUP BY t."res_type", p."period", 4;
