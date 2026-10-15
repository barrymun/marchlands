import { describe, expect, it } from 'vitest';
import { dismissCount } from '@/components/military-panel/dismiss-dialog/utils';

describe(dismissCount.name, () => {
  it('is everything the city has when the field is empty', () => {
    expect(dismissCount('', 25)).toBe(25);
    expect(dismissCount('', 0)).toBe(0);
  });

  it('is the amount entered, up to what the city has', () => {
    expect(dismissCount('10', 25)).toBe(10);
    expect(dismissCount('40', 25)).toBe(25);
  });

  it('is nothing for zero or anything not a whole number', () => {
    expect(dismissCount('0', 25)).toBe(0);
    expect(dismissCount('1.5', 25)).toBe(0);
    expect(dismissCount('abc', 25)).toBe(0);
  });
});
