import { describe, expect, it } from 'vitest';
import { starKind } from '@/components/hero-gear/stars/utils';
import { GearStarKind } from '@/lib/game-art';

describe(starKind.name, () => {
  it('shows the stars bought as in use, and the rest as empty', () => {
    expect([0, 1, 2, 3].map((i) => starKind(i, 2))).toEqual([GearStarKind.USED, GearStarKind.USED, GearStarKind.EMPTY, GearStarKind.EMPTY]);
  });

  it('shows the stars above the research level as waiting', () => {
    expect([0, 1, 2, 3, 4].map((i) => starKind(i, 4, 2))).toEqual([
      GearStarKind.USED,
      GearStarKind.USED,
      GearStarKind.WAITING,
      GearStarKind.WAITING,
      GearStarKind.EMPTY,
    ]);
  });

  it('shows none in use at research level 0', () => {
    expect(starKind(0, 1, 0)).toBe(GearStarKind.WAITING);
  });
});
