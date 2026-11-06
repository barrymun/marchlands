import { describe, expect, it } from 'vitest';
import { BuildingArea } from '@marchlands/core';
import { areaOf } from '@/components/buildings-panel/building-dialog/build-list/utils';

describe(areaOf.name, () => {
  it('treats position -2 as the walls', () => {
    expect(areaOf(-2)).toBe(BuildingArea.WALLS);
  });

  it('treats positions from 1000 up as outside the city', () => {
    expect(areaOf(1000)).toBe(BuildingArea.OUTSIDE);
    expect(areaOf(1001)).toBe(BuildingArea.OUTSIDE);
    expect(areaOf(1040)).toBe(BuildingArea.OUTSIDE);
  });

  it('treats everything else as inside the city', () => {
    expect(areaOf(0)).toBe(BuildingArea.INSIDE);
    expect(areaOf(31)).toBe(BuildingArea.INSIDE);
    expect(areaOf(999)).toBe(BuildingArea.INSIDE);
    expect(areaOf(-1)).toBe(BuildingArea.INSIDE);
  });
});
