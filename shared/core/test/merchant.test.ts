import { describe, expect, it } from 'vitest';
import { BALANCE, merchantAsk, merchantBid, merchantBuys, merchantReference, merchantSells, scaled } from '../src/index.ts';

describe('merchant', () => {
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
