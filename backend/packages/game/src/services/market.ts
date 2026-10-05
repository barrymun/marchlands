// trade.* — Marketplace order book (food/wood/stone/iron for gold). The original kept food
// orders only, had no escrow and never matched. Here: escrow on placement, price-time priority
// matching at the resting order's price, a 0.5% fee paid by the buyer, and goods/gold delivered
// as shipments (bought goods travel; sale proceeds arrive at once). Counterparties are only
// credited through shipments, so a trade never locks another lord's city.

import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { BALANCE, BuildingType, buildingLevel, coinsForSpeedup, GameError, scaled } from '@evony/core';
import { marketOrders, marketShipments, pgArray } from '@evony/db';
import { openCity, openOwnCity } from '../city.ts';
import type { Ctx } from '../context.ts';
import { activeBuff, gainResources, pushResources, spendCents } from '../helpers.ts';
import { citiesOf, getPlayer, saveCity, savePlayer } from '../repo.ts';
import { createReport, ReportType } from './reports.ts';

export const RES_TYPES = ['food', 'wood', 'stone', 'iron'] as const;
const GOLD = 4;
const resKey = (t: number) => (t === GOLD ? 'gold' : RES_TYPES[t]);

export const Side = { BUY: 0, SELL: 1 } as const;

type OrderRow = typeof marketOrders.$inferSelect;

const roundPrice = (p: number) => Math.round(p * 1000) / 1000;
const escrowGold = (amount: number, price: number) => Math.ceil(amount * price * (1 + BALANCE.marketFee));

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

/** trade.searchTrades: top price levels on both sides. */
export async function orderBook(ctx: Ctx, resType: number, depth = 10) {
  if (!(resType >= 0 && resType <= 3)) throw new GameError('Not a valid resource type.', -99);
  const level = (side: number, dir: 'asc' | 'desc') =>
    ctx.tx.execute<{ price: number; amount: number }>(sql`
      select price, sum(amount - filled)::bigint as amount from market_orders
      where res_type = ${resType} and side = ${side} and amount > filled
      group by price order by price ${sql.raw(dir)} limit ${depth}`);
  const buyers = await level(Side.BUY, 'desc');
  const sellers = await level(Side.SELL, 'asc');
  const conv = (r: { price: number; amount: number }) => ({ price: Number(r.price), amount: Number(r.amount) });
  return { resType, buyers: buyers.rows.map(conv), sellers: sellers.rows.map(conv) };
}

/** trade.getMyTradeList */
export async function myOrders(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx.select().from(marketOrders).where(eq(marketOrders.playerId, playerId)).orderBy(desc(marketOrders.createdAt));
  return rows.map(orderBean);
}

/** trade.getTransingTradeList */
export async function myShipments(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.playerId, playerId)).orderBy(asc(marketShipments.endTime));
  return rows.map((s) => ({ id: s.id, cityId: s.cityId, resType: s.resType, resourceName: resKey(s.resType), amount: s.amount, price: s.price, startTime: s.startTime, endTime: s.endTime }));
}

function shipmentMs(ctx: Ctx, marketLevel: number, fleet: boolean) {
  const base = BALANCE.marketShipmentBaseMs / Math.max(1, marketLevel);
  return scaled(Math.floor(fleet ? base / 2 : base));
}

async function ship(ctx: Ctx, s: { playerId: number; cityId: number; orderId: number; resType: number; amount: number; price: number; ms: number }) {
  const [row] = await ctx.tx
    .insert(marketShipments)
    .values({ playerId: s.playerId, cityId: s.cityId, orderId: s.orderId, resType: s.resType, amount: s.amount, price: s.price, startTime: ctx.now, endTime: ctx.now + s.ms })
    .returning();
  ctx.schedule({ type: 'shipment', dueAt: row.endTime, playerId: s.playerId, cityId: s.cityId, refKey: `shipment:${row.id}`, payload: { shipmentId: row.id } });
  return row;
}

/** trade.newTrade */
export async function placeOrder(ctx: Ctx, playerId: number, cityId: number, o: { resType: number; side: number; amount: number; price: number }) {
  if (!(o.resType >= 0 && o.resType <= 3)) throw new GameError('Not a valid resource type.', -99);
  if (o.side !== Side.BUY && o.side !== Side.SELL) throw new GameError('Invalid trade type.', -99);
  if (!Number.isInteger(o.amount) || o.amount < 1 || o.amount > 1e10) throw new GameError('Invalid amount.', -99);
  const price = roundPrice(Number(o.price));
  if (!(price >= 0.001 && price <= 1e6)) throw new GameError('Invalid price.', -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  const market = buildingLevel(b.city.buildings, BuildingType.MARKETPLACE);
  if (market < 1) throw new GameError('You need a Marketplace to trade.', -99);
  const open = await ctx.tx.select({ id: marketOrders.id }).from(marketOrders).where(eq(marketOrders.cityId, cityId));
  if (open.length >= market * BALANCE.marketMaxOrdersPerLevel) throw new GameError('Upgrade your Marketplace to place more orders.', -99);
  const res = RES_TYPES[o.resType];
  if (o.side === Side.BUY) {
    const need = escrowGold(o.amount, price);
    if (b.city.gold < need) throw new GameError('Not enough gold.', -99);
    b.city.gold -= need;
  } else {
    if (b.city[res] < o.amount) throw new GameError(`Not enough ${res}.`, -99);
    b.city[res] -= o.amount;
  }
  const [order] = await ctx.tx
    .insert(marketOrders)
    .values({ playerId, cityId, resType: o.resType, side: o.side, price, amount: o.amount, createdAt: ctx.now })
    .returning();

  // ---- matching ----
  const fleet = !!activeBuff(b.player, 'MerchantFleetBuff', ctx.now);
  const counter = await ctx.tx
    .select()
    .from(marketOrders)
    .where(
      and(
        eq(marketOrders.resType, o.resType),
        eq(marketOrders.side, o.side === Side.BUY ? Side.SELL : Side.BUY),
        o.side === Side.BUY ? lte(marketOrders.price, price) : gte(marketOrders.price, price),
        sql`${marketOrders.amount} > ${marketOrders.filled}`,
        sql`${marketOrders.playerId} <> ${playerId}`,
      ),
    )
    .orderBy(o.side === Side.BUY ? asc(marketOrders.price) : desc(marketOrders.price), asc(marketOrders.createdAt), asc(marketOrders.id))
    .limit(50)
    .for('update');
  let remaining = o.amount;
  const fills: { qty: number; price: number; other: OrderRow }[] = [];
  for (const c of counter) {
    if (remaining <= 0) break;
    const qty = Math.min(remaining, c.amount - c.filled);
    remaining -= qty;
    c.filled += qty;
    await ctx.tx.update(marketOrders).set({ filled: c.filled }).where(eq(marketOrders.id, c.id));
    fills.push({ qty, price: c.price, other: c });
  }
  order.filled = o.amount - remaining;

  for (const f of fills) {
    const buyer = o.side === Side.BUY ? { playerId, cityId, orderId: order.id, escrowPrice: price } : { playerId: f.other.playerId, cityId: f.other.cityId, orderId: f.other.id, escrowPrice: f.other.price };
    const seller = o.side === Side.SELL ? { playerId, cityId, orderId: order.id } : { playerId: f.other.playerId, cityId: f.other.cityId, orderId: f.other.id };
    const gold = Math.floor(f.qty * f.price);
    // goods travel to the buyer; the buyer's escrow surplus (bid above the fill price) comes back
    const buyerMarket = buyer.cityId === cityId ? market : await marketLevelOf(ctx, buyer.cityId);
    await ship(ctx, { playerId: buyer.playerId, cityId: buyer.cityId, orderId: buyer.orderId, resType: o.resType, amount: f.qty, price: f.price, ms: shipmentMs(ctx, buyerMarket, buyer.playerId === playerId && fleet) });
    const surplus = escrowGold(f.qty, buyer.escrowPrice) - escrowGold(f.qty, f.price);
    if (surplus > 0) await ship(ctx, { playerId: buyer.playerId, cityId: buyer.cityId, orderId: buyer.orderId, resType: GOLD, amount: surplus, price: 0, ms: 0 });
    await ship(ctx, { playerId: seller.playerId, cityId: seller.cityId, orderId: seller.orderId, resType: GOLD, amount: gold, price: f.price, ms: 0 });
    for (const who of [buyer.playerId, seller.playerId]) {
      ctx.push(who, 'server.TradesUpdate', { resType: o.resType, amount: f.qty, price: f.price });
    }
    await createReport(ctx, {
      playerId: seller.playerId,
      typeId: ReportType.TRADE,
      title: 'Trade Completed',
      body: { kind: 'trade', trade: { side: 'sell', resource: RES_TYPES[o.resType], amount: f.qty, price: f.price, gold } },
    });
    await createReport(ctx, {
      playerId: buyer.playerId,
      typeId: ReportType.TRADE,
      title: 'Trade Completed',
      body: { kind: 'trade', trade: { side: 'buy', resource: RES_TYPES[o.resType], amount: f.qty, price: f.price, gold } },
    });
  }
  // fully filled orders are removed; their counterparts too
  await ctx.tx.execute(sql`delete from market_orders where filled >= amount and id = any(${pgArray([order.id, ...fills.map((f) => f.other.id)])}::int[])`);
  if (order.filled < order.amount) await ctx.tx.update(marketOrders).set({ filled: order.filled }).where(eq(marketOrders.id, order.id));
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  return { order: orderBean(order), filled: order.filled };
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

/** trade.speedUpTrans: instant delivery for cents. */
export async function speedupShipment(ctx: Ctx, playerId: number, shipmentId: number) {
  const [s] = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.id, shipmentId)).for('update');
  if (!s || s.playerId !== playerId) throw new GameError('Shipment not found.', -99, 404);
  const p = await getPlayer(ctx, playerId, { lock: true });
  spendCents(ctx, p, coinsForSpeedup(Math.max(0, s.endTime - ctx.now)));
  await ctx.tx.update(marketShipments).set({ endTime: ctx.now }).where(eq(marketShipments.id, shipmentId));
  ctx.schedule({ type: 'shipment', dueAt: ctx.now, playerId, cityId: s.cityId, refKey: `shipment:${s.id}`, payload: { shipmentId: s.id } });
  await savePlayer(ctx, p);
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
  ctx.push(s.playerId, 'server.TransingTradeUpdate', { id: s.id, delivered: true, resType: s.resType, amount: s.amount, castleId: cityId });
}
