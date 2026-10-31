// (marchlands) NPC trade (docs/features/market-and-factions.md, NPC trade). Faction members trade in groups, the NPC
// cities of one zone and level, so the world's ~20,000 members cost a hundred small records rather than a row each.
// Every game hour a group makes and uses resources (more of what its faction and its land are strong in, more use of
// what its faction is short of, the world balanced overall) and drifts back towards its target, its members' full
// stock. Every tick one auction per resource sets the world price from the world's stock against its target, inside
// the merchant's band, and groups above what they want at that price sell to those below. Players trade with the same
// stock along the same price curve, a little above and below it (factionSells, factionBuys). Groups pay with gold they
// hold: each makes and uses some of its treasury (the members' gold in the NPC table) every game hour and drifts back to
// it, buys in the auction only what its gold pays for, and the factions buy from players only while they have gold.
// Pure: the worker keeps the state in world_state (backend engine/npc-economy.ts).

import { BALANCE, getGameSpeed } from '#/balance.ts';
import { BASIC_RESOURCES, type BasicResource } from '#/constants.ts';
import { FACTION_IDS, type FactionId } from '#/constants.ts';
import { VALLEY_RESOURCE } from '#/economy.ts';
import { factionOfZone } from '#/factions.ts';
import type { Rng } from '#/rng.ts';
import { HOUR } from '#/time.ts';
import { npcTableGold, npcTemplate } from '#/world.ts';

export type Stock = Record<BasicResource, number>;

/** The faction members of one zone and level, alike enough to trade as one. */
export interface NpcGroup {
  zone: number;
  level: number;
  members: number;
}

/** The NPC economy between ticks (world_state 'npc-economy'). */
export interface NpcEconomy {
  /** when the last tick ran, real ms */
  at: number;
  /** the groups as the last tick counted them; players' trades between ticks share their stock out among these */
  groups: NpcGroup[];
  /** each group's stock, by groupKey */
  stock: Record<string, Stock>;
  /** each group's gold, by groupKey (a group not yet in it holds its treasury) */
  gold: Record<string, number>;
  /** each faction's making as a share of normal (1), wandering at random (a faction not yet in it: 1) */
  wander: Partial<Record<FactionId, Stock>>;
  /** each resource's world price after the last tick */
  price: Stock;
  /** each zone's making from its land against the world average (1), by zone */
  land: Stock[];
  /** made-up single trades for the Market page's ticker, newest first */
  ticker: NpcTrade[];
}

/** A made-up single trade between two groups, to show what the factions are doing. */
export interface NpcTrade {
  at: number;
  resource: BasicResource;
  amount: number;
  price: number;
  seller: { zone: number; level: number };
  buyer: { zone: number; level: number };
}

/** One resource's auction in a tick, for its candle. */
export interface NpcAuction {
  open: number;
  close: number;
  /** units that changed hands between groups */
  volume: number;
  /** groups that sold */
  sellers: number;
}

const each = (f: (r: BasicResource) => number): Stock => ({ food: f('food'), wood: f('wood'), stone: f('stone'), iron: f('iron') });
const ONES: Stock = each(() => 1);
const cfg = () => BALANCE.npcTrade;

export const groupKey = (zone: number, level: number) => `${zone}:${level}`;

/** A group's target: its members' full-strength stock. */
export function groupTarget(g: NpcGroup): Stock {
  const full = npcTemplate(g.level).resources;
  return each((r) => full[r] * g.members);
}

/** A group's treasury: its members' gold in the NPC table, which its gold drifts back to. */
export const groupTreasury = (g: NpcGroup) => npcTableGold(g.level) * g.members;

/** The band prices stay in: the merchant's bid and ask around 1.00 (BALANCE.merchant.spread). */
export function priceBand() {
  const half = BALANCE.merchant.spread / 2;
  return { low: 1 - half, high: 1 + half };
}

/** How strongly the price follows stock: the world's stock `edgeShare` short of target puts it at the band's top. */
export function priceExponent(): number {
  return Math.log(priceBand().high) / -Math.log(1 - cfg().edgeShare);
}

/** The world price from the world's target and stock, inside the band. */
export function worldPrice(target: number, stock: number): number {
  const { low, high } = priceBand();
  if (!(stock > 0)) return high;
  return Math.min(high, Math.max(low, (target / stock) ** priceExponent()));
}

/**
 * Each zone's making of each resource from its land: how many of its valleys yield it against the average zone
 * (forest lumber, desert stone, hills iron, swamp, grass and lake food), weighted by BALANCE.npcTrade.landWeight.
 * `valleys` lists the valley tiles by zone and tile type; `zones` is how many zones there are.
 */
export function landFactors(valleys: readonly { zone: number; type: number; count: number }[], zones: number): Stock[] {
  const byZone = Array.from({ length: zones }, () => each(() => 0));
  for (const v of valleys) {
    const z = byZone[v.zone];
    if (!z) continue;
    for (const r of VALLEY_RESOURCE[v.type] ?? []) z[r] += v.count;
  }
  const mean = each((r) => byZone.reduce((s, z) => s + z[r], 0) / Math.max(1, zones));
  const w = cfg().landWeight;
  return byZone.map((z) => each((r) => (mean[r] > 0 ? 1 + w * (z[r] / mean[r] - 1) : 1)));
}

/**
 * Per game hour, what each group makes and uses of each resource, before the wander: a share of its target, more
 * making where its land and its faction's strengths say, more use of its faction's shortages. Each resource's making and
 * use are then scaled so the world makes as much as it uses.
 */
export function groupRates(groups: readonly NpcGroup[], land: readonly Stock[]): { make: Stock; use: Stock; goldMake: number; goldUse: number }[] {
  const { turnover, strength } = cfg();
  const raw = groups.map((g) => {
    const f = factionOfZone(g.zone);
    const base = groupTarget(g);
    const soil = land[g.zone] ?? ONES;
    const treasury = groupTreasury(g) * turnover;
    return {
      make: each((r) => base[r] * turnover * soil[r] * (f?.strong.includes(r) ? 1 + strength : 1)),
      use: each((r) => base[r] * turnover * (f?.short.includes(r) ? 1 + strength : 1)),
      base: each((r) => base[r] * turnover),
      // gold: made faster where the faction is strong in it, used at the same rate everywhere
      goldMake: treasury * (f?.strong.includes('gold') ? 1 + strength : 1),
      goldUse: treasury,
    };
  });
  const total = (pick: (x: (typeof raw)[number]) => Stock) => each((r) => raw.reduce((s, x) => s + pick(x)[r], 0));
  const [base, make, use] = [total((x) => x.base), total((x) => x.make), total((x) => x.use)];
  const scale = (t: Stock) => each((r) => (t[r] > 0 ? base[r] / t[r] : 1));
  const [makeScale, useScale] = [scale(make), scale(use)];
  const sum = (pick: (x: (typeof raw)[number]) => number) => raw.reduce((s, x) => s + pick(x), 0);
  const goldScale = sum((x) => x.goldMake) > 0 ? sum((x) => x.goldUse) / sum((x) => x.goldMake) : 1;
  return raw.map((x) => ({
    make: each((r) => x.make[r] * makeScale[r]),
    use: each((r) => x.use[r] * useScale[r]),
    goldMake: x.goldMake * goldScale,
    goldUse: x.goldUse,
  }));
}

/** A standard normal number (Box–Muller). */
function normal(rng: Rng): number {
  const u = Math.max(rng.next(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.next());
}

/** A fresh economy: every group at its target, prices at 1.00, nothing wandering. */
export function newNpcEconomy(groups: readonly NpcGroup[], land: Stock[], now: number): NpcEconomy {
  return {
    at: now,
    groups: [...groups],
    stock: Object.fromEntries(groups.map((g) => [groupKey(g.zone, g.level), groupTarget(g)])),
    gold: Object.fromEntries(groups.map((g) => [groupKey(g.zone, g.level), groupTreasury(g)])),
    wander: {},
    price: { ...ONES },
    land,
    ticker: [],
  };
}

/** The gold the factions hold between them, and their treasuries'. */
export function worldGold(econ: NpcEconomy, groups: readonly NpcGroup[]) {
  let gold = 0;
  let treasury = 0;
  for (const g of groups) {
    treasury += groupTreasury(g);
    gold += econ.gold[groupKey(g.zone, g.level)] ?? groupTreasury(g);
  }
  return { gold, treasury };
}

/** The world's target and stock of a resource. */
export function worldTotals(econ: NpcEconomy, groups: readonly NpcGroup[], r: BasicResource) {
  let target = 0;
  let stock = 0;
  for (const g of groups) {
    target += groupTarget(g)[r];
    stock += econ.stock[groupKey(g.zone, g.level)]?.[r] ?? groupTarget(g)[r];
  }
  return { target, stock };
}

/**
 * One tick, `now` being real ms: every group makes, uses and drifts back towards its target for the game time since
 * the last tick (at most BALANCE.npcTrade.maxCatchUpMs of real time), each faction's making wanders, and one auction per
 * resource sets the world price and moves goods from groups above what they want to groups below. Groups that are new
 * start at their target; groups gone (their members captured or upgraded away) are dropped. Returns the new economy and
 * each resource's auction.
 */
export function npcTick(econ: NpcEconomy, groups: readonly NpcGroup[], now: number, rng: Rng) {
  const c = cfg();
  const hours = (Math.max(0, Math.min(now - econ.at, c.maxCatchUpMs)) * getGameSpeed()) / HOUR;
  const fade = (halfLifeMs: number) => 0.5 ** ((hours * HOUR) / halfLifeMs);

  // each faction's making wanders around normal and fades back (an Ornstein–Uhlenbeck walk)
  const k = fade(c.wander.halfLifeMs);
  const wander: Partial<Record<FactionId, Stock>> = {};
  for (const id of FACTION_IDS) {
    const w = econ.wander[id] ?? ONES;
    wander[id] = each((r) => Math.max(0, 1 + (w[r] - 1) * k + c.wander.sd * Math.sqrt(1 - k * k) * normal(rng)));
  }

  // making, use and the drift back to target over the elapsed game time
  const restore = fade(c.restoreHalfLifeMs);
  const rates = groupRates(groups, econ.land);
  const rows = groups.map((g, i) => {
    const target = groupTarget(g);
    const rate = rates[i] ?? { make: target, use: target };
    const w = wander[factionOfZone(g.zone)?.id ?? FACTION_IDS[0]] ?? ONES;
    const key = groupKey(g.zone, g.level);
    const was = econ.stock[key] ?? target;
    const stock = each((r) => Math.max(0, target[r] + (was[r] + (rate.make[r] * w[r] - rate.use[r]) * hours - target[r]) * restore));
    const treasury = groupTreasury(g);
    const gold = Math.max(0, treasury + ((econ.gold[key] ?? treasury) + ((rates[i]?.goldMake ?? 0) - (rates[i]?.goldUse ?? 0)) * hours - treasury) * restore);
    return { g, target, stock, gold };
  });

  // one auction per resource: the price from the world's stock, then groups trade towards what they want at it
  const e = priceExponent();
  const auctions = {} as Record<BasicResource, NpcAuction>;
  const price = { ...econ.price };
  const ticker: NpcTrade[] = [];
  for (const r of BASIC_RESOURCES) {
    const target = rows.reduce((sum, row) => sum + row.target[r], 0);
    const held = rows.reduce((sum, row) => sum + row.stock[r], 0);
    const p = worldPrice(target, held);
    // a group buys only as much as its gold pays for
    const want = rows.map((row) => Math.min(c.adjust * (row.target[r] * p ** (-1 / e) - row.stock[r]), row.gold / p));
    // at the band's edge the two sides no longer match: the bigger side trades only as much as the smaller
    const buying = want.reduce((sum, x) => sum + Math.max(0, x), 0);
    const selling = want.reduce((sum, x) => sum + Math.max(0, -x), 0);
    const volume = Math.min(buying, selling);
    const fill = want.map((x) => (x > 0 ? (x * volume) / buying : x < 0 ? (x * volume) / selling : 0));
    // goods one way, gold the other: buyers pay sellers at the auction's price
    rows.forEach((row, i) => {
      const x = fill[i] ?? 0;
      row.stock[r] = Math.max(0, row.stock[r] + x);
      row.gold = Math.max(0, row.gold - x * p);
    });
    auctions[r] = { open: econ.price[r], close: p, volume: Math.floor(volume), sellers: fill.filter((x) => x < 0).length };
    price[r] = p;
    ticker.push(...madeUpTrades(groups, fill, r, p, now, rng));
  }
  const stock = Object.fromEntries(rows.map((row) => [groupKey(row.g.zone, row.g.level), row.stock]));
  const gold = Object.fromEntries(rows.map((row) => [groupKey(row.g.zone, row.g.level), row.gold]));
  const next: NpcEconomy = { ...econ, at: now, groups: [...groups], stock, gold, wander, price, ticker: [...ticker, ...econ.ticker].slice(0, c.ticker.keep) };
  return { econ: next, auctions };
}

/** Up to `n` of `items` picked at random, each at most once, in the order picked. */
function pickSome<T>(items: readonly T[], n: number, rng: Rng): T[] {
  const left = [...items];
  const picked: T[] = [];
  while (picked.length < n && left.length > 0) {
    const [item] = left.splice(Math.floor(rng.next() * left.length), 1);
    if (item !== undefined) picked.push(item);
  }
  return picked;
}

/**
 * A tick's trades in a resource as a few single trades for the ticker: sellers picked at random among the groups that
 * sold, each paired with a buyer picked at random among those that bought, so every level and zone shows up, not only
 * the biggest. Each trade is as much as both really traded.
 */
function madeUpTrades(groups: readonly NpcGroup[], fill: number[], resource: BasicResource, price: number, at: number, rng: Rng): NpcTrade[] {
  const traded = (sign: 1 | -1) => groups.map((g, i) => ({ g, x: (fill[i] ?? 0) * sign })).filter((v) => v.x >= 1);
  const [sellers, buyers] = [traded(-1), traded(1)];
  const n = cfg().ticker.perResource;
  const picked = pickSome(buyers, n, rng);
  return pickSome(sellers, n, rng).flatMap((s, i) => {
    const b = picked[i % Math.max(1, picked.length)];
    if (!b) return [];
    return [
      {
        at,
        resource,
        amount: Math.floor(Math.min(s.x, b.x)),
        price,
        seller: { zone: s.g.zone, level: s.g.level },
        buyer: { zone: b.g.zone, level: b.g.level },
      },
    ];
  });
}

// ---------------------------------------------------------------------------------------------
// Players trading with the factions: along the auction's price curve over the world's stock, the factions selling a
// little above it and buying a little below, never past the band's edge. The spread is BALANCE.npcTrade.playerSpread,
// or what the player's standing with the city's home faction makes it (reputation.ts, factionSpread).
// ---------------------------------------------------------------------------------------------

/** What the factions charge or pay at a world stock: the curve's price (unclamped) ± half the player's spread. */
export function factionMarginal(target: number, stock: number, side: 'buy' | 'sell', spread: number = cfg().playerSpread): number {
  const p = stock > 0 ? (target / stock) ** priceExponent() : Infinity;
  const half = spread / 2;
  return side === 'buy' ? p * (1 + half) : p * (1 - half);
}

/** ∫ (target / s)^e ds from `low` to `high` (both > 0): the gold for the units between two stocks at the curve's price. */
function curveGold(target: number, low: number, high: number): number {
  const e = priceExponent();
  // high^(1-e) - low^(1-e), written so a small step keeps its precision
  const diff = -(high ** (1 - e)) * Math.expm1((1 - e) * Math.log(low / high));
  return (target ** e * diff) / (1 - e);
}

export interface FactionFill {
  qty: number;
  /** gold for the units, before the buyer's fee */
  gold: number;
}

/**
 * The factions sell up to `qty` units to a player, while their price stays at most `limit` and inside the band
 * (Infinity: up to the band). `target` and `stock` are the world's.
 */
export function factionSells(target: number, stock: number, qty: number, limit = Infinity, spread: number = cfg().playerSpread): FactionFill {
  const half = spread / 2;
  const bound = Math.min(limit, priceBand().high) / (1 + half);
  // the stock at which their price reaches the bound
  const lowest = target * bound ** (-1 / priceExponent());
  const q = Math.max(0, Math.min(qty, Math.floor(stock - lowest)));
  return { qty: q, gold: q > 0 ? (1 + half) * curveGold(target, stock - q, stock) : 0 };
}

/**
 * The factions buy up to `qty` units from a player, while their price stays at least `limit` and inside the band, and
 * for at most `budget` gold (what they hold).
 */
export function factionBuys(target: number, stock: number, qty: number, limit = 0, budget = Infinity, spread: number = cfg().playerSpread): FactionFill {
  const half = spread / 2;
  const e = priceExponent();
  const bound = Math.max(limit, priceBand().low) / (1 - half);
  const highest = target * bound ** (-1 / e);
  // the units `budget` pays for: curveGold solved for its upper stock
  const paid = Number.isFinite(budget) ? (stock ** (1 - e) + (Math.max(0, budget) * (1 - e)) / ((1 - half) * target ** e)) ** (1 / (1 - e)) - stock : Infinity;
  const q = Math.max(0, Math.min(qty, Math.floor(highest - stock), Math.floor(paid)));
  return { qty: q, gold: q > 0 ? (1 - half) * curveGold(target, stock, stock + q) : 0 };
}

/**
 * Units the factions sell for `gold`, each costing its price × `feeFactor`, as far as the band allows: found by halving,
 * since the price rises with every unit.
 */
export function factionAffordable(target: number, stock: number, gold: number, feeFactor: number): number {
  let [lo, hi] = [0, factionSells(target, stock, Number.MAX_SAFE_INTEGER).qty];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (factionSells(target, stock, mid).gold * feeFactor <= gold) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/** A player bought `qty` of a resource for `gold`: each group gives its share of the goods, in proportion to what it holds, and gets that share of the gold. */
export function takeFromGroups(econ: NpcEconomy, groups: readonly NpcGroup[], r: BasicResource, qty: number, gold: number): NpcEconomy {
  const { stock: held } = worldTotals(econ, groups, r);
  return moveStock(econ, groups, r, (_g, s) => {
    const share = held > 0 ? s / held : 0;
    return { goods: -qty * share, gold: gold * share };
  });
}

/** A player sold `qty` of a resource for `gold`: the groups take the goods in proportion to their targets, and pay in proportion to the gold each holds. */
export function giveToGroups(econ: NpcEconomy, groups: readonly NpcGroup[], r: BasicResource, qty: number, gold: number): NpcEconomy {
  const { target } = worldTotals(econ, groups, r);
  const { gold: held } = worldGold(econ, groups);
  return moveStock(econ, groups, r, (g, _s, has) => ({
    goods: target > 0 ? qty * (groupTarget(g)[r] / target) : 0,
    gold: held > 0 ? -gold * (has / held) : 0,
  }));
}

/** Lowers one group's stock by what players took from a member city (plunder). */
export function plunderGroup(econ: NpcEconomy, g: NpcGroup, taken: Partial<Stock>): NpcEconomy {
  const key = groupKey(g.zone, g.level);
  const s = econ.stock[key] ?? groupTarget(g);
  return { ...econ, stock: { ...econ.stock, [key]: each((r) => Math.max(0, s[r] - (taken[r] ?? 0))) } };
}

/** Moves goods and gold for each group: `delta` gets the group, its stock of the resource and its gold. */
function moveStock(
  econ: NpcEconomy,
  groups: readonly NpcGroup[],
  r: BasicResource,
  delta: (g: NpcGroup, held: number, gold: number) => { goods: number; gold: number },
): NpcEconomy {
  const stock = { ...econ.stock };
  const gold = { ...econ.gold };
  for (const g of groups) {
    const key = groupKey(g.zone, g.level);
    const s = stock[key] ?? groupTarget(g);
    const has = gold[key] ?? groupTreasury(g);
    const d = delta(g, s[r], has);
    stock[key] = { ...s, [r]: Math.max(0, s[r] + d.goods) };
    gold[key] = Math.max(0, has + d.gold);
  }
  return { ...econ, stock, gold };
}
