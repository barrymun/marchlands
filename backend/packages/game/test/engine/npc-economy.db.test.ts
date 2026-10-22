import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  CandlePeriod,
  factionMarginal,
  groupKey,
  groupTarget,
  MarketSide,
  MINUTE,
  priceBand,
  stateOf,
  TileType,
  worldGold,
  worldTotals,
} from '@marchlands/core';
import { marketCandles, marketOrders, tiles } from '@marchlands/db';

import { loadNpcEconomy, npcGroups, npcTradeTick, plunderNpc, saveNpcEconomy } from '#/engine/npc-economy.ts';
import { market } from '#/index.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { createTrader, Res } from '#test/support/market.ts';

/** Two ticks: the first makes the economy, the second trades. */
async function trading(g: TestGame) {
  await npcTradeTick(g);
  g.advance(MINUTE);
  await npcTradeTick(g);
  const econ = await loadNpcEconomy(g, false);
  if (!econ) throw new Error('no NPC economy');
  return econ;
}

describe(npcGroups.name, () => {
  it("counts the map's faction members by zone and level, from the faction level up", () =>
    game(async (g) => {
      const groups = await npcGroups(g);
      expect(groups.length).toBeGreaterThan(0);
      expect(groups.every((x) => x.level >= BALANCE.factions.minLevel && x.members > 0 && x.zone >= 0 && x.zone < BALANCE.stateGrid ** 2)).toBe(true);
    }));
});

describe(npcTradeTick.name, () => {
  it('makes the economy on its first tick, every group at its target', () =>
    game(async (g) => {
      expect(await loadNpcEconomy(g, false)).toBeNull();
      await npcTradeTick(g);
      const econ = await loadNpcEconomy(g, false);
      expect(econ?.at).toBe(g.now);
      const [first] = econ?.groups ?? [];
      expect(first && econ?.stock[groupKey(first.zone, first.level)]).toEqual(first && groupTarget(first));
      expect(econ?.land).toHaveLength(BALANCE.stateGrid ** 2);
    }));

  it("then trades each tick, adding the factions' auctions to the price candles and the ticker", () =>
    game(async (g) => {
      const econ = await trading(g);
      expect(econ.at).toBe(g.now);
      const candles = await g.tx.select().from(marketCandles).where(eq(marketCandles.period, CandlePeriod.MINUTE));
      expect(candles.length).toBeGreaterThan(0);
      for (const c of candles) {
        expect(c.volume).toBeGreaterThan(0);
        expect(c.close).toBeGreaterThanOrEqual(priceBand().low);
        expect(c.close).toBeLessThanOrEqual(priceBand().high);
      }
      const h = await market.history(g, Res.FOOD, CandlePeriod.MINUTE);
      expect(h.ticker.length).toBeGreaterThan(0);
      // each tick tells everyone connected that every market moved (the first, making the economy, too)
      expect(g.pushes(PushCmd.MARKET_UPDATE)).toEqual([
        { playerIds: [], cmd: PushCmd.MARKET_UPDATE, data: { resTypes: [0, 1, 2, 3] } },
        { playerIds: [], cmd: PushCmd.MARKET_UPDATE, data: { resTypes: [0, 1, 2, 3] } },
      ]);
      expect(h.ticker.every((x) => x.resource === 'food')).toBe(true);
    }));

  it("fills players' resting orders the factions' price has crossed, at the order's price at most", () =>
    game(async (g) => {
      const a = await createTrader(g);
      // before the factions trade, a bid inside the merchant's band rests
      const price = 1.1;
      const placed = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price });
      expect(placed.rest).toBe(1000);
      await trading(g);
      expect(await g.tx.select().from(marketOrders).where(eq(marketOrders.playerId, a.id))).toEqual([]);
      const [trade] = (await market.history(g, Res.WOOD)).trades;
      expect(trade).toMatchObject({ amount: 1000, factions: true, merchant: false });
      expect(trade?.price).toBeLessThanOrEqual(price);
      // the goods and the escrow it didn't need come as zero-time shipments
      expect((await market.myShipments(g, a.id)).map((s) => s.resourceName).sort()).toEqual(['gold', 'wood']);
    }));
});

describe("the factions' gold", () => {
  it('pays players only as much as the factions hold; the merchant buys the rest', () =>
    game(async (g) => {
      const econ = await trading(g);
      // drain them down to 1,000 gold between them
      const keys = Object.keys(econ.gold);
      await saveNpcEconomy(g, { ...econ, gold: Object.fromEntries(keys.map((k) => [k, 1000 / keys.length])) });
      const a = await createTrader(g);
      const sold = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 50_000, type: 'market' });
      expect(sold.filled).toBe(50_000);
      expect(sold.factionsFilled).toBeGreaterThan(0);
      expect(sold.factionsFilled).toBeLessThan(1100);
      expect(sold.merchantFilled).toBe(50_000 - sold.factionsFilled);
      const after = await loadNpcEconomy(g, false);
      expect(after && worldGold(after, after.groups).gold).toBeLessThan(1);
      expect((await market.orderBook(g, Res.WOOD)).factions?.buys).toBe(0);
    }));

  it('earns gold when players buy from them', () =>
    game(async (g) => {
      const econ = await trading(g);
      const a = await createTrader(g);
      const bought = await market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side: MarketSide.BUY, amount: 10_000, type: 'market' });
      const after = await loadNpcEconomy(g, false);
      expect(after && worldGold(after, after.groups).gold - worldGold(econ, econ.groups).gold).toBeCloseTo(bought.gold - bought.fee, -1);
    }));

  it('starts every group at its treasury from state saved before they held gold', () =>
    game(async (g) => {
      await trading(g);
      await g.tx.execute(sql`update world_state set value = value - 'gold' where key = 'npc-economy'`);
      const econ = await loadNpcEconomy(g, false);
      expect(econ?.gold).toEqual({});
      expect(econ && worldGold(econ, econ.groups).gold).toBe(econ && worldGold(econ, econ.groups).treasury);
      g.advance(MINUTE);
      await npcTradeTick(g);
      expect(Object.keys((await loadNpcEconomy(g, false))?.gold ?? {}).length).toBeGreaterThan(0);
    }));
});

describe('trading with the factions', () => {
  it('fills a market order from the factions before the merchant, at their curve price, taking from their stock', () =>
    game(async (g) => {
      const before = await trading(g);
      const a = await createTrader(g);
      const { target, stock } = worldTotals(before, before.groups, 'wood');
      const order = { resType: Res.WOOD, side: MarketSide.BUY, amount: 50_000, type: 'market' } as const;
      const q = await market.quote(g, a.id, order);
      const { order: _o, ...placed } = await market.placeOrder(g, a.id, a.cityId, order);
      expect(placed).toEqual(q);
      expect(placed).toMatchObject({ filled: 50_000, factionsFilled: 50_000, merchantFilled: 0, playerFilled: 0 });
      expect(placed.avgPrice).toBeCloseTo(factionMarginal(target, stock, 'buy'), 3);
      const after = await loadNpcEconomy(g, false);
      expect(after && worldTotals(after, after.groups, 'wood').stock).toBeCloseTo(stock - 50_000, 0);
      expect((await market.history(g, Res.WOOD)).trades[0]).toMatchObject({ factions: true, merchant: false });
    }));

  it('shows the factions in the order book, inside the band, with their depth in steps', () =>
    game(async (g) => {
      await trading(g);
      const { factions } = await market.orderBook(g, Res.IRON);
      expect(factions).not.toBeNull();
      const { low, high } = priceBand();
      expect(factions?.ask).toBeLessThanOrEqual(high);
      expect(factions?.bid).toBeGreaterThanOrEqual(low);
      expect(factions?.sells).toBe(factions?.sellers.reduce((s, l) => s + l.amount, 0));
      expect(factions?.sellers.length).toBeGreaterThan(0);
    }));

  it('leaves the factions out of the book before their first tick', () =>
    game(async (g) => {
      expect((await market.orderBook(g, Res.FOOD)).factions).toBeNull();
    }));
});

describe(plunderNpc.name, () => {
  it("lowers a faction member's group stock by what was taken; a bandit's plunder changes nothing", () =>
    game(async (g) => {
      const econ = await trading(g);
      const [member] = await g.tx
        .select({ id: tiles.id, level: tiles.level })
        .from(tiles)
        .where(and(eq(tiles.type, TileType.NPC), eq(tiles.level, BALANCE.factions.minLevel)))
        .limit(1);
      if (!member) throw new Error('no faction member on the test map');
      const key = groupKey(stateOf(member.id), member.level);
      const was = econ.stock[key]?.iron ?? 0;
      await plunderNpc(g, member.id, member.level, { iron: 10_000 });
      await plunderNpc(g, member.id, BALANCE.factions.minLevel - 1, { iron: 10_000 });
      const now = await loadNpcEconomy(g, false);
      expect(now?.stock[key]?.iron).toBeCloseTo(was - 10_000, 0);
    }));
});
