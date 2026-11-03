import { describe, expect, it } from 'vitest';
import { dayMoment, indexAt, sparkPoints } from '@/components/stats-panel/headline/stat-tile/sparkline/utils';

describe(sparkPoints.name, () => {
  it('spreads the values evenly across, 0 at the bottom and the largest at the top', () => {
    expect(sparkPoints([0, 5, 10], 100, 22)).toEqual([
      { x: 0, y: 21 },
      { x: 50, y: 11 },
      { x: 100, y: 1 },
    ]);
  });

  it('keeps every value at the bottom when there is nothing', () => {
    expect(sparkPoints([0, 0], 10, 10, 0)).toEqual([
      { x: 0, y: 10 },
      { x: 10, y: 10 },
    ]);
  });

  it('puts a single value in the middle, and none nowhere', () => {
    expect(sparkPoints([4], 100, 20, 0)).toEqual([{ x: 50, y: 0 }]);
    expect(sparkPoints([], 100, 20)).toEqual([]);
  });

  it('draws a negative value at the bottom', () => {
    expect(sparkPoints([-5, 5], 10, 10, 0)).toEqual([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
    ]);
  });
});

describe(indexAt.name, () => {
  it('finds the nearest value across', () => {
    expect(indexAt(0, 100, 30)).toBe(0);
    expect(indexAt(100, 100, 30)).toBe(29);
    expect(indexAt(50, 100, 3)).toBe(1);
    expect(indexAt(24, 100, 3)).toBe(0);
    expect(indexAt(26, 100, 3)).toBe(1);
  });

  it('stays within the values past either end', () => {
    expect(indexAt(-10, 100, 7)).toBe(0);
    expect(indexAt(140, 100, 7)).toBe(6);
  });

  it('is the only value of one, and nothing of none or no width', () => {
    expect(indexAt(80, 100, 1)).toBe(0);
    expect(indexAt(50, 100, 0)).toBeNull();
    expect(indexAt(50, 0, 7)).toBeNull();
  });
});

describe(dayMoment.name, () => {
  it('is the UTC noon of the day', () => {
    expect(dayMoment('2026-11-03')).toBe(Date.UTC(2026, 10, 3, 12));
  });

  it('is not a number for something that is not a day', () => {
    expect(dayMoment('soon')).toBeNaN();
  });
});
