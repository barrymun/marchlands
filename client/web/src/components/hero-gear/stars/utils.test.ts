import { describe, expect, it } from 'vitest';
import { starKind } from '@/components/hero-gear/stars/utils';

describe(starKind.name, () => {
  it('shows the stars bought as in use, and the rest as empty', () => {
    expect([0, 1, 2, 3].map((i) => starKind(i, 2))).toEqual(['used', 'used', 'empty', 'empty']);
  });

  it('shows the stars above the research level as waiting', () => {
    expect([0, 1, 2, 3, 4].map((i) => starKind(i, 4, 2))).toEqual(['used', 'used', 'waiting', 'waiting', 'empty']);
  });

  it('shows none in use at research level 0', () => {
    expect(starKind(0, 1, 0)).toBe('waiting');
  });
});
