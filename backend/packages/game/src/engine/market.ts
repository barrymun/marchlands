// Marketplace settlement: the computer merchant's sweep, shipments arriving, and the fee, escrow and
// trade statistics shared with trade.*.

import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BASIC_RESOURCES,
  type BasicResource,
  CANDLE_PERIOD_MS,
  CANDLE_PERIODS,
  MarketSide,
  merchantAsk,
  merchantBid,
  merchantBuys,
  merchantReference,
  merchantSells,
  type MerchantState,
  msg,
  ReportBodyKind,
  ReportType,
  ResourceKey,
  StatCounter,
  stateOf,
  StatGroup,
  statKey,
  TimedEventType,
  TradeSide,
  WorldStateKey,
} from '@marchlands/core';
import { cities, marketCandles, marketOrders, marketShipments, marketTrades, one, worldState } from '@marchlands/db';

import { openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { createReport } from '#/engine/reports.ts';
import { gainResources, pushResources } from '#/helpers.ts';
import { citiesOf, saveCity } from '#/repo.ts';

export const GOLD = 4;
/** The basic resource a market resType names (0 food … 3 iron). Orders and shipments hold only valid ones (checked when an order is made), so another is a bug. */
export function basicResource(resType: number): BasicResource {
  const res = BASIC_RESOURCES[resType];
  if (res === undefined) throw new Error(`unknown market resource type ${resType}`);
  return res;
}
export const resKey = (t: number) => (t === GOLD ? ResourceKey.GOLD : basicResource(t));

export const escrowGold = (amount: number, price: number) => Math.ceil(amount * price * (1 + BALANCE.marketFee));
export const withFee = (gold: number) => Math.ceil(gold * (1 + BALANCE.marketFee));
/** The candles of every trade (market_candles.scope); factions and zones get their own later. */
export const WORLD_SCOPE = 'world';

// ---------------------------------------------------------------------------------------------
// Merchant state (world_state 'merchant': reference price per resource)
// ---------------------------------------------------------------------------------------------

export async function loadMerchant(ctx: Ctx, lock: boolean): Promise<Partial<MerchantState>> {
  if (lock) {
    // create the row once so it can be locked; concurrent trades then queue on it
    await ctx.tx.insert(worldState).values({ key: WorldStateKey.MERCHANT, value: {}, updatedAt: ctx.now }).onConflictDoNothing();
    const [row] = await ctx.tx.select().from(worldState).where(eq(worldState.key, WorldStateKey.MERCHANT)).for('update');
    return row?.value ?? {};
  }
  const [row] = await ctx.tx.select().from(worldState).where(eq(worldState.key, WorldStateKey.MERCHANT));
  return row?.value ?? {};
}

/** (marchlands) A lord's side of a trade, for their statistics. */
export function tradeStat(ctx: Ctx, playerId: number, cityId: number, bought: boolean, res: BasicResource, qty: number, gold: number) {
  ctx.stat(
    playerId,
    cityId,
    bought
      ? { [statKey(StatGroup.MARKET_BOUGHT, res)]: qty, [StatCounter.MARKET_GOLD_PAID]: gold }
      : { [statKey(StatGroup.MARKET_SOLD, res)]: qty, [StatCounter.MARKET_GOLD_RECEIVED]: gold },
  );
}

/** A trade, or a tick of the factions' auction, as it goes into a candle. */
export interface CandleUpdate {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  gold: number;
  trades: number;
}

/**
 * Adds to the world's price candles of every length for now: the first update in a candle opens it, later ones widen
 * its high and low, move its close and add to its volume, gold and trade count.
 */
export async function addToCandles(ctx: Ctx, resType: number, u: CandleUpdate) {
  const c = marketCandles;
  await ctx.tx
    .insert(c)
    .values(CANDLE_PERIODS.map((period) => ({ resType, scope: WORLD_SCOPE, period, start: ctx.now - (ctx.now % CANDLE_PERIOD_MS[period]), ...u })))
    .onConflictDoUpdate({
      target: [c.resType, c.scope, c.period, c.start],
      set: {
        high: sql`greatest(${c.high}, excluded.high)`,
        low: sql`least(${c.low}, excluded.low)`,
        close: sql`excluded.close`,
        volume: sql`${c.volume} + excluded.volume`,
        gold: sql`${c.gold} + excluded.gold`,
        trades: sql`${c.trades} + excluded.trades`,
      },
    });
}

/** Logs a trade with a player in it (market_trades) and adds it to the price candles. */
export async function logTrade(ctx: Ctx, t: Omit<typeof marketTrades.$inferInsert, 'id' | 'createdAt'>) {
  await ctx.tx.insert(marketTrades).values({ ...t, createdAt: ctx.now });
  await addToCandles(ctx, t.resType, { open: t.price, high: t.price, low: t.price, close: t.price, volume: t.amount, gold: t.gold, trades: 1 });
}

export async function ship(
  ctx: Ctx,
  s: { playerId: number; cityId: number; orderId: number | null; resType: number; amount: number; price: number; ms: number },
) {
  const row = one(
    await ctx.tx
      .insert(marketShipments)
      .values({
        playerId: s.playerId,
        cityId: s.cityId,
        orderId: s.orderId,
        resType: s.resType,
        amount: s.amount,
        price: s.price,
        startTime: ctx.now,
        endTime: ctx.now + s.ms,
      })
      .returning(),
  );
  ctx.schedule({
    type: TimedEventType.SHIPMENT,
    dueAt: row.endTime,
    playerId: s.playerId,
    cityId: s.cityId,
    refKey: `shipment:${row.id}`,
    payload: { shipmentId: row.id },
  });
  return row;
}

/**
 * (marchlands) Shares of the fee a buyer in `buyerCityId` paid on `gold` of a trade, for the holders of historic
 * cities (docs/features/historical-cities.md): the holder of the capital of the buyer's state, and of Atlantis
 * (BALANCE.historic.feeShare), each delivered to the seat as a gold shipment.
 */
export async function payFeeShares(ctx: Ctx, buyerCityId: number, gold: number) {
  const fee = gold * BALANCE.marketFee;
  if (fee < 1) return;
  const [buyer] = await ctx.tx.select({ tileId: cities.tileId }).from(cities).where(eq(cities.id, buyerCityId));
  if (!buyer) return;
  const seats = await ctx.tx
    .select({ id: cities.id, playerId: cities.playerId, tileId: cities.tileId, historicLevel: cities.historicLevel })
    .from(cities)
    .where(inArray(cities.historicLevel, [16, 18]))
    // held until the shipments are in: a seat going meanwhile mustn't fail this trade
    .for('key share');
  for (const s of seats) {
    const share =
      s.historicLevel === 18 ? BALANCE.historic.feeShare.atlantis : stateOf(s.tileId) === stateOf(buyer.tileId) ? BALANCE.historic.feeShare.capital : 0;
    const amount = Math.floor(fee * share);
    if (amount > 0) await ship(ctx, { playerId: s.playerId, cityId: s.id, orderId: null, resType: GOLD, amount, price: 0, ms: 0 });
  }
}

type OrderRow = typeof marketOrders.$inferSelect;

/** A resource's resting orders on one side that a price has crossed (bids at or above it, offers at or below), best first, locked. */
export async function crossedOrders(ctx: Ctx, resType: number, side: number, bound: number): Promise<OrderRow[]> {
  return ctx.tx
    .select()
    .from(marketOrders)
    .where(
      and(
        eq(marketOrders.resType, resType),
        eq(marketOrders.side, side),
        side === MarketSide.BUY ? gte(marketOrders.price, bound) : lte(marketOrders.price, bound),
        sql`${marketOrders.amount} > ${marketOrders.filled}`,
      ),
    )
    .orderBy(side === MarketSide.BUY ? desc(marketOrders.price) : asc(marketOrders.price), asc(marketOrders.createdAt))
    .limit(50)
    .for('update');
}

/**
 * Settles `qty` of a resting order filled by the merchant or, with `npc`, the factions, for `goldExact` before the fee.
 * The owner is paid like any counterparty, through zero-time shipments (a bidder also gets back what its escrow, at its
 * own price, overpaid); the order shrinks or goes; the trade is logged and reported.
 */
export async function settleResting(ctx: Ctx, o: OrderRow, qty: number, goldExact: number, npc: boolean) {
  const res = basicResource(o.resType);
  const buy = o.side === MarketSide.BUY;
  const price = goldExact / qty;
  const gold = Math.floor(goldExact);
  o.filled += qty;
  if (buy) {
    await ship(ctx, { playerId: o.playerId, cityId: o.cityId, orderId: o.id, resType: o.resType, amount: qty, price, ms: 0 });
    await payFeeShares(ctx, o.cityId, goldExact);
    const surplus = escrowGold(qty, o.price) - withFee(goldExact);
    if (surplus > 0) await ship(ctx, { playerId: o.playerId, cityId: o.cityId, orderId: o.id, resType: GOLD, amount: surplus, price: 0, ms: 0 });
  } else {
    await ship(ctx, { playerId: o.playerId, cityId: o.cityId, orderId: o.id, resType: GOLD, amount: gold, price, ms: 0 });
  }
  if (o.filled >= o.amount) await ctx.tx.delete(marketOrders).where(eq(marketOrders.id, o.id));
  else await ctx.tx.update(marketOrders).set({ filled: o.filled }).where(eq(marketOrders.id, o.id));
  await logTrade(ctx, {
    resType: o.resType,
    price,
    amount: qty,
    gold,
    takerSide: buy ? MarketSide.SELL : MarketSide.BUY,
    buyerPlayerId: buy ? o.playerId : null,
    sellerPlayerId: buy ? null : o.playerId,
    npc,
  });
  tradeStat(ctx, o.playerId, o.cityId, buy, res, qty, gold);
  ctx.push(o.playerId, PushCmd.TRADES_UPDATE, { resType: o.resType, amount: qty, price });
  await createReport(ctx, {
    playerId: o.playerId,
    typeId: ReportType.TRADE,
    title: msg('report.title.tradeCompleted'),
    body: { kind: ReportBodyKind.TRADE, trade: { side: buy ? TradeSide.BUY : TradeSide.SELL, resource: res, amount: qty, price, gold } },
  });
}

/**
 * The merchant fills resting orders its price has crossed (its reference drifts back towards the
 * base price over time, so a waiting bid can end up above its ask, or an offer below its bid).
 * Run periodically by the worker. Owners are paid like any counterparty: zero-time shipments.
 */
export async function merchantSweep(ctx: Ctx) {
  const state = await loadMerchant(ctx, true);
  let changed = false;
  const swept: number[] = [];
  for (const [resType, res] of BASIC_RESOURCES.entries()) {
    let ref = merchantReference(res, state[res], ctx.now);
    let moved = false;
    for (const side of [MarketSide.BUY, MarketSide.SELL]) {
      for (const o of await crossedOrders(ctx, resType, side, side === MarketSide.BUY ? merchantAsk(ref) : merchantBid(ref))) {
        const left = o.amount - o.filled;
        const f = side === MarketSide.BUY ? merchantSells(ref, left, o.price) : merchantBuys(ref, left, o.price);
        if (f.qty <= 0) continue;
        ref = f.ref;
        moved = changed = true;
        await settleResting(ctx, o, f.qty, f.gold, false);
      }
    }
    if (moved) {
      state[res] = { price: ref, at: ctx.now };
      swept.push(resType);
    }
  }
  if (changed) await ctx.tx.update(worldState).set({ value: state, updatedAt: ctx.now }).where(eq(worldState.key, WorldStateKey.MERCHANT));
  if (swept.length) ctx.broadcast(PushCmd.MARKET_UPDATE, { resTypes: swept });
}

/** Delivery (timed event). Falls back to the lord's first city if the target city is gone. */
export async function deliverShipment(ctx: Ctx, shipmentId: number) {
  const [peek] = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.id, shipmentId));
  if (!peek) return;
  let cityId = peek.cityId;
  const owned = await citiesOf(ctx, peek.playerId);
  if (!owned.some((c) => c.id === cityId)) cityId = owned[0]?.id ?? 0;
  if (!cityId) {
    await ctx.tx.delete(marketShipments).where(eq(marketShipments.id, shipmentId));
    return;
  }
  const b = await openCity(ctx, cityId);
  const [s] = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.id, shipmentId)).for('update');
  if (!b || !s) return;
  if (s.endTime > ctx.now) {
    ctx.schedule({
      type: TimedEventType.SHIPMENT,
      dueAt: s.endTime,
      playerId: s.playerId,
      cityId: s.cityId,
      refKey: `shipment:${s.id}`,
      payload: { shipmentId: s.id },
    });
    return;
  }
  gainResources(b.city, { [resKey(s.resType)]: s.amount });
  await ctx.tx.delete(marketShipments).where(eq(marketShipments.id, shipmentId));
  await saveCity(ctx, b.city);
  pushResources(ctx, b);
  ctx.push(s.playerId, PushCmd.TRANSIT_TRADE_UPDATE, { id: s.id, delivered: true, resType: s.resType, amount: s.amount, castleId: cityId });
}
