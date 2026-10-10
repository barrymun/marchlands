import { describe, expect, it } from 'vitest';
import { RESOURCES } from '@/components/market-panel/constants';
import { fmtPrice, resLabel } from '@/components/market-panel/utils';

describe(resLabel.name, () => {
  it('labels every tradeable resource by its type', () => {
    for (const r of RESOURCES) expect(resLabel(r.type)).toBe(r.label);
    expect(resLabel(1)).toBe('Lumber');
  });

  it('labels type 4 as gold', () => {
    expect(resLabel(4)).toBe('Gold');
  });

  it('falls back to "#<type>" for unknown types', () => {
    expect(resLabel(5)).toBe('#5');
    expect(resLabel(-1)).toBe('#-1');
  });
});

describe(fmtPrice.name, () => {
  it('always shows exactly three decimals', () => {
    expect(fmtPrice(1)).toBe('1.000');
    expect(fmtPrice(0)).toBe('0.000');
    expect(fmtPrice(-1.5)).toBe('-1.500');
  });

  it('rounds to three decimals', () => {
    expect(fmtPrice(0.12345)).toBe('0.123');
    expect(fmtPrice(0.9999)).toBe('1.000');
  });

  it('groups thousands', () => {
    expect(fmtPrice(1234.5)).toBe('1,234.500');
    expect(fmtPrice(1_000_000)).toBe('1,000,000.000');
  });
});
