// Market test helpers: a trader (a player with a Marketplace and plenty of everything), the fee and
// escrow sums the market service uses, and switches for the BALANCE rules a test needs changed for
// its duration: the merchant's price curve (instead of its fixed price) and timed shipments.

import { BALANCE, BuildingType, MarketOrderType, MarketSide, merchantBase, ResourceKey, type ResourceSet } from '@marchlands/core';

import { market } from '#/index.ts';
import { createTestPlayer, setBuildings, setResources, type TestPlayer } from '#test/support/factories.ts';
import type { TestGame } from '#test/support/game.ts';

export const GOLD = 4;
export const Res = { FOOD: 0, WOOD: 1, STONE: 2, IRON: 3 } as const;

/** What the buyer pays for `gold` worth of goods (the fee, rounded up). */
export const withFee = (gold: number) => Math.ceil(gold * (1 + BALANCE.marketFee));
/** Gold held for a resting bid. */
export const escrowGold = (amount: number, price: number) => Math.ceil(amount * price * (1 + BALANCE.marketFee));

/** A new player with a Marketplace (position 3) and 1,000,000 of each resource unless given. */
export async function createTrader(g: TestGame, res: Partial<ResourceSet> = {}, marketLevel = 1): Promise<TestPlayer> {
  const p = await createTestPlayer(g);
  await setBuildings(g, p, [[3, BuildingType.MARKETPLACE, marketLevel]]);
  await setResources(g, p, { gold: 1_000_000, food: 1_000_000, wood: 1_000_000, stone: 1_000_000, iron: 1_000_000, ...res });
  return p;
}

const mutable = BALANCE as unknown as { marketShipmentBaseMs: number; merchant: { fixedPrice: number | null; spread: number } };

async function withSetting<T>(set: () => () => void, fn: () => Promise<T>): Promise<T> {
  const restore = set();
  try {
    return await fn();
  } finally {
    restore();
  }
}

/**
 * Run `fn` with the merchant on its price curve (BALANCE.merchant.fixedPrice off) and the 10% spread the curve was
 * tuned with, which these tests' prices assume (the fixed price uses a wider one).
 */
export const withMerchantCurve = <T>(fn: () => Promise<T>) =>
  withSetting(() => {
    const saved = { ...mutable.merchant };
    mutable.merchant.fixedPrice = null;
    mutable.merchant.spread = 0.1;
    return () => Object.assign(mutable.merchant, saved);
  }, fn);

/** Run `fn` with goods bought on the market travelling `ms` / Marketplace level (BALANCE.marketShipmentBaseMs). */
export const withShipmentTime = <T>(ms: number, fn: () => Promise<T>) =>
  withSetting(() => {
    const saved = mutable.marketShipmentBaseMs;
    mutable.marketShipmentBaseMs = ms;
    return () => (mutable.marketShipmentBaseMs = saved);
  }, fn);

export const bidPrice = () => Math.round(merchantBase(ResourceKey.WOOD) * 1.03 * 1000) / 1000;

export async function shipWoodTo(g: TestGame, a: TestPlayer, b: TestPlayer, amount = 1000) {
  await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount, price: bidPrice() });
  await market.placeOrder(g, a.id, a.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount, type: MarketOrderType.MARKET });
  const [s] = await market.myShipments(g, b.id);
  return s;
}
