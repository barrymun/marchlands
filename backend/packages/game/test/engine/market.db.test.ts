import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { HOUR, MarketSide, merchantAsk, merchantBase, merchantBid, merchantBuys, merchantSells, ReportType } from '@marchlands/core';
import { cities, marketShipments } from '@marchlands/db';

import { deliverShipment, merchantSweep } from '#/engine/market.ts';
import { market, reports } from '#/index.ts';
import { reloadCity } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { bidPrice, createTrader, escrowGold, GOLD, Res, shipWoodTo, withFee, withMerchantCurve, withShipmentTime } from '#test/support/market.ts';

const offerPrice = () => Math.round(merchantBase('wood') * 0.97 * 1000) / 1000;

describe(deliverShipment.name, () => {
  it('delivers the goods to the city and tells the player', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b] = [await createTrader(g), await createTrader(g)];
        const s = await shipWoodTo(g, a, b);
        g._pushes.length = 0;
        await deliverShipment(g, s.id);
        expect(await reloadCity(g, b.cityId)).toMatchObject({ wood: 1_001_000 });
        expect(await market.myShipments(g, b.id)).toEqual([]);
        expect(g.pushes(PushCmd.RESOURCE_UPDATE)).toMatchObject([{ playerIds: [b.id], data: { castleId: b.cityId } }]);
        expect(g.pushes(PushCmd.TRANSIT_TRADE_UPDATE)).toEqual([
          { playerIds: [b.id], cmd: PushCmd.TRANSIT_TRADE_UPDATE, data: { id: s.id, delivered: true, resType: Res.WOOD, amount: 1000, castleId: b.cityId } },
        ]);
      }),
    ));

  it('delivers gold as gold', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b] = [await createTrader(g), await createTrader(g)];
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price: offerPrice() });
        await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, type: 'market' });
        const [s] = await market.myShipments(g, b.id);
        expect(s).toMatchObject({ resType: GOLD, amount: Math.floor(1000 * offerPrice()) });
        await deliverShipment(g, s.id);
        expect(await reloadCity(g, b.cityId)).toMatchObject({ gold: 1_000_000 + s.amount, wood: 999_000 });
      }),
    ));

  it('waits for a shipment still on its way', () =>
    withShipmentTime(HOUR, () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const [a, b] = [await createTrader(g), await createTrader(g)];
          const s = await shipWoodTo(g, a, b);
          g.advance(s.endTime - g.now - 1);
          await deliverShipment(g, s.id);
          expect(await market.myShipments(g, b.id)).toHaveLength(1);
          expect(g.events('shipment')).toMatchObject([{ dueAt: s.endTime, refKey: `shipment:${s.id}` }]);
          expect(await g.runDue(s.endTime)).toBe(1);
          expect(await market.myShipments(g, b.id)).toEqual([]);
        }),
      ),
    ));

  it("goes to the player's first city when the city is no longer theirs", () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b, other] = [await createTrader(g), await createTrader(g), await createTrader(g)];
        const s = await shipWoodTo(g, a, b);
        await g.tx.update(marketShipments).set({ cityId: other.cityId }).where(eq(marketShipments.id, s.id));
        await deliverShipment(g, s.id);
        expect(await reloadCity(g, b.cityId)).toMatchObject({ wood: 1_001_000 });
        expect(await reloadCity(g, other.cityId)).toMatchObject({ wood: 1_000_000 });
        expect(g.pushes(PushCmd.TRANSIT_TRADE_UPDATE).at(-1)?.data).toMatchObject({ castleId: b.cityId });
      }),
    ));

  it('is dropped when the player has no city left', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b, other] = [await createTrader(g), await createTrader(g), await createTrader(g)];
        const s = await shipWoodTo(g, a, b);
        await g.tx.update(cities).set({ playerId: other.id }).where(eq(cities.id, b.cityId));
        await deliverShipment(g, s.id);
        expect(await market.myShipments(g, b.id)).toEqual([]);
        expect(await reloadCity(g, b.cityId)).toMatchObject({ wood: 1_000_000 });
        expect(g.pushes(PushCmd.TRANSIT_TRADE_UPDATE)).toEqual([]);
      }),
    ));

  it('does nothing for an unknown shipment', () =>
    game(async (g) => {
      await deliverShipment(g, 2_000_000_000);
      expect(g.pushes()).toEqual([]);
    }));
});

describe(merchantSweep.name, () => {
  it('fills a bid its ask has fallen to, shipping the goods and the escrow it did not need', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const b = await createTrader(g);
        const base = merchantBase('wood');
        const { order } = await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: bidPrice() });
        expect(order).not.toBeNull();
        // b's own sale (its bid is not matched) pushes the merchant's price down
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 50_000, type: 'market' });
        const r1 = merchantBuys(base, 50_000).ref;
        expect(merchantAsk(r1)).toBeLessThan(bidPrice());
        const gold0 = (await reloadCity(g, b.cityId)).gold;
        g._pushes.length = 0;

        await merchantSweep(g);
        const f = merchantSells(r1, 1000, bidPrice());
        expect(f.qty).toBe(1000);
        const surplus = escrowGold(1000, bidPrice()) - withFee(f.gold);
        expect(await market.myOrders(g, b.id)).toEqual([]);
        const shipped = await market.myShipments(g, b.id);
        expect(shipped).toHaveLength(2);
        expect(shipped).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ resType: Res.WOOD, amount: 1000, price: f.gold / 1000, endTime: g.now }),
            expect.objectContaining({ resType: GOLD, amount: surplus, price: 0, endTime: g.now }),
          ]),
        );
        expect((await market.history(g, Res.WOOD)).trades[0]).toMatchObject({
          amount: 1000,
          gold: Math.floor(f.gold),
          takerSide: MarketSide.SELL,
          merchant: true,
        });
        expect(g.pushes(PushCmd.TRADES_UPDATE)).toEqual([
          { playerIds: [b.id], cmd: PushCmd.TRADES_UPDATE, data: { resType: Res.WOOD, amount: 1000, price: f.gold / 1000 } },
        ]);
        const [report] = (await reports.listReports(g, b.id, ReportType.TRADE, 1, 10)).reports;
        expect((await reports.readReport(g, b.id, report.id)).content).toEqual({
          kind: 'trade',
          trade: { side: 'buy', resource: 'wood', amount: 1000, price: f.gold / 1000, gold: Math.floor(f.gold) },
        });
        expect(g._stats.get(`${b.id}|${b.cityId}`)).toMatchObject({ 'market.bought.wood': 1000 });
        expect((await market.orderBook(g, Res.WOOD)).merchant.reference).toBeCloseTo(f.ref, 12);

        await g.runDue();
        expect(await reloadCity(g, b.cityId)).toMatchObject({ gold: gold0 + surplus, wood: 1_000_000 - 50_000 + 1000 });
      }),
    ));

  it('fills an offer its bid has risen to, paying the seller', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const b = await createTrader(g);
        const base = merchantBase('wood');
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price: offerPrice() });
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 50_000, type: 'market' });
        const r1 = merchantSells(base, 50_000).ref;
        expect(merchantBid(r1)).toBeGreaterThan(offerPrice());

        await merchantSweep(g);
        const f = merchantBuys(r1, 1000, offerPrice());
        expect(f.qty).toBe(1000);
        expect(await market.myOrders(g, b.id)).toEqual([]);
        expect(await market.myShipments(g, b.id)).toEqual([expect.objectContaining({ resType: GOLD, amount: Math.floor(f.gold), price: f.gold / 1000 })]);
        expect((await market.history(g, Res.WOOD)).trades[0]).toMatchObject({ amount: 1000, takerSide: MarketSide.BUY, merchant: true });
        expect(g._stats.get(`${b.id}|${b.cityId}`)).toMatchObject({ 'market.sold.wood': 1000 });
      }),
    ));

  it('fills a large bid only as far as its price allows; the rest stays on the book', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const b = await createTrader(g);
        const base = merchantBase('wood');
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 100_000, price: bidPrice() });
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 50_000, type: 'market' });
        const f = merchantSells(merchantBuys(base, 50_000).ref, 100_000, bidPrice());
        expect(f.qty).toBeGreaterThan(0);
        expect(f.qty).toBeLessThan(100_000);

        await merchantSweep(g);
        expect(await market.myOrders(g, b.id)).toMatchObject([{ amount: 100_000, dealedTotal: f.qty }]);
      }),
    ));

  it('leaves orders its prices have not crossed', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const b = await createTrader(g);
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: bidPrice() });
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price: offerPrice() });
        await merchantSweep(g);
        expect(await market.myOrders(g, b.id)).toMatchObject([{ dealedTotal: 0 }, { dealedTotal: 0 }]);
        expect(await market.myShipments(g, b.id)).toEqual([]);
        expect(g.events('shipment')).toEqual([]);
      }),
    ));

  it('at its fixed price, never crosses a resting order', () =>
    game(async (g) => {
      const b = await createTrader(g);
      const P = merchantBase('wood');
      await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: P / 2 });
      await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price: P * 2 });
      await merchantSweep(g);
      expect(await market.myOrders(g, b.id)).toHaveLength(2);
      expect(await market.myShipments(g, b.id)).toEqual([]);
      expect((await market.orderBook(g, Res.WOOD)).merchant.reference).toBe(P);
    }));
});
