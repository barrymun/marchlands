import { describe, expect, it } from 'vitest';

import type {
  FactionGold,
  MarketAffordable,
  MarketHistory,
  MarketMyTrade,
  MarketOrder,
  MarketOrderBook,
  MarketPlaceOrderResult,
  MarketQuote,
  MarketShipment,
  MarketSummary,
  PlayerState,
} from '@marchlands/contracts';
import { BALANCE, BuildingType, HOUR, merchantBase, ResourceKey } from '@marchlands/core';
import { admin } from '@marchlands/game';
import { withMerchantCurve, withShipmentTime } from '@marchlands/game/test/support/market.ts';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

const WOOD = 1;
const BUY = 0;
const SELL = 1;

/** Market routes that need a player, with a valid request. */
const PLAYER_ROUTES: RouteCall[] = [
  { method: 'GET', url: 'market/1/quote?side=0&amount=10' },
  { method: 'GET', url: 'market/orders/mine' },
  { method: 'GET', url: 'market/trades/mine' },
  { method: 'GET', url: 'market/1/affordable?gold=100' },
  { method: 'POST', url: 'cities/1/market/orders', body: { resType: 1, side: 0, amount: 10, price: 0.5 } },
  { method: 'DELETE', url: 'market/orders/1' },
  { method: 'GET', url: 'market/shipments' },
  { method: 'POST', url: 'market/shipments/1/speedup' },
];
/** World-level market data: a token, but no player. */
const ACCOUNT_ROUTES: RouteCall[] = [
  { method: 'GET', url: 'market/1' },
  { method: 'GET', url: 'market/1/history' },
  { method: 'GET', url: 'market/summary' },
  { method: 'GET', url: 'factions' },
];

/** A player with a Marketplace and plenty of gold and wood. */
async function trader(api: TestApi, name?: string) {
  const p = await api.player(name);
  await api.game(async (ctx) => {
    await admin.setBuilding(ctx, p.cityId, p.playerId, 3, BuildingType.MARKETPLACE, 1);
    await admin.setResources(ctx, p.cityId, p.playerId, { gold: 1_000_000, wood: 1_000_000 });
  });
  return p;
}

const cityRes = async (api: TestApi, p: { token: string }) => (await api.ok<PlayerState>('GET', 'player', { token: p.token })).castles[0]!.resource;

describe('authentication', () => {
  it('every market route needs a token', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, [...PLAYER_ROUTES, ...ACCOUNT_ROUTES]);
    }));

  it('every route but the order book and the history needs a player', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await expectNeedsPlayer(api, a.token, PLAYER_ROUTES);
    }));
});

describe('GET /market/:resType', () => {
  it('answers the order book with the merchant, for an account without a player', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      await api.ok('POST', `cities/${p.cityId}/market/orders`, { token: p.token, body: { resType: WOOD, side: BUY, amount: 100, price: 0.5 } });
      const a = await accountWithoutPlayer(api);
      const book = await api.ok<MarketOrderBook>('GET', `market/${WOOD}`, { token: a.token });
      expect(book).toMatchObject({ resType: WOOD, buyers: [{ price: 0.5, amount: 100 }], sellers: [] });
      expect(book.merchant).toEqual({ reference: expect.any(Number), base: expect.any(Number), bid: expect.any(Number), ask: expect.any(Number) });
    }));

  it('refuses a resource that is not traded, and validates the path', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await api.refused('GET', 'market/7', 'market.invalidResource', { token: a.token, status: 400 });
      await expectInvalid(api, a.token, [{ method: 'GET', url: 'market/wood' }]);
    }));
});

describe('GET /market/:resType?cityId=', () => {
  it("answers the book on the terms one of the player's cities gets, and refuses another player's city", () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const q = await trader(api);
      const book = await api.ok<MarketOrderBook>('GET', `market/${WOOD}?cityId=${p.cityId}`, { token: p.token });
      expect(book).toMatchObject({ resType: WOOD, buyers: [], sellers: [] });
      await api.refused('GET', `market/${WOOD}?cityId=${q.cityId}`, 'common.invalidCastle', { token: p.token, status: 403 });
      await expectInvalid(api, p.token, [{ method: 'GET', url: `market/${WOOD}?cityId=x` }]);
    }));

  it('needs a player for a city', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await api.refused('GET', `market/${WOOD}?cityId=1`, 'auth.needPlayer', { token: a.token, status: 404 });
    }));
});

describe('GET /market/:resType/quote', () => {
  it('previews an order without trading', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const q = await api.ok<MarketQuote>('GET', `market/${WOOD}/quote?side=${BUY}&amount=100&type=market`, { token: p.token });
      expect(q).toMatchObject({ filled: 100, merchantFilled: 100, playerFilled: 0, rest: 0, escrow: 0 });
      expect(q.gold).toBeGreaterThan(0);
      expect((await cityRes(api, p)).gold).toBe(1_000_000);
    }));

  it('refuses a bad side, and validates the query', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      await api.refused('GET', `market/${WOOD}/quote?side=2&amount=100`, 'market.invalidSide', { token: p.token, status: 400 });
      await expectInvalid(api, p.token, [
        { method: 'GET', url: `market/${WOOD}/quote?amount=100` },
        { method: 'GET', url: `market/${WOOD}/quote?side=0&amount=100&type=stop` },
      ]);
    }));
});

describe('GET /market/:resType/history', () => {
  it('answers recent trades and candles', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      await api.ok('POST', `cities/${p.cityId}/market/orders`, { token: p.token, body: { resType: WOOD, side: BUY, amount: 50, type: 'market' } });
      const h = await api.ok<MarketHistory>('GET', `market/${WOOD}/history`, { token: p.token });
      expect(h).toMatchObject({ resType: WOOD, period: 'hour', bucketMs: HOUR, merchant: expect.any(Object) });
      expect(h.trades).toEqual([expect.objectContaining({ amount: 50, takerSide: BUY, merchant: true })]);
      expect(h.candles).toEqual([expect.objectContaining({ volume: 50 })]);
      const m = await api.ok<MarketHistory>('GET', `market/${WOOD}/history?period=minute&limit=10`, { token: p.token });
      expect(m).toMatchObject({ period: 'minute', bucketMs: 60_000, candles: [expect.objectContaining({ volume: 50 })] });
    }));

  it('validates the period and limit', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await expectInvalid(api, a.token, [
        { method: 'GET', url: `market/${WOOD}/history?period=week` },
        { method: 'GET', url: `market/${WOOD}/history?limit=0` },
        { method: 'GET', url: `market/${WOOD}/history?limit=5000` },
      ]);
    }));
});

describe('GET /market/summary', () => {
  it("answers every resource's price, the merchant's quotes and its day, for an account without a player", () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      const s = await api.ok<MarketSummary[]>('GET', 'market/summary', { token: a.token });
      expect(s.map((x) => x.resType)).toEqual([0, 1, 2, 3]);
      expect(s[0]).toMatchObject({ price: expect.any(Number), merchant: expect.any(Object), day: null });
    }));
});

describe('GET /factions', () => {
  it("answers every faction's gold and treasury, for an account without a player", () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      const list = await api.ok<FactionGold[]>('GET', 'factions', { token: a.token });
      expect(list.map((f) => f.id)).toEqual(['saxon', 'lotharingian', 'franconian', 'bohemian', 'italian']);
      expect(list.every((f) => f.standing === 0)).toBe(true);
    }));

  it("answers the player's standing with each faction", () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const list = await api.ok<FactionGold[]>('GET', 'factions', { token: p.token });
      expect(list.map((f) => f.standing)).toEqual([0, 0, 0, 0, 0]);
    }));
});

describe('GET /market/:resType/affordable', () => {
  it('answers how much the gold buys now, and validates the query', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const { amount } = await api.ok<MarketAffordable>('GET', `market/${WOOD}/affordable?gold=10000`, { token: p.token });
      expect(amount).toBeGreaterThan(0);
      await expectInvalid(api, p.token, [
        { method: 'GET', url: `market/${WOOD}/affordable` },
        { method: 'GET', url: `market/${WOOD}/affordable?gold=-1` },
      ]);
    }));
});

describe('GET /market/trades/mine', () => {
  it("answers the player's trades from their side", () =>
    apiTest(async (api) => {
      const p = await trader(api);
      await api.ok('POST', `cities/${p.cityId}/market/orders`, { token: p.token, body: { resType: WOOD, side: SELL, amount: 100, type: 'market' } });
      const trades = await api.ok<MarketMyTrade[]>('GET', 'market/trades/mine', { token: p.token });
      expect(trades).toEqual([expect.objectContaining({ resType: WOOD, side: SELL, amount: 100, with: 'merchant' })]);
    }));
});

describe('POST /cities/:cityId/market/orders', () => {
  it('fills a market order at once', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const r = await api.ok<MarketPlaceOrderResult>('POST', `cities/${p.cityId}/market/orders`, {
        token: p.token,
        body: { resType: WOOD, side: SELL, amount: 1000, type: 'market' },
      });
      expect(r).toMatchObject({ filled: 1000, merchantFilled: 1000, rest: 0, order: null });
      const res = await cityRes(api, p);
      expect(res.gold).toBe(1_000_000 + r.gold);
      expect(res.wood.amount).toBeLessThanOrEqual(1_000_000 - 1000 + 1); // production may add a little
    }));

  it('rests a limit order the merchant does not fill, holding its gold', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const price = merchantBase(ResourceKey.WOOD) / 2;
      const r = await api.ok<MarketPlaceOrderResult>('POST', `cities/${p.cityId}/market/orders`, {
        token: p.token,
        body: { resType: WOOD, side: BUY, amount: 100, price },
      });
      expect(r).toMatchObject({ filled: 0, rest: 100, escrow: Math.ceil(100 * price * (1 + BALANCE.marketFee)) });
      expect(r.order).toMatchObject({ resType: WOOD, tradeType: BUY, amount: 100, price, dealedTotal: 0, cityId: p.cityId, resourceName: 'wood' });
      expect((await cityRes(api, p)).gold).toBe(1_000_000 - r.escrow);
    }));

  it("refuses without a Marketplace, another player's city (403), and validates the body", () =>
    apiTest(async (api) => {
      const p = await api.player();
      const other = await trader(api);
      const body = { resType: WOOD, side: BUY, amount: 10, price: 0.5 };
      const a = await api.refused('POST', `cities/${p.cityId}/market/orders`, 'market.needMarketplace', { token: p.token, body, status: 400 });
      expect(a.body.error?.params).toEqual({ building: { ref: 'building', id: BuildingType.MARKETPLACE } });
      await api.refused('POST', `cities/${other.cityId}/market/orders`, 'common.invalidCastle', { token: p.token, body, status: 403 });
      await expectInvalid(api, p.token, [
        { method: 'POST', url: `cities/${p.cityId}/market/orders`, body: { resType: WOOD, side: BUY } },
        { method: 'POST', url: `cities/${p.cityId}/market/orders`, body: { ...body, type: 'stop' } },
        { method: 'POST', url: `cities/x/market/orders`, body },
      ]);
    }));
});

describe('GET /market/orders/mine', () => {
  it("answers the player's open orders", () =>
    apiTest(async (api) => {
      const p = await trader(api);
      expect(await api.ok('GET', 'market/orders/mine', { token: p.token })).toEqual([]);
      const { order } = await api.ok<MarketPlaceOrderResult>('POST', `cities/${p.cityId}/market/orders`, {
        token: p.token,
        body: { resType: WOOD, side: BUY, amount: 100, price: 0.5 },
      });
      expect(await api.ok<MarketOrder[]>('GET', 'market/orders/mine', { token: p.token })).toEqual([order]);
    }));
});

describe('DELETE /market/orders/:orderId', () => {
  it('cancels an order and gives back what it held', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const { order } = await api.ok<MarketPlaceOrderResult>('POST', `cities/${p.cityId}/market/orders`, {
        token: p.token,
        body: { resType: WOOD, side: BUY, amount: 100, price: 0.5 },
      });
      expect(await api.ok('DELETE', `market/orders/${order!.id}`, { token: p.token })).toBeNull();
      expect(await api.ok('GET', 'market/orders/mine', { token: p.token })).toEqual([]);
      expect((await cityRes(api, p)).gold).toBe(1_000_000);
    }));

  it("answers 404 for another player's order, and validates the path", () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const other = await api.player();
      const { order } = await api.ok<MarketPlaceOrderResult>('POST', `cities/${p.cityId}/market/orders`, {
        token: p.token,
        body: { resType: WOOD, side: BUY, amount: 100, price: 0.5 },
      });
      await api.refused('DELETE', `market/orders/${order!.id}`, 'market.orderNotFound', { token: other.token, status: 404 });
      await expectInvalid(api, p.token, [{ method: 'DELETE', url: 'market/orders/abc' }]);
    }));
});

describe('order limit', () => {
  it('refuses placing and cancelling past BALANCE.marketOrderLimit with 429 market.slowDown and Retry-After; quotes and other players go on', () =>
    apiTest(async (api) => {
      const p = await trader(api);
      const other = await trader(api);
      const { burst, refillMs } = BALANCE.marketOrderLimit;
      const url = (q: { cityId: number }) => `cities/${q.cityId}/market/orders`;
      const body = { resType: WOOD, side: SELL, amount: 1, type: 'market' };
      for (let i = 0; i < burst - 1; i++) await api.ok('POST', url(p), { token: p.token, body });
      // a cancel counts too, refused or not
      await api.refused('DELETE', 'market/orders/999999', 'market.orderNotFound', { token: p.token, status: 404 });
      const a = await api.refused('POST', url(p), 'market.slowDown', { token: p.token, body, status: 429 });
      expect(a.body.error?.params).toEqual({ wait: { duration: expect.any(Number) } });
      const res = await api.app.inject({ method: 'DELETE', url: '/api/v1/market/orders/1', headers: { authorization: `Bearer ${p.token}` } });
      expect(res.statusCode).toBe(429);
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(refillMs / 1000);
      await api.ok('GET', `market/${WOOD}/quote?side=${SELL}&amount=1&type=market`, { token: p.token });
      await api.ok('POST', url(other), { token: other.token, body });
    }));
});

/** With the merchant on its curve and timed delivery, `buyer` bids inside the merchant's spread and `seller` sells into the bid: the wood is shipped to `buyer`. */
async function shipped(api: TestApi) {
  const buyer = await trader(api, 'Buyer');
  const seller = await trader(api, 'Seller');
  const price = Math.round(merchantBase(ResourceKey.WOOD) * 1.03 * 1000) / 1000;
  await api.ok('POST', `cities/${buyer.cityId}/market/orders`, { token: buyer.token, body: { resType: WOOD, side: BUY, amount: 1000, price } });
  const r = await api.ok<MarketPlaceOrderResult>('POST', `cities/${seller.cityId}/market/orders`, {
    token: seller.token,
    body: { resType: WOOD, side: SELL, amount: 1000, type: 'market' },
  });
  expect(r.playerFilled).toBe(1000);
  return { buyer, seller };
}

describe('GET /market/shipments', () => {
  it('answers the goods on their way to the player', () =>
    withShipmentTime(HOUR, () =>
      withMerchantCurve(() =>
        apiTest(async (api) => {
          const { buyer } = await shipped(api);
          const list = await api.ok<MarketShipment[]>('GET', 'market/shipments', { token: buyer.token });
          expect(list).toEqual([
            {
              id: expect.any(Number),
              cityId: buyer.cityId,
              resType: WOOD,
              resourceName: 'wood',
              amount: 1000,
              price: expect.any(Number),
              startTime: expect.any(Number),
              endTime: expect.any(Number),
            },
          ]);
          expect(list[0]!.endTime).toBeGreaterThan(Date.now());
        }),
      ),
    ));
});

describe('POST /market/shipments/:shipmentId/speedup', () => {
  it('delivers now for gold from the receiving city', () =>
    withShipmentTime(HOUR, () =>
      withMerchantCurve(() =>
        apiTest(async (api) => {
          const { buyer } = await shipped(api);
          const [s] = await api.ok<MarketShipment[]>('GET', 'market/shipments', { token: buyer.token });
          const gold = (await cityRes(api, buyer)).gold;
          expect(await api.ok('POST', `market/shipments/${s!.id}/speedup`, { token: buyer.token })).toBeNull();
          const [after] = await api.ok<MarketShipment[]>('GET', 'market/shipments', { token: buyer.token });
          expect(after!.endTime).toBeLessThanOrEqual(Date.now());
          expect((await cityRes(api, buyer)).gold).toBeLessThan(gold);
        }),
      ),
    ));

  it("answers 404 for another player's shipment, and validates the path", () =>
    withShipmentTime(HOUR, () =>
      withMerchantCurve(() =>
        apiTest(async (api) => {
          const { buyer, seller } = await shipped(api);
          const [s] = await api.ok<MarketShipment[]>('GET', 'market/shipments', { token: buyer.token });
          await api.refused('POST', `market/shipments/${s!.id}/speedup`, 'market.shipmentNotFound', { token: seller.token, status: 404 });
          await expectInvalid(api, buyer.token, [{ method: 'POST', url: 'market/shipments/abc/speedup' }]);
        }),
      ),
    ));
});
