import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BALANCE, merchantAffordable, merchantAsk, merchantBid, merchantBuys, merchantMarginal, merchantReference, merchantSells, scaled } from '#/index.ts';

const merchantCfg = BALANCE.merchant as { fixedPrice: number | null };
const configuredFixed = merchantCfg.fixedPrice;

describe('merchant (fixed price)', () => {
  beforeAll(() => {
    merchantCfg.fixedPrice = 1;
  });
  afterAll(() => {
    merchantCfg.fixedPrice = configuredFixed;
  });

  it('buys and sells every resource at the fixed price, in any amount', () => {
    for (const r of ['food', 'wood', 'stone', 'iron'] as const) {
      const ref = merchantReference(r, { price: 0.01, at: 0 }, 0);
      expect(ref).toBe(1);
      expect(merchantAsk(ref)).toBe(1);
      expect(merchantBid(ref)).toBe(1);
    }
    expect(merchantSells(1, 5_000_000)).toEqual({ qty: 5_000_000, gold: 5_000_000, ref: 1 });
    expect(merchantBuys(1, 5_000_000)).toEqual({ qty: 5_000_000, gold: 5_000_000, ref: 1 });
    expect(merchantMarginal(1, 'sell', 1e9)).toBe(1);
  });

  it('respects limits: never sells above or buys below the limit', () => {
    expect(merchantSells(1, 100, 0.9).qty).toBe(0);
    expect(merchantSells(1, 100, 1).qty).toBe(100);
    expect(merchantBuys(1, 100, 1.1).qty).toBe(0);
    expect(merchantBuys(1, 100, 1).qty).toBe(100);
  });

  it('affordable units are gold / (price x fee)', () => {
    expect(merchantAffordable(1, 1_000, 1.25)).toBe(800);
  });
});

describe('merchant (curve)', () => {
  beforeAll(() => {
    merchantCfg.fixedPrice = null;
  });
  afterAll(() => {
    merchantCfg.fixedPrice = configuredFixed;
  });

  const base = BALANCE.merchant.basePrice.food;

  it('quotes around the reference with the configured spread', () => {
    expect(merchantAsk(base)).toBeCloseTo(base * (1 + BALANCE.merchant.spread / 2));
    expect(merchantBid(base)).toBeCloseTo(base * (1 - BALANCE.merchant.spread / 2));
  });

  it('prices fills along the curve: small fills at the quote, large ones dearer', () => {
    const small = merchantSells(base, 10);
    expect(small.gold / small.qty).toBeCloseTo(merchantAsk(base), 4);
    const big = merchantSells(base, 500_000);
    expect(big.gold / big.qty).toBeGreaterThan(merchantAsk(base) * 1.2);
    expect(big.ref).toBeGreaterThan(base);
  });

  it('splitting an order costs the same as one big order', () => {
    const one = merchantSells(base, 200_000);
    const a = merchantSells(base, 120_000);
    const b = merchantSells(a.ref, 80_000);
    expect(a.gold + b.gold).toBeCloseTo(one.gold, 6);
  });

  it('a round trip always loses money', () => {
    for (const q of [1_000, 100_000, 3_000_000]) {
      const buy = merchantSells(base, q);
      const sell = merchantBuys(buy.ref, q);
      expect(sell.gold).toBeLessThan(buy.gold);
      expect(sell.ref).toBeCloseTo(base, 9);
    }
  });

  it('limit prices cap the fill at the matching marginal price', () => {
    const fill = merchantSells(base, 1e9, merchantAsk(base) * 1.1);
    expect(fill.qty).toBe(Math.floor(BALANCE.merchant.depth * Math.log(1.1)));
    expect(merchantSells(base, 100, merchantAsk(base) * 0.99).qty).toBe(0);
    expect(merchantBuys(base, 100, merchantBid(base) * 1.01).qty).toBe(0);
    expect(merchantBuys(base, 1e9, merchantBid(base) * 0.9).qty).toBe(Math.floor(BALANCE.merchant.depth * Math.log(1 / 0.9)));
  });

  it('the reference drifts back to the base price', () => {
    const halfLife = scaled(BALANCE.merchant.recoveryHalfLifeMs);
    const p = merchantReference('food', { price: base * 2, at: 0 }, halfLife);
    expect(p).toBeCloseTo(base * Math.SQRT2, 6);
    expect(merchantReference('food', { price: base * 2, at: 0 }, 100 * halfLife)).toBeCloseTo(base, 6);
    expect(merchantReference('food', { price: base * 1000, at: 0 }, 0)).toBeCloseTo(base * BALANCE.merchant.band);
  });
});
