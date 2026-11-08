import { describe, expect, it } from 'vitest';
import { medalName } from '@/components/map-panel/medal-odds/utils';

describe(medalName.name, () => {
  it('names each medal level by its short name', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(medalName)).toEqual(['Cross', 'Rose', 'Lion', 'Honour', 'Courage', 'Wisdom', 'Fidelity', 'Justice', 'Crown']);
  });

  it('clamps levels outside 1..9 (core medalId)', () => {
    expect(medalName(0)).toBe('Cross');
    expect(medalName(-3)).toBe('Cross');
    expect(medalName(10)).toBe('Crown');
  });
});
