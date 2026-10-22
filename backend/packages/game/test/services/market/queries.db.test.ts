import { describe, expect, it } from 'vitest';

import { CANDLE_PERIOD_MS, CandlePeriod, MarketSide, merchantAsk, merchantBase, merchantBid, merchantBuys, merchantSells, MINUTE, msg } from '@marchlands/core';

import { market } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { reloadCity } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { createTrader, escrowGold, Res, withFee, withMerchantCurve } from '#test/support/market.ts';

describe(market.orderBook.name, () => {
  it('shows the merchant quote on an empty book', () =>
    game(async (g) => {
      const P = merchantBase('stone');
      expect(await market.orderBook(g, Res.STONE)).toEqual({
        resType: Res.STONE,
        buyers: [],
        sellers: [],
        merchant: { reference: P, base: P, bid: merchantBid(P), ask: merchantAsk(P) },
        factions: null,
      });
    }));

  it('on its curve the merchant quotes around its reference', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const base = merchantBase('iron');
        expect((await market.orderBook(g, Res.IRON)).merchant).toEqual({ reference: base, base, bid: merchantBid(base), ask: merchantAsk(base) });
      }),
    ));

  it('adds up the open amount per price, best prices first, up to the depth', () =>
    game(async (g) => {
      const [a, b] = [await createTrader(g, {}, 5), await createTrader(g, {}, 5)];
      const P = merchantBase('wood');
      const bid = (p: typeof a, amount: number, price: number) =>
        market.placeOrder(g, p.id, p.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount, price });
      const offer = (p: typeof a, amount: number, price: number) =>
        market.placeOrder(g, p.id, p.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount, price });
      await bid(a, 100, P / 2);
      await bid(b, 50, P / 2);
      await bid(a, 10, P / 4);
      await bid(a, 1, P / 8);
      await offer(b, 30, P * 3);
      await offer(b, 20, P * 2);
      await market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side: MarketSide.BUY, amount: 999, price: merchantBase('food') / 2 });

      const book = await market.orderBook(g, Res.WOOD, 2);
      expect(book.buyers).toEqual([
        { price: P / 2, amount: 150 },
        { price: P / 4, amount: 10 },
      ]);
      expect(book.sellers).toEqual([
        { price: P * 2, amount: 20 },
        { price: P * 3, amount: 30 },
      ]);
      expect((await market.orderBook(g, Res.WOOD)).buyers).toHaveLength(3);
    }));

  it('shows only what is left of an order filled in part', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b] = [await createTrader(g), await createTrader(g)];
        const price = merchantBase('wood');
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price });
        await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 400, price });
        expect((await market.orderBook(g, Res.WOOD)).sellers).toEqual([{ price, amount: 600 }]);
      }),
    ));

  it('rejects an invalid resource', () =>
    game(async (g) => {
      await expectRefused(market.orderBook(g, 4), msg('market.invalidResource'));
    }));
});

describe(market.quote.name, () => {
  it('says what the order would do, changing nothing', () =>
    game(async (g) => {
      const a = await createTrader(g);
      const P = merchantAsk(merchantBase('wood'));
      const order = { resType: Res.WOOD, side: MarketSide.BUY, amount: 2000, type: 'market' } as const;
      const q = await market.quote(g, a.id, order);
      expect(q).toEqual({
        filled: 2000,
        avgPrice: P,
        gold: withFee(2000 * P),
        fee: withFee(2000 * P) - 2000 * P,
        merchantFilled: 2000,
        factionsFilled: 0,
        playerFilled: 0,
        rest: 0,
        escrow: 0,
      });
      expect(await reloadCity(g, a.cityId)).toMatchObject({ gold: 1_000_000, wood: 1_000_000 });
      expect((await market.history(g, Res.WOOD)).trades).toEqual([]);

      const { order: _o, ...placed } = await market.placeOrder(g, a.id, a.cityId, order);
      expect(placed).toEqual(q);
    }));

  it('quotes the escrow of a limit order that would rest', () =>
    game(async (g) => {
      const a = await createTrader(g);
      const price = merchantBase('wood') / 2;
      expect(await market.quote(g, a.id, { resType: Res.WOOD, side: MarketSide.BUY, amount: 300, price })).toMatchObject({
        filled: 0,
        rest: 300,
        escrow: escrowGold(300, price),
      });
      expect(await market.quote(g, a.id, { resType: Res.WOOD, side: MarketSide.SELL, amount: 300, price: price * 4 })).toMatchObject({
        filled: 0,
        rest: 300,
        escrow: 300,
      });
      expect(await market.myOrders(g, a.id)).toEqual([]);
    }));

  it("leaves out the player's own resting orders", () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b] = [await createTrader(g), await createTrader(g)];
        const price = merchantBase('wood');
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 1000, price });
        const order = { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, type: 'market' } as const;
        expect(await market.quote(g, b.id, order)).toMatchObject({ playerFilled: 0, merchantFilled: 1000, gold: withFee(merchantSells(price, 1000).gold) });
        expect(await market.quote(g, a.id, order)).toMatchObject({ playerFilled: 1000, merchantFilled: 0, gold: withFee(1000 * price) });
      }),
    ));

  it('rejects an invalid order', () =>
    game(async (g) => {
      const a = await createTrader(g);
      await expectRefused(market.quote(g, a.id, { resType: Res.WOOD, side: 3, amount: 1, type: 'market' }), msg('market.invalidSide'));
      await expectRefused(market.quote(g, a.id, { resType: Res.WOOD, side: MarketSide.BUY, amount: -1, type: 'market' }), msg('common.invalidAmount'));
      await expectRefused(market.quote(g, a.id, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1, price: -1 }), msg('market.invalidPrice'));
      await expectRefused(market.quote(g, a.id, { resType: 7, side: MarketSide.BUY, amount: 1, type: 'market' }), msg('market.invalidResource'));
    }));
});

describe(market.history.name, () => {
  it('lists recent trades newest first, and candles of a minute, an hour and a day of real time', () =>
    game(async (g) => {
      const a = await createTrader(g);
      const P = merchantBase('food');
      const [ask, bid] = [merchantAsk(P), merchantBid(P)];
      const trade = (side: number, amount: number) => market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side, amount, type: 'market' });
      const startOf = (period: CandlePeriod) => g.now - (g.now % CANDLE_PERIOD_MS[period]);
      const [minute, hour, day] = [startOf(CandlePeriod.MINUTE), startOf(CandlePeriod.HOUR), startOf(CandlePeriod.DAY)];
      await trade(MarketSide.BUY, 100);
      await trade(MarketSide.SELL, 40);
      // into the next minute, still the same hour and day (T0 starts a day)
      g.advance(minute + MINUTE - g.now);
      await trade(MarketSide.BUY, 7);

      const h = await market.history(g, Res.FOOD, CandlePeriod.MINUTE);
      expect(h).toMatchObject({ resType: Res.FOOD, period: CandlePeriod.MINUTE, bucketMs: MINUTE, merchant: { reference: P } });
      expect(h.trades.map((t) => [t.amount, t.takerSide, t.merchant])).toEqual([
        [7, MarketSide.BUY, true],
        [40, MarketSide.SELL, true],
        [100, MarketSide.BUY, true],
      ]);
      expect(h.candles).toEqual([
        { t: minute, open: ask, high: ask, low: bid, close: bid, volume: 140 },
        { t: minute + MINUTE, open: ask, high: ask, low: ask, close: ask, volume: 7 },
      ]);
      expect((await market.history(g, Res.FOOD, CandlePeriod.HOUR)).candles).toEqual([{ t: hour, open: ask, high: ask, low: bid, close: ask, volume: 147 }]);
      expect((await market.history(g, Res.FOOD, CandlePeriod.DAY)).candles).toEqual([{ t: day, open: ask, high: ask, low: bid, close: ask, volume: 147 }]);
      // the latest `limit` candles; the trade list is not limited by them
      const last = await market.history(g, Res.FOOD, CandlePeriod.MINUTE, 1);
      expect(last.candles).toEqual([{ t: minute + MINUTE, open: ask, high: ask, low: ask, close: ask, volume: 7 }]);
      expect(last.trades).toHaveLength(3);
      expect((await market.history(g, Res.WOOD)).trades).toEqual([]);
    }));

  it('a candle opens at the first price, closes at the last and spans the extremes', () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const a = await createTrader(g);
        const base = merchantBase('wood');
        const trade = (side: number, amount: number) => market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side, amount, type: 'market' });
        await trade(MarketSide.BUY, 100_000);
        await trade(MarketSide.SELL, 200_000);
        await trade(MarketSide.BUY, 10);
        const buy1 = merchantSells(base, 100_000);
        const sell = merchantBuys(buy1.ref, 200_000);
        const buy2 = merchantSells(sell.ref, 10);
        const [p1, p2, p3] = [buy1.gold / 100_000, sell.gold / 200_000, buy2.gold / 10];
        const [c] = (await market.history(g, Res.WOOD)).candles;
        expect(c!.open).toBeCloseTo(p1, 12);
        expect(c!.close).toBeCloseTo(p3, 12);
        expect(c!.high).toBeCloseTo(Math.max(p1, p2, p3), 12);
        expect(c!.low).toBeCloseTo(Math.min(p1, p2, p3), 12);
        expect(c!.volume).toBe(300_010);
      }),
    ));

  it('rejects an invalid resource', () =>
    game(async (g) => {
      await expectRefused(market.history(g, -1), msg('market.invalidResource'));
    }));
});

describe(market.myOrders.name, () => {
  it("lists the player's resting orders, newest first", () =>
    game(async (g) => {
      const [a, b] = [await createTrader(g, {}, 2), await createTrader(g)];
      const first = await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, price: 0.1 });
      g.advance(1000);
      const second = await market.placeOrder(g, a.id, a.cityId, { resType: Res.IRON, side: MarketSide.SELL, amount: 20, price: 9 });
      await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 10, price: 0.1 });
      expect(await market.myOrders(g, a.id)).toEqual([second.order, first.order]);
      expect(second.order).toMatchObject({ resType: Res.IRON, resourceName: 'iron', tradeType: MarketSide.SELL, price: 9, amount: 20, dealedTotal: 0 });
    }));
});

describe(market.myShipments.name, () => {
  it("lists the player's shipments, soonest first", () =>
    withMerchantCurve(() =>
      game(async (g) => {
        const [a, b] = [await createTrader(g), await createTrader(g, {}, 2)];
        const base = merchantBase('wood');
        const bidPrice = Math.round(base * 1.03 * 1000) / 1000;
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 100, price: bidPrice });
        await market.placeOrder(g, b.id, b.cityId, { resType: Res.STONE, side: MarketSide.SELL, amount: 100, price: merchantBase('stone') });
        expect(await market.myShipments(g, b.id)).toEqual([]);
        await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 100, type: 'market' });
        g.advance(1000);
        await market.placeOrder(g, a.id, a.cityId, { resType: Res.STONE, side: MarketSide.BUY, amount: 100, type: 'market' });
        const list = await market.myShipments(g, b.id);
        expect(list).toEqual([
          {
            id: expect.any(Number),
            cityId: b.cityId,
            resType: Res.WOOD,
            resourceName: 'wood',
            amount: 100,
            price: bidPrice,
            startTime: g.now - 1000,
            endTime: g.now - 1000,
          },
          {
            id: expect.any(Number),
            cityId: b.cityId,
            resType: 4,
            resourceName: 'gold',
            amount: Math.floor(100 * merchantBase('stone')),
            price: merchantBase('stone'),
            startTime: g.now,
            endTime: g.now,
          },
        ]);
        expect(await market.myShipments(g, a.id)).toEqual([]);
      }),
    ));
});

describe(market.affordable.name, () => {
  it('is the most units the gold buys with an instant order, the fee included', () =>
    game(async (g) => {
      const a = await createTrader(g);
      const { amount } = await market.affordable(g, a.id, Res.WOOD, 100_000);
      const buy = (n: number) => market.quote(g, a.id, { resType: Res.WOOD, side: MarketSide.BUY, amount: n, type: 'market' });
      expect(amount).toBeGreaterThan(0);
      expect((await buy(amount)).gold).toBeLessThanOrEqual(100_000);
      expect((await buy(amount + 1)).gold).toBeGreaterThan(100_000);
    }));

  it("counts other players' cheaper offers, never the player's own", () =>
    game(async (g) => {
      const [a, b] = [await createTrader(g), await createTrader(g)];
      const merchantOnly = (await market.affordable(g, a.id, Res.WOOD, 100_000)).amount;
      await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 50_000, price: 0.9 });
      expect((await market.affordable(g, a.id, Res.WOOD, 100_000)).amount).toBeGreaterThan(merchantOnly);
      expect((await market.affordable(g, b.id, Res.WOOD, 100_000)).amount).toBe(merchantOnly);
    }));

  it('is nothing for no gold', () =>
    game(async (g) => {
      const a = await createTrader(g);
      expect(await market.affordable(g, a.id, Res.FOOD, 0)).toEqual({ amount: 0 });
    }));
});

describe(market.summary.name, () => {
  it("gives every resource the merchant's price and no day before anything trades", () =>
    game(async (g) => {
      const s = await market.summary(g);
      expect(s.map((x) => x.resType)).toEqual([Res.FOOD, Res.WOOD, Res.STONE, Res.IRON]);
      for (const x of s) {
        expect(x.price).toBe(x.merchant.reference);
        expect(x.day).toBeNull();
      }
    }));

  it("sums up the last 24 hours' candles: the opening price, the high and low, the volume", () =>
    game(async (g) => {
      const a = await createTrader(g);
      const trade = (side: number, amount: number) => market.placeOrder(g, a.id, a.cityId, { resType: Res.STONE, side, amount, type: 'market' });
      await trade(MarketSide.BUY, 100);
      await trade(MarketSide.SELL, 40);
      const P = merchantBase('stone');
      const s = await market.summary(g);
      expect(s.find((x) => x.resType === Res.STONE)?.day).toEqual({ open: merchantAsk(P), high: merchantAsk(P), low: merchantBid(P), volume: 140 });
      expect(s.find((x) => x.resType === Res.FOOD)?.day).toBeNull();
    }));
});

describe(market.myTrades.name, () => {
  it("lists the player's trades newest first, from their side, with whom", () =>
    game(async (g) => {
      const [a, b] = [await createTrader(g), await createTrader(g)];
      await market.placeOrder(g, a.id, a.cityId, { resType: Res.FOOD, side: MarketSide.BUY, amount: 10, type: 'market' });
      g.advance(MINUTE);
      await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 20, price: 1 });
      await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 20, type: 'market' });
      expect((await market.myTrades(g, a.id)).map((t) => [t.resType, t.side, t.amount, t.with])).toEqual([
        [Res.WOOD, MarketSide.BUY, 20, 'player'],
        [Res.FOOD, MarketSide.BUY, 10, 'merchant'],
      ]);
      expect((await market.myTrades(g, b.id)).map((t) => [t.resType, t.side, t.amount, t.with, t.price])).toEqual([
        [Res.WOOD, MarketSide.SELL, 20, 'player', 1],
      ]);
    }));
});
