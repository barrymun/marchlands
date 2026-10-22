import { describe, expect, it } from 'vitest';
import { priceChange } from '@/components/market-panel/market-bar/utils';

describe(priceChange.name, () => {
  it('is the move since the opening price, as a share', () => {
    expect(priceChange(1, 1.02)).toBeCloseTo(0.02, 12);
    expect(priceChange(1, 0.95)).toBeCloseTo(-0.05, 12);
    expect(priceChange(1, 1)).toBe(0);
  });

  it('is 0 without an opening price', () => {
    expect(priceChange(0, 1)).toBe(0);
  });
});
