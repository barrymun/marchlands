// trade.* — Marketplace (food/wood/stone/iron for gold). The original kept food orders only,
// had no escrow and never matched. Marchlands:
// - an order book with escrow, matched at the resting order's price (price-time priority);
// - a computer merchant (core/merchant.ts) that always buys and sells, so every order can fill;
// - (marchlands) the NPC factions (core/npc-economy.ts), selling from and buying into their shared stock along their
//   price curve, between players' orders and the merchant;
// - instant settlement: the lord placing the order is paid in the same transaction; a lord whose
//   resting order is hit is paid through a zero-time shipment (so no other city is locked here);
// - a 0.5% fee on the buyer's gold, and a log of completed trades (market_trades) for history.

import { and, asc, desc, eq, gte, lte, or, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BASIC_RESOURCES,
  type BasicResource,
  buildingLevel,
  BuildingType,
  CANDLE_PERIOD_MS,
  CandlePeriod,
  DAY,
  factionBuys,
  factionMarginal,
  factionSells,
  GameError,
  ref as gameRef,
  giveToGroups,
  goldForSpeedup,
  MarketSide,
  merchantAsk,
  merchantBase,
  merchantBid,
  merchantBuys,
  merchantMarginal,
  merchantReference,
  merchantSells,
  type MerchantState,
  msg,
  type NpcEconomy,
  priceBand,
  ReportType,
  scaled,
  takeFromGroups,
  worldGold,
  worldPrice,
  worldTotals,
} from '@marchlands/core';
import { marketCandles, marketOrders, marketShipments, marketTrades, one, pgArray, worldState } from '@marchlands/db';

import { openOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { basicResource, escrowGold, GOLD, loadMerchant, logTrade, MERCHANT_KEY, resKey, ship, tradeStat, withFee, WORLD_SCOPE } from '#/engine/market.ts';
import { loadNpcEconomy, saveNpcEconomy } from '#/engine/npc-economy.ts';
import { createReport } from '#/engine/reports.ts';
import { gainResources, pushResources, spendGold } from '#/helpers.ts';
import { saveCity } from '#/repo.ts';

type OrderRow = typeof marketOrders.$inferSelect;

const roundPrice = (p: number) => Math.round(p * 1000) / 1000;
/** The most units one order may trade. */
const MAX_ORDER = 1e10;

function orderBean(o: OrderRow) {
  return {
    id: o.id,
    resType: o.resType,
    resourceName: basicResource(o.resType),
    tradeType: o.side,
    price: o.price,
    amount: o.amount,
    dealedTotal: o.filled,
    createdAt: o.createdAt,
    cityId: o.cityId,
  };
}

function assertResType(resType: number): BasicResource {
  // any other number, fractions included, finds nothing
  const res = BASIC_RESOURCES[resType];
  if (res === undefined) throw new GameError(msg('market.invalidResource'), -99);
  return res;
}

function merchantQuoteBean(res: BasicResource, state: Partial<MerchantState>, now: number) {
  const reference = merchantReference(res, state[res], now);
  return { reference, base: merchantBase(res), bid: merchantBid(reference), ask: merchantAsk(reference) };
}

// ---------------------------------------------------------------------------------------------
// Matching plan (shared by orders and quotes)
// ---------------------------------------------------------------------------------------------

/** Who is on the other side of a fill. */
type Source = 'player' | 'factions' | 'merchant';

interface Fill {
  qty: number;
  /** gold for the fill before the buyer's fee (fractional for merchant and faction fills) */
  gold: number;
  source: Source;
  /** the resting order hit, for a player's fill */
  other: OrderRow | null;
}

/** The factions' world target and stock of the resource traded and the gold they hold, when they trade yet. */
type NpcSide = { target: number; stock: number; gold: number } | null;

/**
 * Walks the opposite side of the book, the factions' price curve and the merchant's price, always taking the best price
 * (players first on a tie, then the factions, then the merchant). `limit` is the worst acceptable price: Infinity / 0
 * for market orders. `offers` are resting orders sorted best price first, then oldest.
 */
function planFills(side: number, qty: number, limit: number, offers: OrderRow[], ref: number, npc: NpcSide) {
  const buy = side === MarketSide.BUY;
  const better = (a: number, b: number) => (buy ? a <= b : a >= b);
  const fills: Fill[] = [];
  let remaining = qty;
  let r = ref;
  let npcStock = npc?.stock ?? 0;
  // what the factions can still pay players selling to them
  let npcGold = npc?.gold ?? 0;
  let i = 0;
  const playerFill = (o: OrderRow) => {
    const q = Math.min(remaining, o.amount - o.filled - used(fills, o));
    fills.push({ qty: q, gold: q * o.price, source: 'player', other: o });
    remaining -= q;
  };
  for (let guard = 0; remaining > 0 && guard < 10_000; guard++) {
    // skip the resting orders this trade has already used up
    for (; i < offers.length; i++) {
      const x = offers[i];
      if (x && x.amount - x.filled - used(fills, x) > 0) break;
    }
    const o = offers[i];
    const playerOk = !!o && better(o.price, limit);
    const merchant = merchantMarginal(r, buy ? 'buy' : 'sell');
    const factions = npc ? factionMarginal(npc.target, npcStock, buy ? 'buy' : 'sell') : null;
    if (playerOk && better(o.price, merchant) && (factions == null || better(o.price, factions))) {
      playerFill(o);
      continue;
    }
    // the factions, up to the next resting order's price, the merchant's or the limit
    if (npc) {
      const bound = buy ? Math.min(limit, playerOk ? o.price : Infinity, merchant) : Math.max(limit, playerOk ? o.price : 0, merchant);
      const f = buy ? factionSells(npc.target, npcStock, remaining, bound) : factionBuys(npc.target, npcStock, remaining, bound, npcGold);
      if (f.qty > 0) {
        fills.push({ qty: f.qty, gold: f.gold, source: 'factions', other: null });
        remaining -= f.qty;
        npcStock += buy ? -f.qty : f.qty;
        npcGold += buy ? f.gold : -f.gold;
        continue;
      }
    }
    // the merchant, up to the next resting order's price (or the limit)
    const bound = buy ? Math.min(limit, playerOk ? o.price : Infinity) : Math.max(limit, playerOk ? o.price : 0);
    const f = buy ? merchantSells(r, remaining, bound) : merchantBuys(r, remaining, bound);
    if (f.qty > 0) {
      fills.push({ qty: f.qty, gold: f.gold, source: 'merchant', other: null });
      remaining -= f.qty;
      r = f.ref;
    } else if (playerOk) playerFill(o);
    else break;
  }
  // merge consecutive fills from the factions, or from the merchant
  const merged: Fill[] = [];
  for (const f of fills) {
    const last = merged[merged.length - 1];
    if (last && !last.other && !f.other && last.source === f.source) Object.assign(last, { qty: last.qty + f.qty, gold: last.gold + f.gold });
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
  const buy = side === MarketSide.BUY;
  const q = ctx.tx
    .select()
    .from(marketOrders)
    .where(
      and(
        eq(marketOrders.resType, resType),
        eq(marketOrders.side, buy ? MarketSide.SELL : MarketSide.BUY),
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
  if (o.side !== MarketSide.BUY && o.side !== MarketSide.SELL) throw new GameError(msg('market.invalidSide'), -99);
  if (!Number.isInteger(o.amount) || o.amount < 1 || o.amount > MAX_ORDER) throw new GameError(msg('common.invalidAmount'), -99);
  const market = o.type === 'market';
  let price = 0;
  if (!market) {
    price = roundPrice(Number(o.price));
    if (!(price >= 0.001 && price <= 1e6)) throw new GameError(msg('market.invalidPrice'), -99);
  }
  const limit = market ? (o.side === MarketSide.BUY ? Infinity : 0) : price;
  return { res, market, price, limit };
}

function summarise(side: number, plan: ReturnType<typeof planFills>, rest: number, price: number) {
  const fillGold = plan.fills.reduce((s, f) => s + f.gold, 0);
  const filledBy = (source: Source) => plan.fills.filter((f) => f.source === source).reduce((s, f) => s + f.qty, 0);
  const merchantFilled = filledBy('merchant');
  const factionsFilled = filledBy('factions');
  const gold = side === MarketSide.BUY ? withFee(fillGold) : Math.floor(fillGold);
  return {
    filled: plan.filled,
    avgPrice: plan.filled > 0 ? fillGold / plan.filled : null,
    gold,
    fee: side === MarketSide.BUY ? gold - Math.ceil(fillGold) : 0,
    merchantFilled,
    factionsFilled,
    playerFilled: plan.filled - merchantFilled - factionsFilled,
    rest,
    escrow: rest > 0 ? (side === MarketSide.BUY ? escrowGold(rest, price) : rest) : 0,
  };
}

/** The factions' world target and stock of a resource, or null before their first tick. */
const npcSide = (econ: NpcEconomy | null, res: BasicResource): NpcSide =>
  econ ? { ...worldTotals(econ, econ.groups, res), gold: worldGold(econ, econ.groups).gold } : null;

/** Price steps shown for the factions in the book: each a share of the band between their price and its edge. */
const FACTION_STEPS = 5;

/**
 * The factions' quotes on a resource: their price on the curve, what they sell at and buy at (null past the band's edge),
 * how much they sell and buy before it, and that depth in a few price steps for the book and its chart.
 */
function factionsBean(npc: NpcSide) {
  if (!npc) return null;
  const { target, stock } = npc;
  const { low, high } = priceBand();
  const ask = factionMarginal(target, stock, 'buy');
  const bid = factionMarginal(target, stock, 'sell');
  const steps = (from: number, to: number, depth: (limit: number) => number) => {
    const levels: { price: number; amount: number }[] = [];
    let before = 0;
    for (let k = 1; k <= FACTION_STEPS; k++) {
      const price = roundPrice(from + ((to - from) * k) / FACTION_STEPS);
      const total = depth(price);
      if (total > before) levels.push({ price, amount: total - before });
      before = total;
    }
    return levels;
  };
  const sellers = ask <= high ? steps(ask, high, (p) => factionSells(target, stock, Number.MAX_SAFE_INTEGER, p).qty) : [];
  // what they buy is also what their gold pays for
  const buyers = bid >= low ? steps(bid, low, (p) => factionBuys(target, stock, Number.MAX_SAFE_INTEGER, p, npc.gold).qty) : [];
  return {
    price: worldPrice(target, stock),
    ask: ask <= high ? ask : null,
    bid: bid >= low ? bid : null,
    sells: sellers.reduce((s, l) => s + l.amount, 0),
    buys: buyers.reduce((s, l) => s + l.amount, 0),
    sellers,
    buyers,
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
  const buyers = await level(MarketSide.BUY, 'desc');
  const sellers = await level(MarketSide.SELL, 'asc');
  const conv = (r: { price: number; amount: number }) => ({ price: Number(r.price), amount: Number(r.amount) });
  const merchant = merchantQuoteBean(res, await loadMerchant(ctx, false), ctx.now);
  const factions = factionsBean(npcSide(await loadNpcEconomy(ctx, false), res));
  return { resType, buyers: buyers.rows.map(conv), sellers: sellers.rows.map(conv), merchant, factions };
}

/** What an order would do right now (no side effects). */
export async function quote(ctx: Ctx, playerId: number, o: OrderInput) {
  const { res, market, price, limit } = normalise(o);
  const ref = merchantReference(res, (await loadMerchant(ctx, false))[res], ctx.now);
  const npc = npcSide(await loadNpcEconomy(ctx, false), res);
  const offers = await restingOffers(ctx, o.resType, o.side, limit, playerId, false);
  const plan = planFills(o.side, o.amount, limit, offers, ref, npc);
  return summarise(o.side, plan, market ? 0 : o.amount - plan.filled, price);
}

/**
 * The most units `gold` buys right now with an instant order, the buyer's fee included: against other players' offers,
 * the factions and the merchant, cheapest first, as placing the order would. What "all my gold" buys.
 */
export async function affordable(ctx: Ctx, playerId: number, resType: number, gold: number) {
  const res = assertResType(resType);
  const ref = merchantReference(res, (await loadMerchant(ctx, false))[res], ctx.now);
  const npc = npcSide(await loadNpcEconomy(ctx, false), res);
  const offers = await restingOffers(ctx, resType, MarketSide.BUY, Infinity, playerId, false);
  const cost = (qty: number) => summarise(MarketSide.BUY, planFills(MarketSide.BUY, qty, Infinity, offers, ref, npc), 0, 0);
  // no unit costs less than the cheapest price on offer now, which bounds the search
  const cheapest = Math.min(offers[0]?.price ?? Infinity, npc ? factionMarginal(npc.target, npc.stock, 'buy') : Infinity, merchantMarginal(ref, 'buy'));
  let [lo, hi] = [0, Math.min(MAX_ORDER, Math.floor(gold / cheapest))];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const s = cost(mid);
    if (s.filled === mid && s.gold <= gold) lo = mid;
    else hi = mid - 1;
  }
  return { amount: lo };
}

/**
 * Every resource's market at a glance: its price now (the factions' world price, or the merchant's before they trade),
 * the merchant's quotes, and its last day from the hourly candles (null when nothing traded in it).
 */
export async function summary(ctx: Ctx) {
  const merchant = await loadMerchant(ctx, false);
  const econ = await loadNpcEconomy(ctx, false);
  const days = await ctx.tx.execute<{ res_type: number; open: number; high: number; low: number; volume: string }>(sql`
    select res_type, (array_agg(open order by start))[1] as open, max(high) as high, min(low) as low, sum(volume)::bigint as volume
    from market_candles where scope = ${WORLD_SCOPE} and period = ${CandlePeriod.HOUR} and start > ${ctx.now - DAY}
    group by res_type`);
  return BASIC_RESOURCES.map((res, resType) => {
    const quote = merchantQuoteBean(res, merchant, ctx.now);
    const npc = npcSide(econ, res);
    const day = days.rows.find((d) => Number(d.res_type) === resType);
    return {
      resType,
      price: npc ? worldPrice(npc.target, npc.stock) : quote.reference,
      merchant: quote,
      day: day ? { open: Number(day.open), high: Number(day.high), low: Number(day.low), volume: Number(day.volume) } : null,
    };
  });
}

/** The player's latest trades, newest first, from their side: what they bought or sold, with whom, at what price. */
export async function myTrades(ctx: Ctx, playerId: number, limit = 50) {
  const rows = await ctx.tx
    .select()
    .from(marketTrades)
    .where(or(eq(marketTrades.buyerPlayerId, playerId), eq(marketTrades.sellerPlayerId, playerId)))
    .orderBy(desc(marketTrades.createdAt), desc(marketTrades.id))
    .limit(limit);
  return rows.map((t) => {
    const bought = t.buyerPlayerId === playerId;
    const other = bought ? t.sellerPlayerId : t.buyerPlayerId;
    return {
      id: t.id,
      resType: t.resType,
      side: bought ? MarketSide.BUY : MarketSide.SELL,
      price: t.price,
      amount: t.amount,
      gold: t.gold,
      with: t.npc ? ('factions' as const) : other == null ? ('merchant' as const) : ('player' as const),
      createdAt: t.createdAt,
    };
  });
}

/** Recent trades and the world's latest `limit` price candles of one `period` (real time), oldest first. */
export async function history(ctx: Ctx, resType: number, period: CandlePeriod = CandlePeriod.HOUR, limit = 500) {
  const res = assertResType(resType);
  const c = marketCandles;
  const rows = await ctx.tx
    .select()
    .from(c)
    .where(and(eq(c.resType, resType), eq(c.scope, WORLD_SCOPE), eq(c.period, period)))
    .orderBy(desc(c.start))
    .limit(limit);
  const candles = rows.reverse().map((r) => ({ t: r.start, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }));
  const recent = await ctx.tx
    .select()
    .from(marketTrades)
    .where(eq(marketTrades.resType, resType))
    .orderBy(desc(marketTrades.createdAt), desc(marketTrades.id))
    .limit(30);
  return {
    resType,
    period,
    bucketMs: CANDLE_PERIOD_MS[period],
    merchant: merchantQuoteBean(res, await loadMerchant(ctx, false), ctx.now),
    candles,
    trades: recent.map((t) => ({
      id: t.id,
      price: t.price,
      amount: t.amount,
      gold: t.gold,
      takerSide: t.takerSide,
      merchant: !t.npc && (t.buyerPlayerId == null || t.sellerPlayerId == null),
      factions: t.npc,
      createdAt: t.createdAt,
    })),
    ticker: ((await loadNpcEconomy(ctx, false))?.ticker ?? []).filter((x) => x.resource === res),
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

// ---------------------------------------------------------------------------------------------
// Placing an order
// ---------------------------------------------------------------------------------------------

/** trade.newTrade */
export async function placeOrder(ctx: Ctx, playerId: number, cityId: number, o: OrderInput) {
  const { res, market, price, limit } = normalise(o);
  const b = await openOwnCity(ctx, playerId, cityId);
  const marketLevel = buildingLevel(b.city.buildings, BuildingType.MARKETPLACE);
  if (marketLevel < 1) throw new GameError(msg('market.needMarketplace', { building: gameRef.building(BuildingType.MARKETPLACE) }), -99);
  const buy = o.side === MarketSide.BUY;

  const merchantState = await loadMerchant(ctx, true);
  const ref = merchantReference(res, merchantState[res], ctx.now);
  const econ = await loadNpcEconomy(ctx, true);
  const offers = await restingOffers(ctx, o.resType, o.side, limit, playerId, true);
  const plan = planFills(o.side, o.amount, limit, offers, ref, npcSide(econ, res));
  const rest = market ? 0 : o.amount - plan.filled;
  if (market && plan.filled === 0) throw new GameError(msg('market.nothingToTrade'), -99);
  const sum = summarise(o.side, plan, rest, price);

  if (rest > 0) {
    const open = await ctx.tx.select({ id: marketOrders.id }).from(marketOrders).where(eq(marketOrders.cityId, cityId));
    if (open.length >= marketLevel * BALANCE.marketMaxOrdersPerLevel)
      throw new GameError(msg('market.tooManyOrders', { building: gameRef.building(BuildingType.MARKETPLACE) }), -99);
  }
  // pay up front: the buyer's gold for the fills (with fee) plus escrow for the rest; the seller's goods
  if (buy) {
    const need = sum.gold + sum.escrow;
    if (b.city.gold < need) throw new GameError(msg('common.notEnoughGoldFor', { amount: need }), -99);
    b.city.gold -= need;
    b.city[res] += plan.filled;
  } else {
    const goods = plan.filled + rest;
    if (b.city[res] < goods) throw new GameError(msg('market.notEnoughResource', { resource: gameRef.resource(res) }), -99);
    b.city[res] -= goods;
    b.city.gold += sum.gold;
  }

  // counterparties: resting orders are updated and their owners paid by zero-time shipments
  for (const f of plan.fills) {
    const gold = Math.floor(f.gold);
    await logTrade(ctx, {
      resType: o.resType,
      price: f.gold / f.qty,
      amount: f.qty,
      gold,
      takerSide: o.side,
      buyerPlayerId: buy ? playerId : (f.other?.playerId ?? null),
      sellerPlayerId: buy ? (f.other?.playerId ?? null) : playerId,
      npc: f.source === 'factions',
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
      title: msg('report.title.tradeCompleted'),
      body: { kind: 'trade', trade: { side: buy ? 'sell' : 'buy', resource: res, amount: f.qty, price: other.price, gold } },
    });
  }
  const hit = plan.fills.flatMap((f) => (f.other ? [f.other.id] : []));
  if (hit.length) await ctx.tx.execute(sql`delete from market_orders where filled >= amount and id = any(${pgArray(hit)}::int[])`);

  // the factions' stock: what they sold leaves it, what they bought joins it
  if (econ && sum.factionsFilled > 0) {
    const move = buy ? takeFromGroups : giveToGroups;
    const paid = plan.fills.filter((f) => f.source === 'factions').reduce((s, f) => s + f.gold, 0);
    await saveNpcEconomy(ctx, move(econ, econ.groups, res, sum.factionsFilled, paid));
  }
  if (sum.merchantFilled > 0) {
    const value = { ...merchantState, [res]: { price: plan.ref, at: ctx.now } };
    await ctx.tx.update(worldState).set({ value, updatedAt: ctx.now }).where(eq(worldState.key, MERCHANT_KEY));
  }

  let order: OrderRow | null = null;
  if (rest > 0) {
    order = one(
      await ctx.tx
        .insert(marketOrders)
        .values({ playerId, cityId, resType: o.resType, side: o.side, price, amount: o.amount, filled: plan.filled, createdAt: ctx.now })
        .returning(),
    );
  }
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  // the book or the prices moved: open market screens refresh
  ctx.broadcast(PushCmd.MARKET_UPDATE, { resTypes: [o.resType] });
  return { ...sum, order: order ? orderBean(order) : null };
}

async function marketLevelOf(ctx: Ctx, cityId: number) {
  const rows = await ctx.tx.execute<{ buildings: { typeId: number; level: number }[] }>(sql`select buildings from cities where id = ${cityId}`);
  return buildingLevel((rows.rows[0]?.buildings ?? []) as never, BuildingType.MARKETPLACE);
}

/** trade.cancelTrade: escrow for the unfilled part is returned. */
export async function cancelOrder(ctx: Ctx, playerId: number, orderId: number) {
  const [peek] = await ctx.tx.select().from(marketOrders).where(eq(marketOrders.id, orderId));
  if (!peek || peek.playerId !== playerId) throw new GameError(msg('market.orderNotFound'), -99, 404);
  const b = await openOwnCity(ctx, playerId, peek.cityId);
  const [o] = await ctx.tx.select().from(marketOrders).where(eq(marketOrders.id, orderId)).for('update');
  if (!o) throw new GameError(msg('market.orderNotFound'), -99, 404);
  const left = o.amount - o.filled;
  if (o.side === MarketSide.BUY) gainResources(b.city, { gold: escrowGold(left, o.price) });
  else gainResources(b.city, { [basicResource(o.resType)]: left });
  await ctx.tx.delete(marketOrders).where(eq(marketOrders.id, orderId));
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  ctx.broadcast(PushCmd.MARKET_UPDATE, { resTypes: [o.resType] });
}

/** trade.speedUpTrans: instant delivery, paid with the receiving city's gold (orig: cents). */
export async function speedupShipment(ctx: Ctx, playerId: number, shipmentId: number) {
  const [s] = await ctx.tx.select().from(marketShipments).where(eq(marketShipments.id, shipmentId)).for('update');
  if (!s || s.playerId !== playerId) throw new GameError(msg('market.shipmentNotFound'), -99, 404);
  const b = await openOwnCity(ctx, playerId, s.cityId);
  const gold = goldForSpeedup(Math.max(0, s.endTime - ctx.now));
  spendGold(b.city, gold);
  ctx.stat(playerId, s.cityId, { 'spent.speedups.gold': gold });
  await ctx.tx.update(marketShipments).set({ endTime: ctx.now }).where(eq(marketShipments.id, shipmentId));
  ctx.schedule({ type: 'shipment', dueAt: ctx.now, playerId, cityId: s.cityId, refKey: `shipment:${s.id}`, payload: { shipmentId: s.id } });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}
