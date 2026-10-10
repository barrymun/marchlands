import { describe, expect, it } from 'vitest';
import { pct, range } from '@/components/items-panel/medal-sources-info/utils';

describe(pct.name, () => {
  it('rounds to whole percent from 10% up', () => {
    expect(pct(0.1)).toBe('10%');
    expect(pct(0.256)).toBe('26%');
    expect(pct(1)).toBe('100%');
  });

  it('keeps one decimal below 10%', () => {
    expect(pct(0.05)).toBe('5.0%');
    expect(pct(0.0125)).toBe('1.3%');
    expect(pct(0)).toBe('0.0%');
  });
});

describe(range.name, () => {
  it('shows a single number when min equals max', () => {
    expect(range(2, 2)).toBe('2');
  });

  it('shows min–max with an en dash otherwise', () => {
    expect(range(1, 3)).toBe('1–3');
  });
});
