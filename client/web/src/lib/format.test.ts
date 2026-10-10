import { describe, expect, it } from 'vitest';
import { percent } from '@/lib/format';

describe(percent.name, () => {
  it('rounds a fraction to a whole percent', () => {
    expect(percent(0.25)).toBe('25%');
    expect(percent(0.256)).toBe('26%');
    expect(percent(0.004)).toBe('0%');
    expect(percent(1)).toBe('100%');
  });
});
