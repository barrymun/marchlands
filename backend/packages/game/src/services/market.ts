// trade.* — Marketplace (food/wood/stone/iron for gold). The original kept food orders only,
// had no escrow and never matched. Marchlands:
// - an order book with escrow, matched at the resting order's price (price-time priority);
// - a computer merchant (core/merchant.ts) that always buys and sells, so every order can fill;
// - instant settlement: the lord placing the order is paid in the same transaction; a lord whose
//   resting order is hit is paid through a zero-time shipment (so no other city is locked here);
// - a 0.5% fee on the buyer's gold, and a log of completed trades (market_trades) for history.

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import {
  BALANCE,
  BuildingType,
  buildingLevel,
  goldForSpeedup,
  GameError,
  merchantAsk,
  merchantBase,
  merchantBid,
  merchantBuys,
  merchantMarginal,
  merchantReference,
  merchantSells,
  scaled,
  type MarketResource,
  type MerchantState,
} from '@marchlands/core';
import { marketOrders, marketShipments, marketTrades, pgArray, worldState } from '@marchlands/db';
import { openCity, openOwnCity } from '../city.ts';
import type { Ctx } from '../context.ts';
import { gainResources, pushResources, spendGold } from '../helpers.ts';
import { citiesOf, saveCity } from '../repo.ts';
import { createReport, ReportType } from './reports.ts';
import { PushCmd } from '@marchlands/contracts';

export const RES_TYPES = ['food', 'wood', 'stone', 'iron'] as const;
const GOLD = 4;
const resKey = (t: number) => (t === GOLD ? 'gold' : RES_TYPES[t]);

export const Side = { BUY: 0, SELL: 1 } as const;

type OrderRow = typeof marketOrders.$inferSelect;

const roundPrice = (p: number) => Math.round(p * 1000) / 1000;
const escrowGold = (amount: number, price: number) => Math.ceil(amount * price * (1 + BALANCE.marketFee));
const withFee = (gold: number) => Math.ceil(gold * (1 + BALANCE.marketFee));
const MERCHANT_KEY = 'merchant';

function orderBean(o: OrderRow) {
  return {
    id: o.id,
    resType: o.resType,
    resourceName: RES_TYPES[o.resType],
    tradeType: o.side,
    tradeTypeName: o.side === Side.BUY ? 'Bid' : 'Offer',
    price: o.price,
    amount: o.amount,
    dealedTotal: o.filled,
    createdAt: o.createdAt,
    cityId: o.cityId,
  };
}

function assertResType(resType: number): MarketResource {
  if (!(Number.isInteger(resType) && resType >= 0 && resType <= 3)) throw new GameError('Not a valid resource type.', -99);
  return RES_TYPES[resType];
}

// ---------------------------------------------------------------------------------------------
// Merchant state (world_state 'merchant': reference price per resource)
// ---------------------------------------------------------------------------------------------

async function loadMerchant(ctx: Ctx, lock: boolean): Promise<Partial<MerchantState>> {
  if (lock) {
    // create the row once so it can be locked; concurrent trades then queue on it
    await ctx.tx.insert(worldState).values({ key: MERCHANT_KEY, value: {}, updatedAt: ctx.now }).onConflictDoNothing();
    const [row] = await ctx.tx.select().from(worldState).where(eq(worldState.key, MERCHANT_KEY)).for('update');
    return (row?.value ?? {}) as Partial<MerchantState>;
  }
  const [row] = await ctx.tx.select().from(worldState).where(eq(worldState.key, MERCHANT_KEY));
  return (row?.value ?? {}) as Partial<MerchantState>;
}

function merchantQuoteBean(res: MarketResource, state: Partial<MerchantState>, now: number) {
  const reference = merchantReference(res, state[res], now);
  return { reference, base: merchantBase(res), bid: merchantBid(reference), ask: merchantAsk(reference) };
}

// ---------------------------------------------------------------------------------------------
// Matching plan (shared by orders and quotes)
// ---------------------------------------------------------------------------------------------

interface Fill {
  qty: number;
  /** gold for the fill before the buyer's fee (fractional for merchant fills) */
  gold: number;
  /** resting order hit, or null for the merchant */
  other: OrderRow | null;
}

/**
 * Walks the opposite side of the book and the merchant's price curve, always taking the better
 * price (players first on a tie). `limit` is the worst acceptable price: Infinity / 0 for market
 * orders. `offers` are resting orders sorted best price first, then oldest.
 */
function planFills(side: number, qty: number, limit: number, offers: OrderRow[], ref: number) {
  const buy = side === Side.BUY;
  const better = (a: number, b: number) => (buy ? a <= b : a >= b);
  const fills: Fill[] = [];
  let remaining = qty;
  let r = ref;
  let i = 0;
  for (let guard = 0; remaining > 0 && guard < 10_000; guard++) {
    while (i < offers.length && offers[i].amount - offers[i].filled - used(fills, offers[i]) <= 0) i++;
    const o = offers[i];
    const playerOk = !!o && better(o.price, limit);
    if (playerOk && better(o.price, merchantMarginal(r, buy ? 'buy' : 'sell'))) {
      const q = Math.min(remaining, o.amount - o.filled - used(fills, o));
      fills.push({ qty: q, gold: q * o.price, other: o });
      remaining -= q;
      continue;
    }
    // the merchant, up to the next resting order's price (or the limit)
    const bound = buy ? Math.min(limit, playerOk ? o.price : Infinity) : Math.max(limit, playerOk ? o.price : 0);
    const f = buy ? merchantSells(r, remaining, bound) : merchantBuys(r, remaining, bound);
    if (f.qty > 0) {
      fills.push({ qty: f.qty, gold: f.gold, other: null });
      remaining -= f.qty;
      r = f.ref;
    } else if (playerOk) {
      const q = Math.min(remaining, o.amount - o.filled - used(fills, o));
      fills.push({ qty: q, gold: q * o.price, other: o });
      remaining -= q;
    } else break;
  }
  // merge consecutive merchant fills
  const merged: Fill[] = [];
  for (const f of fills) {
    const last = merged[merged.length - 1];
    if (last && !last.other && !f.other) Object.assign(last, { qty: last.qty + f.qty, gold: last.gold + f.gold });
    else merged.push({ ...f });
  }
  return { fills: merged, ref: r, filled: qty - remaining };
}

function used(fills: Fill[], o: OrderRow) {
  let n = 0;
  for (const f of fills) if (f.other?.id === o.id) n += f.qty;
  return n;
}

async function restingOffers(ctx: Ctx, resType: number, side: number, limit: number, excludePlayerId: number | null, lock: boolean) {
  const buy = side === Side.BUY;
  const q = ctx.tx
    .select()
    .from(marketOrders)
    .where(
      and(
        eq(marketOrders.resType, resType),
        eq(marketOrders.side, buy ? Side.SELL : Side.BUY),
        Number.isFinite(limit) && limit > 0 ? (buy ? lte(marketOrders.price, limit) : gte(marketOrders.price, limit)) : undefined,
        sql`${marketOrders.amount} > ${marketOrders.filled}`,
        excludePlayerId != null ? sql`${marketOrders.playerId} <> ${excludePlayerId}` : undefined,
      ),
    )
    .orderBy(buy ? asc(marketOrders.price) : desc(marketOrders.price), asc(marketOrders.createdAt), asc(marketOrders.id))
    .limit(100);
  return lock ? q.for('update') : q;
}

export interface OrderInput {
  resType: number;
  side: number;
  amount: number;
  price?: number;
  /** limit (default): rest on the book if not filled; market: fill now at any price */
  type?: 'limit' | 'market';
}

function normalise(o: OrderInput) {
  const res = assertResType(o.resType);
  if (o.side !== Side.BUY && o.side !== Side.SELL) throw new GameError('Invalid trade type.', -99);
  if (!Number.isInteger(o.amount) || o.amount < 1 || o.amount > 1e10) throw new GameError('Invalid amount.', -99);
  const market = o.type === 'market';
  let price = 0;
  if (!market) {
    price = roundPrice(Number(o.price));
    if (!(price >= 0.001 && price <= 1e6)) throw new GameError('Invalid price.', -99);
  }
  const limit = market ? (o.side === Side.BUY ? Infinity : 0) : price;
  return { res, market, price, limit };
}

function summarise(side: number, plan: ReturnType<typeof planFills>, rest: number, price: number) {
  const fillGold = plan.fills.reduce((s, f) => s + f.gold, 0);
  const merchantFilled = plan.fills.filter((f) => !f.other).reduce((s, f) => s + f.qty, 0);
  const gold = side === Side.BUY ? withFee(fillGold) : Math.floor(fillGold);
  return {
    filled: plan.filled,
    avgPrice: plan.filled > 0 ? fillGold / plan.filled : null,
    gold,
    fee: side === Side.BUY ? gold - Math.ceil(fillGold) : 0,
    merchantFilled,
    playerFilled: plan.filled - merchantFilled,
    rest,
    escrow: rest > 0 ? (side === Side.BUY ? escrowGold(rest, price) : rest) : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/** trade.searchTrades: top price levels on both sides, plus the merchant's quotes. */
export async function orderBook(ctx: Ctx, resType: number, depth = 10) {
  const res = assertResType(resType);
  const level = (side: number, dir: 'asc' | 'desc') =>
    ctx.tx.execute<{ price: number; amount: number }>(sql`
      select price, sum(amount - filled)::bigint as amount from market_orders
      where res_type = ${resType} and side = ${side} and amount > filled
      group by price order by price ${sql.raw(dir)} limit ${depth}`);
  const buyers = await level(Side.BUY, 'desc');
  const sellers = await level(Side.SELL, 'asc');
  const conv = (r: { price: number; amount: number }) => ({ price: Number(r.price), amount: Number(r.amount) });
  const merchant = merchantQuoteBean(res, await loadMerchant(ctx, false), ctx.now);
  return { resType, buyers: buyers.rows.map(conv), sellers: sellers.rows.map(conv), merchant };
}

/** What an order would do right now (no side effects). */
export async function quote(ctx: Ctx, playerId: number, o: OrderInput) {
  const { res, market, price, limit } = normalise(o);
  const ref = merchantReference(res, (await loadMerchant(ctx, false))[res], ctx.now);
  const offers = await restingOffers(ctx, o.resType, o.side, limit, playerId, false);
  const plan = planFills(o.side, o.amount, limit, offers, ref);
  return summarise(o.side, plan, market ? 0 : o.amount - plan.filled, price);
}

/** Recent trades and price candles of one game hour each. */
export async function history(ctx: Ctx, resType: number, buckets = 24) {
  const res = assertResType(resType);
  const bucketMs = Math.max(1000, scaled(3_600_000));
  const since = ctx.now - bucketMs * buckets;
  const rows = await ctx.tx
    .select()
    .from(marketTrades)
    .where(and(eq(marketTrades.resType, resType), gte(marketTrades.createdAt, since)))
    .orderBy(asc(marketTrades.createdAt), asc(marketTrades.id))
    .limit(20_000);
  const candles: { t: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
  for (const t of rows) {
    const start = Math.floor(t.createdAt / bucketMs) * bucketMs;
    const c = candles[candles.length - 1];
    if (c && c.t === start) {
      c.high = Math.max(c.high, t.price);
      c.low = Math.min(c.low, t.price);
      c.close = t.price;
      c.volume += t.amount;
    } else candles.push({ t: start, open: t.price, high: t.price, low: t.price, close: t.price, volume: t.amount });
  }
  const recent = await ctx.tx
    .select()
    .from(marketTrades)
    .where(eq(marketTrades.resType, resType))
    .orderBy(desc(marketTrades.createdAt), desc(marketTrades.id))
    .limit(30);
  return {
    resType,
    bucketMs,
    merchant: merchantQuoteBean(res, await loadMerchant(ctx, false), ctx.now),
    candles,
    trades: recent.map((t) => ({
      id: t.id,
      price: t.price,
      amount: t.amount,
      gold: t.gold,
      takerSide: t.takerSide,
      merchant: t.buyerPlayerId == null || t.sellerPlayerId == null,
      createdAt: t.createdAt,
    })),
  };
}

/** trade.getMyTradeList */
export async function myOrders(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx.select().from(marketOrders).where(eq(marketOrders.playerId, playerId)).orderBy(desc(marketOrders.createdAt));
  return rows.map(orderBean);
}

/** trade.getTransingTradeList */
export async function myShipments(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.playerId, playerId)).orderBy(asc(marketShipments.endTime));
  return rows.map((s) => ({
    id: s.id,
    cityId: s.cityId,
    resType: s.resType,
    resourceName: resKey(s.resType),
    amount: s.amount,
    price: s.price,
    startTime: s.startTime,
    endTime: s.endTime,
  }));
}

function shipmentMs(marketLevel: number) {
  if (BALANCE.marketShipmentBaseMs <= 0) return 0;
  return scaled(Math.floor(BALANCE.marketShipmentBaseMs / Math.max(1, marketLevel)));
}

/** (marchlands) A lord's side of a trade, for their statistics. */
function tradeStat(ctx: Ctx, playerId: number, cityId: number, bought: boolean, res: string, qty: number, gold: number) {
  ctx.stat(
    playerId,
    cityId,
    bought ? { [`market.bought.${res}`]: qty, 'market.goldPaid': gold } : { [`market.sold.${res}`]: qty, 'market.goldReceived': gold },
  );
}

async function ship(ctx: Ctx, s: { playerId: number; cityId: number; orderId: number; resType: number; amount: number; price: number; ms: number }) {
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

// ---------------------------------------------------------------------------------------------
// Placing an order
// ---------------------------------------------------------------------------------------------

/** trade.newTrade */
export async function placeOrder(ctx: Ctx, playerId: number, cityId: number, o: OrderInput) {
  const { res, market, price, limit } = normalise(o);
  const b = await openOwnCity(ctx, playerId, cityId);
  const marketLevel = buildingLevel(b.city.buildings, BuildingType.MARKETPLACE);
  if (marketLevel < 1) throw new GameError('You need a Marketplace to trade.', -99);
  const buy = o.side === Side.BUY;

  const merchantState = await loadMerchant(ctx, true);
  const ref = merchantReference(res, merchantState[res], ctx.now);
  const offers = await restingOffers(ctx, o.resType, o.side, limit, playerId, true);
  const plan = planFills(o.side, o.amount, limit, offers, ref);
  const rest = market ? 0 : o.amount - plan.filled;
  if (market && plan.filled === 0) throw new GameError('Nothing to trade at the moment.', -99);
  const sum = summarise(o.side, plan, rest, price);

  if (rest > 0) {
    const open = await ctx.tx.select({ id: marketOrders.id }).from(marketOrders).where(eq(marketOrders.cityId, cityId));
    if (open.length >= marketLevel * BALANCE.marketMaxOrdersPerLevel) throw new GameError('Upgrade your Marketplace to place more orders.', -99);
  }
  // pay up front: the buyer's gold for the fills (with fee) plus escrow for the rest; the seller's goods
  if (buy) {
    const need = sum.gold + sum.escrow;
    if (b.city.gold < need) throw new GameError(`Not enough gold (${need.toLocaleString('en')} needed).`, -99);
    b.city.gold -= need;
    b.city[res] += plan.filled;
  } else {
    const goods = plan.filled + rest;
    if (b.city[res] < goods) throw new GameError(`Not enough ${res}.`, -99);
    b.city[res] -= goods;
    b.city.gold += sum.gold;
  }

  // counterparties: resting orders are updated and their owners paid by zero-time shipments
  for (const f of plan.fills) {
    const gold = Math.floor(f.gold);
    await ctx.tx.insert(marketTrades).values({
      resType: o.resType,
      price: f.gold / f.qty,
      amount: f.qty,
      gold,
      takerSide: o.side,
      buyerPlayerId: buy ? playerId : (f.other?.playerId ?? null),
      sellerPlayerId: buy ? (f.other?.playerId ?? null) : playerId,
      createdAt: ctx.now,
    });
    tradeStat(ctx, playerId, cityId, buy, res, f.qty, gold);
    if (!f.other) continue;
    const other = f.other;
    tradeStat(ctx, other.playerId, other.cityId, !buy, res, f.qty, gold);
    other.filled += f.qty;
    await ctx.tx.update(marketOrders).set({ filled: other.filled }).where(eq(marketOrders.id, other.id));
    if (buy) {
      // their offer sold: gold to them
      await ship(ctx, { playerId: other.playerId, cityId: other.cityId, orderId: other.id, resType: GOLD, amount: gold, price: other.price, ms: 0 });
    } else {
      // their bid bought: goods to them (their gold was escrowed at this price)
      await ship(ctx, {
        playerId: other.playerId,
        cityId: other.cityId,
        orderId: other.id,
        resType: o.resType,
        amount: f.qty,
        price: other.price,
        ms: shipmentMs(await marketLevelOf(ctx, other.cityId)),
      });
    }
    ctx.push(other.playerId, PushCmd.TRADES_UPDATE, { resType: o.resType, amount: f.qty, price: other.price });
    await createReport(ctx, {
      playerId: other.playerId,
      typeId: ReportType.TRADE,
      title: 'Trade Completed',
      body: { kind: 'trade', trade: { side: buy ? 'sell' : 'buy', resource: res, amount: f.qty, price: other.price, gold } },
    });
  }
  const hit = plan.fills.filter((f) => f.other).map((f) => f.other!.id);
  if (hit.length) await ctx.tx.execute(sql`delete from market_orders where filled >= amount and id = any(${pgArray(hit)}::int[])`);

  if (sum.merchantFilled > 0) {
    const value = { ...merchantState, [res]: { price: plan.ref, at: ctx.now } };
    await ctx.tx.update(worldState).set({ value, updatedAt: ctx.now }).where(eq(worldState.key, MERCHANT_KEY));
  }

  let order: OrderRow | null = null;
  if (rest > 0) {
    [order] = await ctx.tx
      .insert(marketOrders)
      .values({ playerId, cityId, resType: o.resType, side: o.side, price, amount: o.amount, filled: plan.filled, createdAt: ctx.now })
      .returning();
  }
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  return { ...sum, order: order ? orderBean(order) : null };
}

/**
 * The merchant fills resting orders its price has crossed (its reference drifts back towards the
 * base price over time, so a waiting bid can end up above its ask, or an offer below its bid).
 * Run periodically by the worker. Owners are paid like any counterparty: zero-time shipments.
 */
export async function merchantSweep(ctx: Ctx) {
  const state = await loadMerchant(ctx, true);
  let changed = false;
  for (let resType = 0; resType < RES_TYPES.length; resType++) {
    const res = RES_TYPES[resType];
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
            side === Side.BUY ? gte(marketOrders.price, bound) : lte(marketOrders.price, bound),
            sql`${marketOrders.amount} > ${marketOrders.filled}`,
          ),
        )
        .orderBy(side === Side.BUY ? desc(marketOrders.price) : asc(marketOrders.price), asc(marketOrders.createdAt))
        .limit(50)
        .for('update');
    for (const side of [Side.BUY, Side.SELL]) {
      for (const o of await crossed(side, side === Side.BUY ? merchantAsk(ref) : merchantBid(ref))) {
        const left = o.amount - o.filled;
        const f = side === Side.BUY ? merchantSells(ref, left, o.price) : merchantBuys(ref, left, o.price);
        if (f.qty <= 0) continue;
        ref = f.ref;
        moved = changed = true;
        o.filled += f.qty;
        const gold = Math.floor(f.gold);
        if (side === Side.BUY) {
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
          takerSide: side === Side.BUY ? Side.SELL : Side.BUY,
          buyerPlayerId: side === Side.BUY ? o.playerId : null,
          sellerPlayerId: side === Side.BUY ? null : o.playerId,
          createdAt: ctx.now,
        });
        tradeStat(ctx, o.playerId, o.cityId, side === Side.BUY, res, f.qty, gold);
        ctx.push(o.playerId, PushCmd.TRADES_UPDATE, { resType, amount: f.qty, price: f.gold / f.qty });
        await createReport(ctx, {
          playerId: o.playerId,
          typeId: ReportType.TRADE,
          title: 'Trade Completed',
          body: { kind: 'trade', trade: { side: side === Side.BUY ? 'buy' : 'sell', resource: res, amount: f.qty, price: f.gold / f.qty, gold } },
        });
      }
    }
    if (moved) state[res] = { price: ref, at: ctx.now };
  }
  if (changed) await ctx.tx.update(worldState).set({ value: state, updatedAt: ctx.now }).where(eq(worldState.key, MERCHANT_KEY));
}

async function marketLevelOf(ctx: Ctx, cityId: number) {
  const rows = await ctx.tx.execute<{ buildings: { typeId: number; level: number }[] }>(sql`select buildings from cities where id = ${cityId}`);
  return buildingLevel((rows.rows[0]?.buildings ?? []) as never, BuildingType.MARKETPLACE);
}

/** trade.cancelTrade: escrow for the unfilled part is returned. */
export async function cancelOrder(ctx: Ctx, playerId: number, orderId: number) {
  const [peek] = await ctx.tx.select().from(marketOrders).where(eq(marketOrders.id, orderId));
  if (!peek || peek.playerId !== playerId) throw new GameError('Order not found.', -99, 404);
  const b = await openOwnCity(ctx, playerId, peek.cityId);
  const [o] = await ctx.tx.select().from(marketOrders).where(eq(marketOrders.id, orderId)).for('update');
  if (!o) throw new GameError('Order not found.', -99, 404);
  const left = o.amount - o.filled;
  if (o.side === Side.BUY) gainResources(b.city, { gold: escrowGold(left, o.price) });
  else gainResources(b.city, { [RES_TYPES[o.resType]]: left });
  await ctx.tx.delete(marketOrders).where(eq(marketOrders.id, orderId));
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** trade.speedUpTrans: instant delivery, paid with the receiving city's gold (orig: cents). */
export async function speedupShipment(ctx: Ctx, playerId: number, shipmentId: number) {
  const [s] = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.id, shipmentId)).for('update');
  if (!s || s.playerId !== playerId) throw new GameError('Shipment not found.', -99, 404);
  const b = await openOwnCity(ctx, playerId, s.cityId);
  const gold = goldForSpeedup(Math.max(0, s.endTime - ctx.now));
  spendGold(b.city, gold);
  ctx.stat(playerId, s.cityId, { 'spent.speedups.gold': gold });
  await ctx.tx.update(marketShipments).set({ endTime: ctx.now }).where(eq(marketShipments.id, shipmentId));
  ctx.schedule({ type: 'shipment', dueAt: ctx.now, playerId, cityId: s.cityId, refKey: `shipment:${s.id}`, payload: { shipmentId: s.id } });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
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
