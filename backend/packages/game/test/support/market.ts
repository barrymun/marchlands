// Market test helpers: a trader (a player with a Marketplace and plenty of everything), the fee and
// escrow sums the market service uses, and switches for the BALANCE rules a test needs changed for
// its duration: the merchant's price curve (instead of its fixed price) and timed shipments.

import { BALANCE, BuildingType, type ResourceSet } from '@marchlands/core';
import { createTestPlayer, setBuildings, setResources, type TestPlayer } from './factories.ts';
import type { TestGame } from './game.ts';

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

const mutable = BALANCE as unknown as { marketShipmentBaseMs: number; merchant: { fixedPrice: number | null } };

async function withSetting<T>(set: () => () => void, fn: () => Promise<T>): Promise<T> {
  const restore = set();
  try {
    return await fn();
  } finally {
    restore();
  }
}

/** Run `fn` with the merchant on its price curve (BALANCE.merchant.fixedPrice off). */
export const withMerchantCurve = <T>(fn: () => Promise<T>) =>
  withSetting(() => {
    const saved = mutable.merchant.fixedPrice;
    mutable.merchant.fixedPrice = null;
    return () => (mutable.merchant.fixedPrice = saved);
  }, fn);

/** Run `fn` with goods bought on the market travelling `ms` / Marketplace level (BALANCE.marketShipmentBaseMs). */
export const withShipmentTime = <T>(ms: number, fn: () => Promise<T>) =>
  withSetting(() => {
    const saved = mutable.marketShipmentBaseMs;
    mutable.marketShipmentBaseMs = ms;
    return () => (mutable.marketShipmentBaseMs = saved);
  }, fn);
