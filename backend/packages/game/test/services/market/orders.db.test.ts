import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BuildingType,
  MarketSide,
  merchantAsk,
  merchantBase,
  merchantBid,
  merchantMarginal,
  merchantSells,
  msg,
  ref,
  ReportType,
  TimedEventType,
} from '@marchlands/core';

import { market, reports } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadCity, type TestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { createTrader, escrowGold, GOLD, Res, withFee, withMerchantCurve } from '#test/support/market.ts';

/** The merchant's fixed price for wood (BALANCE.merchant.fixedPrice), and what it sells and buys at around it. */
const P = () => merchantBase('wood');
const ASK = () => merchantAsk(P());
const BID = () => merchantBid(P());

describe('market updates', () => {
  it('tells everyone connected when an order changes a market: placed (filled or resting) or cancelled', () =>
    game(async (g) => {
      const a = await createTrader(g);
      await market.placeOrder(g, a.id, a.cityId, { resType: Res.IRON, side: MarketSide.BUY, amount: 10, type: 'market' });
      const { order } = await market.placeOrder(g, a.id, a.cityId, { resType: Res.STONE, side: MarketSide.BUY, amount: 10, price: 0.5 });
      await market.cancelOrder(g, a.id, order?.id ?? 0);
      expect(g.pushes(PushCmd.MARKET_UPDATE)).toEqual([
        { playerIds: [], cmd: PushCmd.MARKET_UPDATE, data: { resTypes: [Res.IRON] } },
        { playerIds: [], cmd: PushCmd.MARKET_UPDATE, data: { resTypes: [Res.STONE] } },
        { playerIds: [], cmd: PushCmd.MARKET_UPDATE, data: { resTypes: [Res.STONE] } },
      ]);
    }));

  it('says nothing for an order refused', () =>
    game(async (g) => {
      const a = await createTrader(g, { gold: 0 });
      await expectRefused(
        market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side: MarketSide.BUY, amount: 10, type: 'market' }),
        'common.notEnoughGoldFor',
      );
      expect(g.pushes(PushCmd.MARKET_UPDATE)).toEqual([]);
    }));
});

describe(market.placeOrder.name, () => {
  describe('with the merchant at its fixed price', () => {
    it('a market buy is filled by the merchant at once, the buyer paying the fee', () =>
      game(async (g) => {
        const a = await createTrader(g);
        const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, type: 'market' });
        const gold = withFee(1000 * ASK());
        expect(res).toEqual({
          filled: 1000,
          avgPrice: ASK(),
          gold,
          fee: gold - Math.ceil(1000 * ASK()),
          merchantFilled: 1000,
          factionsFilled: 0,
          playerFilled: 0,
          rest: 0,
          escrow: 0,
          order: null,
        });
        expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000 - gold, wood: 1_001_000 });
        expect(g._stats.get(`${a.id}|${a.cityId}`)).toMatchObject({ 'market.bought.wood': 1000, 'market.goldPaid': Math.floor(1000 * ASK()) });
        expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [a.id], data: { castleId: a.cityId } });
        expect((await market.history(g, Res.WOOD)).trades).toEqual([
          {
            id: expect.any(Number),
            price: ASK(),
            amount: 1000,
            gold: Math.floor(1000 * ASK()),
            takerSide: MarketSide.BUY,
            merchant: true,
            factions: false,
            createdAt: g.now,
          },
        ]);
        expect(await market.myOrders(g, a.id)).toEqual([]);
        expect(g.events(TimedEventType.SHIPMENT)).toEqual([]);
      }));

    it('a market sell is paid at once, with no fee', () =>
      game(async (g) => {
        const a = await createTrader(g);
        const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.IRON, side: MarketSide.SELL, amount: 1000, type: 'market' });
        expect(res).toMatchObject({
          filled: 1000,
          gold: Math.floor(1000 * merchantBid(merchantBase('iron'))),
          fee: 0,
          merchantFilled: 1000,
          rest: 0,
          order: null,
        });
        expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000 + res.gold, iron: 999_000 });
        expect(g._stats.get(`${a.id}|${a.cityId}`)).toMatchObject({ 'market.sold.iron': 1000, 'market.goldReceived': res.gold });
      }));

    it("a bid above the merchant's ask, or an offer below its bid, trades at the merchant's price", () =>
      game(async (g) => {
        const a = await createTrader(g);
        const buy = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 500, price: P() * 2 });
        expect(buy).toMatchObject({ filled: 500, avgPrice: ASK(), gold: withFee(500 * ASK()), rest: 0, order: null });
        const sell = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 500, price: P() / 2 });
        expect(sell).toMatchObject({ filled: 500, avgPrice: BID(), gold: Math.floor(500 * BID()), rest: 0, order: null });
      }));

    it("a bid below the merchant's ask rests, its gold held in escrow", () =>
      game(async (g) => {
        const a = await createTrader(g);
        const price = Math.round(P() * 500) / 1000;
        const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price });
        const escrow = escrowGold(1000, price);
        expect(res).toEqual({
          filled: 0,
          avgPrice: null,
          gold: 0,
          fee: 0,
          merchantFilled: 0,
          factionsFilled: 0,
          playerFilled: 0,
          rest: 1000,
          escrow,
          order: {
            id: expect.any(Number),
            resType: Res.WOOD,
            resourceName: 'wood',
            tradeType: MarketSide.BUY,
            price,
            amount: 1000,
            dealedTotal: 0,
            createdAt: g.now,
            cityId: a.cityId,
          },
        });
        expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000 - escrow, wood: 1_000_000 });
        expect(await market.myOrders(g, a.id)).toEqual([res.order]);
        expect((await market.history(g, Res.WOOD)).trades).toEqual([]);
      }));

    it("an offer above the merchant's bid rests, its goods held", () =>
      game(async (g) => {
        const a = await createTrader(g);
        const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.STONE, side: MarketSide.SELL, amount: 700, price: 3 * merchantBase('stone') });
        expect(res).toMatchObject({ filled: 0, rest: 700, escrow: 700, order: { tradeType: MarketSide.SELL, resourceName: 'stone', amount: 700 } });
        expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000, stone: 999_300 });
      }));

    it('a limit price is kept to three decimals', () =>
      game(async (g) => {
        const a = await createTrader(g);
        const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side: MarketSide.BUY, amount: 10, price: 0.1236 });
        expect(res.order?.price).toBe(0.124);
      }));

    it('a Marketplace holds BALANCE.marketMaxOrdersPerLevel resting orders per level; orders filled at once need no room', () =>
      game(async (g) => {
        const a = await createTrader(g, {}, 2);
        const limit = 2 * BALANCE.marketMaxOrdersPerLevel;
        const bid = { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, price: P() / 2 };
        for (let i = 0; i < limit; i++) await market.placeOrder(g, a.id, a.cityId, bid);
        await expectRefused(market.placeOrder(g, a.id, a.cityId, bid), msg('market.tooManyOrders', { building: ref.building(BuildingType.MARKETPLACE) }));
        await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, type: 'market' });
        expect(await market.myOrders(g, a.id)).toHaveLength(limit);
      }));

    it('rejects a buyer without the gold, or a seller without the goods', () =>
      game(async (g) => {
        const a = await createTrader(g, { gold: 100, wood: 50 });
        await expectRefused(
          market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, type: 'market' }),
          msg('common.notEnoughGoldFor', { amount: withFee(1000 * ASK()) }),
        );
        await expectRefused(
          market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: P() / 2 }),
          msg('common.notEnoughGoldFor', { amount: escrowGold(1000, P() / 2) }),
        );
        await expectRefused(
          market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 51, type: 'market' }),
          msg('market.notEnoughResource', { resource: ref.resource('wood') }),
        );
        await expectRefused(
          market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 51, price: 2 * P() }),
          msg('market.notEnoughResource', { resource: ref.resource('wood') }),
        );
        expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 100, wood: 50 });
      }));

    it('needs a Marketplace in a city of the player', () =>
      game(async (g) => {
        const a = await createTrader(g);
        const p = await createTestPlayer(g);
        const order = { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, type: 'market' } as const;
        await expectRefused(market.placeOrder(g, p.id, p.cityId, order), msg('market.needMarketplace', { building: ref.building(BuildingType.MARKETPLACE) }));
        await expectRefused(market.placeOrder(g, p.id, a.cityId, order), msg('common.invalidCastle'));
      }));

    it('rejects an invalid resource, side, amount or price', () =>
      game(async (g) => {
        const a = await createTrader(g);
        const place = (o: Partial<market.OrderInput>) =>
          market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, price: 0.5, ...o });
        for (const resType of [-1, 4, 1.5]) await expectRefused(place({ resType }), msg('market.invalidResource'));
        await expectRefused(place({ side: 2 }), msg('market.invalidSide'));
        for (const amount of [0, 1.5, 1e10 + 1]) await expectRefused(place({ amount }), msg('common.invalidAmount'));
        for (const price of [0, 0.0004, 1e6 + 1, undefined]) await expectRefused(place({ price }), msg('market.invalidPrice'));
      }));
  });

  describe('with the merchant on its price curve', () => {
    it('a resting offer is taken before the dearer merchant; its owner is paid by a zero-time shipment', () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const [a, b] = [await createTrader(g), await createTrader(g)];
          const base = merchantBase('wood');
          expect((await market.orderBook(g, Res.WOOD)).merchant.reference).toBe(base);
          const offer = await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 5000, price: base });
          expect(offer).toMatchObject({ filled: 0, rest: 5000 });

          g._pushes.length = 0;
          const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 8000, type: 'market' });
          const m = merchantSells(base, 3000);
          const fillGold = 5000 * base + m.gold;
          expect(res).toMatchObject({ filled: 8000, playerFilled: 5000, merchantFilled: 3000, gold: withFee(fillGold), avgPrice: fillGold / 8000 });
          expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000 - withFee(fillGold), wood: 1_008_000 });
          expect((await market.orderBook(g, Res.WOOD)).merchant.reference).toBeCloseTo(m.ref, 12);

          // the offer is gone, its owner is told and paid on delivery
          expect(await market.myOrders(g, b.id)).toEqual([]);
          const paid = Math.floor(5000 * base);
          expect(await market.myShipments(g, b.id)).toEqual([
            { id: expect.any(Number), cityId: b.cityId, resType: GOLD, resourceName: 'gold', amount: paid, price: base, startTime: g.now, endTime: g.now },
          ]);
          expect(g.events(TimedEventType.SHIPMENT)).toMatchObject([{ dueAt: g.now, playerId: b.id, cityId: b.cityId }]);
          expect(g.pushes(PushCmd.TRADES_UPDATE)).toEqual([
            { playerIds: [b.id], cmd: PushCmd.TRADES_UPDATE, data: { resType: Res.WOOD, amount: 5000, price: base } },
          ]);
          const [report] = (await reports.listReports(g, b.id, ReportType.TRADE, 1, 10)).reports;
          expect(report!.title).toEqual(msg('report.title.tradeCompleted'));
          expect((await reports.readReport(g, b.id, report!.id)).content).toEqual({
            kind: 'trade',
            trade: { side: 'sell', resource: 'wood', amount: 5000, price: base, gold: paid },
          });
          expect(g._stats.get(`${b.id}|${b.cityId}`)).toMatchObject({ 'market.sold.wood': 5000, 'market.goldReceived': paid });

          expect(await g.runDue()).toBe(1);
          expect(await reloadCity(g, b.cityId)).toMatchObject({ gold: 1_000_000 + paid, wood: 1_000_000 - 5000 });
          expect(await market.myShipments(g, b.id)).toEqual([]);

          const trades = (await market.history(g, Res.WOOD)).trades;
          expect(trades.map((t) => [t.amount, t.merchant])).toEqual(
            expect.arrayContaining([
              [5000, false],
              [3000, true],
            ]),
          );
        }),
      ));

    it('an offer hitting a resting bid is paid at the bid price; the bidder gets the goods', () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const [a, b] = [await createTrader(g), await createTrader(g)];
          const bidPrice = Math.round(merchantBase('wood') * 1.03 * 1000) / 1000; // inside the spread
          const bid = await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: bidPrice });
          expect(bid).toMatchObject({ filled: 0, rest: 1000, escrow: escrowGold(1000, bidPrice) });

          const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 400, price: merchantBase('wood') });
          expect(res).toMatchObject({ filled: 400, playerFilled: 400, merchantFilled: 0, gold: Math.floor(400 * bidPrice), rest: 0, order: null });
          expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000 + Math.floor(400 * bidPrice), wood: 999_600 });
          expect(await market.myOrders(g, b.id)).toMatchObject([{ id: bid.order!.id, amount: 1000, dealedTotal: 400 }]);
          expect(await market.myShipments(g, b.id)).toMatchObject([{ resType: Res.WOOD, resourceName: 'wood', amount: 400, price: bidPrice, endTime: g.now }]);

          await g.runDue();
          expect(await reloadCity(g, b.cityId)).toMatchObject({ wood: 1_000_400, gold: 1_000_000 - escrowGold(1000, bidPrice) });
        }),
      ));

    it('better prices first, then older orders; a bid filled in part rests for the rest', () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const base = merchantBase('wood');
          const cheap = Math.round(base * 0.97 * 1000) / 1000;
          const offer = (p: TestPlayer, price: number) =>
            market.placeOrder(g, p.id, p.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price });
          const c = await createTrader(g);
          await offer(c, base);
          g.advance(1000); // (before the others exist: their resources stay exact)
          const [a, b, d] = [await createTrader(g), await createTrader(g), await createTrader(g)];
          await offer(b, base);
          await offer(d, cheap);

          // the limit is below the merchant's ask, so only the offers can fill it
          expect(merchantMarginal(base, 'buy')).toBeGreaterThan(base);
          const res = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 2500, price: base });
          const fillGold = 1000 * cheap + 1500 * base;
          expect(res).toMatchObject({ filled: 2500, playerFilled: 2500, merchantFilled: 0, rest: 0, gold: withFee(fillGold), order: null });
          expect(await market.myOrders(g, d.id)).toEqual([]);
          expect(await market.myOrders(g, c.id)).toEqual([]);
          expect(await market.myOrders(g, b.id)).toMatchObject([{ dealedTotal: 500 }]);

          const more = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: base });
          expect(more).toMatchObject({ filled: 500, rest: 500, escrow: escrowGold(500, base), gold: withFee(500 * base) });
          expect(more.order).toMatchObject({ amount: 1000, dealedTotal: 500 });
          expect(await reloadCity(g, a.cityId)).toMatchObject({
            gold: 1_000_000 - withFee(fillGold) - withFee(500 * base) - escrowGold(500, base),
            wood: 1_003_000,
          });
          expect(await market.myOrders(g, b.id)).toEqual([]);
        }),
      ));

    it("a player's own resting orders are not matched against their new order", () =>
      withMerchantCurve(() =>
        game(async (g) => {
          const b = await createTrader(g);
          const base = merchantBase('wood');
          await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price: base });
          const res = await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, type: 'market' });
          expect(res).toMatchObject({ playerFilled: 0, merchantFilled: 1000, gold: withFee(merchantSells(base, 1000).gold) });
          expect(await market.myOrders(g, b.id)).toMatchObject([{ dealedTotal: 0 }]);
        }),
      ));
  });
});

describe(market.cancelOrder.name, () => {
  it('returns the escrowed gold of a bid', () =>
    game(async (g) => {
      const a = await createTrader(g);
      const { order } = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 999, price: 0.333 });
      g._pushes.length = 0;
      await market.cancelOrder(g, a.id, order!.id);
      expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000 });
      expect(await market.myOrders(g, a.id)).toEqual([]);
      expect(g.pushes(PushCmd.RESOURCE_UPDATE)).toMatchObject([{ playerIds: [a.id] }]);
    }));

  it('returns the goods of an offer', () =>
    game(async (g) => {
      const a = await createTrader(g);
      const { order } = await market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side: MarketSide.SELL, amount: 1234, price: 2 * merchantBase('food') });
      await market.cancelOrder(g, a.id, order!.id);
      expect(await reloadCity(g, a.cityId)).toMatchObject({ food: 1_000_000 });
    }));

  it('returns only the escrow of the unfilled part', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b] = [await createTrader(g), await createTrader(g)];
        const bidPrice = Math.round(merchantBase('wood') * 1.03 * 1000) / 1000;
        const { order } = await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: bidPrice });
        await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 400, price: bidPrice });
        await market.cancelOrder(g, b.id, order!.id);
        expect((await reloadCity(g, b.cityId)).gold).toBe(1_000_000 - escrowGold(1000, bidPrice) + escrowGold(600, bidPrice));
      }),
    ));

  it("rejects an unknown order or another player's", () =>
    game(async (g) => {
      const [a, b] = [await createTrader(g), await createTrader(g)];
      const { order } = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, price: 0.5 });
      await expectRefused(market.cancelOrder(g, b.id, order!.id), msg('market.orderNotFound'));
      await expectRefused(market.cancelOrder(g, a.id, order!.id + 1000), msg('market.orderNotFound'));
      expect(await market.myOrders(g, a.id)).toHaveLength(1);
    }));
});
