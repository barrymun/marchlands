// Marketplace settlement: the computer merchant's sweep, shipments arriving, and the fee, escrow and
// trade statistics shared with trade.*.

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  BALANCE,
  BASIC_RESOURCES,
  MarketSide,
  merchantAsk,
  merchantBid,
  merchantBuys,
  merchantReference,
  merchantSells,
  type MerchantState,
  msg,
  ReportType,
} from '@marchlands/core';
import { marketOrders, marketShipments, marketTrades, worldState } from '@marchlands/db';
import { openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { gainResources, pushResources } from '#/helpers.ts';
import { citiesOf, saveCity } from '#/repo.ts';
import { createReport } from '#/engine/reports.ts';
import { PushCmd } from '@marchlands/contracts';

export const GOLD = 4;
export const resKey = (t: number) => (t === GOLD ? 'gold' : BASIC_RESOURCES[t]);

export const escrowGold = (amount: number, price: number) => Math.ceil(amount * price * (1 + BALANCE.marketFee));
export const withFee = (gold: number) => Math.ceil(gold * (1 + BALANCE.marketFee));
export const MERCHANT_KEY = 'merchant';

// ---------------------------------------------------------------------------------------------
// Merchant state (world_state 'merchant': reference price per resource)
// ---------------------------------------------------------------------------------------------

export async function loadMerchant(ctx: Ctx, lock: boolean): Promise<Partial<MerchantState>> {
  if (lock) {
    // create the row once so it can be locked; concurrent trades then queue on it
    await ctx.tx.insert(worldState).values({ key: MERCHANT_KEY, value: {}, updatedAt: ctx.now }).onConflictDoNothing();
    const [row] = await ctx.tx.select().from(worldState).where(eq(worldState.key, MERCHANT_KEY)).for('update');
    return (row?.value ?? {}) as Partial<MerchantState>;
  }
  const [row] = await ctx.tx.select().from(worldState).where(eq(worldState.key, MERCHANT_KEY));
  return (row?.value ?? {}) as Partial<MerchantState>;
}

/** (marchlands) A lord's side of a trade, for their statistics. */
export function tradeStat(ctx: Ctx, playerId: number, cityId: number, bought: boolean, res: string, qty: number, gold: number) {
  ctx.stat(
    playerId,
    cityId,
    bought ? { [`market.bought.${res}`]: qty, 'market.goldPaid': gold } : { [`market.sold.${res}`]: qty, 'market.goldReceived': gold },
  );
}

export async function ship(ctx: Ctx, s: { playerId: number; cityId: number; orderId: number; resType: number; amount: number; price: number; ms: number }) {
  const [row] = await ctx.tx
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
    .returning();
  ctx.schedule({ type: 'shipment', dueAt: row.endTime, playerId: s.playerId, cityId: s.cityId, refKey: `shipment:${row.id}`, payload: { shipmentId: row.id } });
  return row;
}

/**
 * The merchant fills resting orders its price has crossed (its reference drifts back towards the
 * base price over time, so a waiting bid can end up above its ask, or an offer below its bid).
 * Run periodically by the worker. Owners are paid like any counterparty: zero-time shipments.
 */
export async function merchantSweep(ctx: Ctx) {
  const state = await loadMerchant(ctx, true);
  let changed = false;
  for (let resType = 0; resType < BASIC_RESOURCES.length; resType++) {
    const res = BASIC_RESOURCES[resType];
    let ref = merchantReference(res, state[res], ctx.now);
    let moved = false;
    const crossed = async (side: number, bound: number) =>
      ctx.tx
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
    for (const side of [MarketSide.BUY, MarketSide.SELL]) {
      for (const o of await crossed(side, side === MarketSide.BUY ? merchantAsk(ref) : merchantBid(ref))) {
        const left = o.amount - o.filled;
        const f = side === MarketSide.BUY ? merchantSells(ref, left, o.price) : merchantBuys(ref, left, o.price);
        if (f.qty <= 0) continue;
        ref = f.ref;
        moved = changed = true;
        o.filled += f.qty;
        const gold = Math.floor(f.gold);
        if (side === MarketSide.BUY) {
          // goods to the bidder, plus what its escrow (at its own price) overpaid
          await ship(ctx, { playerId: o.playerId, cityId: o.cityId, orderId: o.id, resType, amount: f.qty, price: f.gold / f.qty, ms: 0 });
          const surplus = escrowGold(f.qty, o.price) - withFee(f.gold);
          if (surplus > 0) await ship(ctx, { playerId: o.playerId, cityId: o.cityId, orderId: o.id, resType: GOLD, amount: surplus, price: 0, ms: 0 });
        } else {
          await ship(ctx, { playerId: o.playerId, cityId: o.cityId, orderId: o.id, resType: GOLD, amount: gold, price: f.gold / f.qty, ms: 0 });
        }
        if (o.filled >= o.amount) await ctx.tx.delete(marketOrders).where(eq(marketOrders.id, o.id));
        else await ctx.tx.update(marketOrders).set({ filled: o.filled }).where(eq(marketOrders.id, o.id));
        await ctx.tx.insert(marketTrades).values({
          resType,
          price: f.gold / f.qty,
          amount: f.qty,
          gold,
          takerSide: side === MarketSide.BUY ? MarketSide.SELL : MarketSide.BUY,
          buyerPlayerId: side === MarketSide.BUY ? o.playerId : null,
          sellerPlayerId: side === MarketSide.BUY ? null : o.playerId,
          createdAt: ctx.now,
        });
        tradeStat(ctx, o.playerId, o.cityId, side === MarketSide.BUY, res, f.qty, gold);
        ctx.push(o.playerId, PushCmd.TRADES_UPDATE, { resType, amount: f.qty, price: f.gold / f.qty });
        await createReport(ctx, {
          playerId: o.playerId,
          typeId: ReportType.TRADE,
          title: msg('report.title.tradeCompleted'),
          body: { kind: 'trade', trade: { side: side === MarketSide.BUY ? 'buy' : 'sell', resource: res, amount: f.qty, price: f.gold / f.qty, gold } },
        });
      }
    }
    if (moved) state[res] = { price: ref, at: ctx.now };
  }
  if (changed) await ctx.tx.update(worldState).set({ value: state, updatedAt: ctx.now }).where(eq(worldState.key, MERCHANT_KEY));
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
    ctx.schedule({ type: 'shipment', dueAt: s.endTime, playerId: s.playerId, cityId: s.cityId, refKey: `shipment:${s.id}`, payload: { shipmentId: s.id } });
    return;
  }
  gainResources(b.city, { [resKey(s.resType)]: s.amount });
  await ctx.tx.delete(marketShipments).where(eq(marketShipments.id, shipmentId));
  await saveCity(ctx, b.city);
  pushResources(ctx, b);
  ctx.push(s.playerId, PushCmd.TRANSIT_TRADE_UPDATE, { id: s.id, delivered: true, resType: s.resType, amount: s.amount, castleId: cityId });
}
