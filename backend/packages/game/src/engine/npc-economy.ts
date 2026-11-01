// (marchlands) The NPC economy's state and its tick (core's npc-economy.ts has the rules). The state is one
// world_state row; the groups are counted from the map each tick (members upgraded or captured change them); each
// zone's land is counted once, when the state is first made. A tick adds the factions' auction to the price candles,
// and the factions then fill players' resting orders their new price has crossed, at the spread each order's city gets
// (engine/reputation.ts).

import { eq, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BASIC_RESOURCES,
  factionBuys,
  factionMarginal,
  factionSells,
  giveToGroups,
  landFactors,
  MarketSide,
  newNpcEconomy,
  type NpcEconomy,
  npcFaction,
  type NpcGroup,
  npcTick,
  plunderGroup,
  seededRng,
  stateOf,
  stateTribute,
  type Stock,
  takeFromGroups,
  TileType,
  VALLEY_TYPES,
  worldGold,
  worldTotals,
} from '@marchlands/core';
import { worldState } from '@marchlands/db';

import { openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { addToCandles, crossedOrders, settleResting } from '#/engine/market.ts';
import { cityTerms, tradedWithFactions } from '#/engine/reputation.ts';
import { type StateRuler, stateRulers } from '#/engine/seats.ts';
import { getCity, saveCity } from '#/repo.ts';

const NPC_ECONOMY_KEY = 'npc-economy';

/** A tile's zone, in SQL (stateOf). */
function zoneSql() {
  const size = BALANCE.mapSize;
  const cell = size / BALANCE.stateGrid;
  return sql<number>`(id / ${size} / ${cell}) * ${BALANCE.stateGrid} + (id % ${size}) / ${cell}`;
}

/** The faction members by zone and level: NPC cities from the faction level up that no player has captured. */
export async function npcGroups(ctx: Ctx): Promise<NpcGroup[]> {
  const rows = await ctx.tx.execute<{ zone: number; level: number; members: number }>(sql`
    select ${zoneSql()} as zone, level, count(*)::int as members from tiles
    where type = ${TileType.NPC} and level >= ${BALANCE.factions.minLevel} and owner_city_id is null
    group by 1, 2 order by 1, 2`);
  return rows.rows.map((r) => ({ zone: Number(r.zone), level: Number(r.level), members: Number(r.members) }));
}

/** Each zone's land, from its valleys (core landFactors). */
async function zoneLand(ctx: Ctx): Promise<Stock[]> {
  const types = VALLEY_TYPES.filter((t) => t !== TileType.FLAT);
  const rows = await ctx.tx.execute<{ zone: number; type: number; count: number }>(sql`
    select ${zoneSql()} as zone, type, count(*)::int as count from tiles
    where type in (${sql.join(types, sql`, `)}) group by 1, 2`);
  return landFactors(
    rows.rows.map((r) => ({ zone: Number(r.zone), type: Number(r.type), count: Number(r.count) })),
    BALANCE.stateGrid ** 2,
  );
}

/** The economy's state, locked for this transaction when `lock` (concurrent ticks and trades then queue on it); null before the first tick. */
export async function loadNpcEconomy(ctx: Ctx, lock: boolean): Promise<NpcEconomy | null> {
  const q = ctx.tx.select().from(worldState).where(eq(worldState.key, NPC_ECONOMY_KEY));
  const [row] = lock ? await q.for('update') : await q;
  if (!row) return null;
  // state saved before the factions held gold has none yet: every group starts at its treasury
  const saved = row.value as Omit<NpcEconomy, 'gold'> & Partial<Pick<NpcEconomy, 'gold'>>;
  return { ...saved, gold: saved.gold ?? {} };
}

export async function saveNpcEconomy(ctx: Ctx, econ: NpcEconomy) {
  await ctx.tx
    .insert(worldState)
    .values({ key: NPC_ECONOMY_KEY, value: econ, updatedAt: ctx.now })
    .onConflictDoUpdate({ target: worldState.key, set: { value: econ, updatedAt: ctx.now } });
}

/**
 * One tick of the factions' trade (run by the worker every BALANCE.npcTrade.tickMs): the first makes the state, every
 * group at its target. Each resource's auction goes into the price candles. Seeded by the tick's time, so a tick can be
 * re-run.
 */
export async function npcTradeTick(ctx: Ctx) {
  // (marchlands) a state a player rules (its capital held) is cut off: its members don't trade, and pay its ruler instead
  const all = await npcGroups(ctx);
  const rulers = await stateRulers(ctx);
  await payStateTributes(ctx, rulers, all);
  const groups = all.filter((g) => !rulers.has(g.zone));
  const was = await loadNpcEconomy(ctx, true);
  if (!was) {
    await saveNpcEconomy(ctx, newNpcEconomy(groups, await zoneLand(ctx), ctx.now));
    ctx.broadcast(PushCmd.MARKET_UPDATE, { resTypes: [...BASIC_RESOURCES.keys()] });
    return;
  }
  const { econ: ticked, auctions } = npcTick(was, groups, ctx.now, seededRng(`npc:${ctx.now}`));
  const econ = await npcSweep(ctx, ticked);
  await saveNpcEconomy(ctx, econ);
  for (const [resType, r] of BASIC_RESOURCES.entries()) {
    const a = auctions[r];
    if (a.volume <= 0) continue;
    await addToCandles(ctx, resType, {
      open: a.open,
      high: Math.max(a.open, a.close),
      low: Math.min(a.open, a.close),
      close: a.close,
      volume: a.volume,
      gold: Math.floor(a.volume * a.close),
      trades: a.sellers,
    });
  }
  // every market moved: open market screens refresh
  ctx.broadcast(PushCmd.MARKET_UPDATE, { resTypes: [...BASIC_RESOURCES.keys()] });
}

/** Sets each ruled state's capital's tribute from its members now (core stateTribute), settling the capital first. */
async function payStateTributes(ctx: Ctx, rulers: ReadonlyMap<number, StateRuler>, groups: readonly NpcGroup[]) {
  for (const r of rulers.values()) {
    const tribute = Math.round(stateTribute(groups.filter((g) => g.zone === r.zoneId)));
    const peek = await getCity(ctx, r.cityId);
    if (peek.stateTribute === tribute) continue;
    const b = await openCity(ctx, r.cityId);
    if (!b) continue;
    b.city.stateTribute = tribute;
    await saveCity(ctx, b.city);
  }
}

/**
 * The factions fill players' resting orders their price has crossed, as the merchant does: bids at or above what they
 * sell at, offers at or below what they buy at, along their curve, each at its own price at most and at the spread its
 * city gets (none for a city its home faction won't trade with). Returns the economy with what they sold or bought.
 */
async function npcSweep(ctx: Ctx, econ: NpcEconomy): Promise<NpcEconomy> {
  let next = econ;
  for (const [resType, r] of BASIC_RESOURCES.entries()) {
    for (const side of [MarketSide.BUY, MarketSide.SELL]) {
      const buy = side === MarketSide.BUY;
      const { target } = worldTotals(next, next.groups, r);
      let { stock } = worldTotals(next, next.groups, r);
      let { gold } = worldGold(next, next.groups);
      // every order the best spread would fill; each is then filled at its own city's
      const orders = await crossedOrders(ctx, resType, side, factionMarginal(target, stock, buy ? 'buy' : 'sell', BALANCE.reputation.spread.best));
      const terms = await cityTerms(
        ctx,
        orders.map((o) => o.cityId),
      );
      for (const o of orders) {
        const t = terms.get(o.cityId);
        if (t?.spread == null) continue;
        const left = o.amount - o.filled;
        const f = buy ? factionSells(target, stock, left, o.price, t.spread) : factionBuys(target, stock, left, o.price, gold, t.spread);
        if (f.qty <= 0) continue;
        await settleResting(ctx, o, f.qty, f.gold, true);
        await tradedWithFactions(ctx, o.playerId, t.tileId, f.gold);
        next = (buy ? takeFromGroups : giveToGroups)(next, next.groups, r, f.qty, f.gold);
        stock += buy ? -f.qty : f.qty;
        gold += buy ? f.gold : -f.gold;
      }
    }
  }
  return next;
}

/** What players took from a faction member (a barbarian city from the faction level up) lowers its group's stock. */
export async function plunderNpc(ctx: Ctx, tileId: number, level: number, taken: Partial<Stock>, ruled: ReadonlySet<number>) {
  if (!npcFaction(tileId, level, ruled)) return;
  const econ = await loadNpcEconomy(ctx, true);
  if (!econ) return;
  await saveNpcEconomy(ctx, plunderGroup(econ, { zone: stateOf(tileId), level, members: 0 }, taken));
}
