import { describe, expect, it } from 'vitest';
import { abandonPrestigeBack, BALANCE, splitCounts, splitEvenly } from '@marchlands/core';

describe(abandonPrestigeBack.name, () => {
  const window = BALANCE.abandon.prestigeBackMs;
  const city = { capturePrestige: 10_000, capturedAt: 1_000 };

  it('takes the capture’s prestige back within the window', () => {
    expect(abandonPrestigeBack(city, 1_000)).toBe(10_000);
    expect(abandonPrestigeBack(city, 1_000 + window - 1)).toBe(10_000);
  });

  it('takes nothing back once the window is over', () => {
    expect(abandonPrestigeBack(city, 1_000 + window)).toBe(0);
  });

  it('takes nothing back from a city never captured', () => {
    expect(abandonPrestigeBack({ capturePrestige: 0, capturedAt: 0 }, 5)).toBe(0);
  });
});

describe(splitEvenly.name, () => {
  it('shares evenly, what is left over going to the first', () => {
    expect(splitEvenly(10, 2)).toEqual([5, 5]);
    expect(splitEvenly(11, 3)).toEqual([5, 3, 3]);
    expect(splitEvenly(2, 3)).toEqual([2, 0, 0]);
  });

  it('gives one part all of it, a fraction too', () => {
    expect(splitEvenly(10.5, 1)).toEqual([10.5]);
  });

  it('loses nothing, a resource’s fraction going to the first', () => {
    const shares = splitEvenly(1_000_000.75, 3);
    expect(shares).toEqual([333_334.75, 333_333, 333_333]);
    expect(shares.reduce((sum, n) => sum + n, 0)).toBe(1_000_000.75);
  });

  it('shares nothing as nothing', () => {
    expect(splitEvenly(0, 2)).toEqual([0, 0]);
  });

  it('has no parts for no one', () => {
    expect(splitEvenly(10, 0)).toEqual([]);
  });
});

describe(splitCounts.name, () => {
  it('shares each kind by itself', () => {
    expect(splitCounts({ archer: 5, militia: 4 }, 2)).toEqual([
      { archer: 3, militia: 2 },
      { archer: 2, militia: 2 },
    ]);
  });

  it('leaves out what a part gets none of', () => {
    expect(splitCounts({ archer: 1, militia: 0 }, 2)).toEqual([{ archer: 1 }, {}]);
  });

  it('has a set for each part with nothing to share, and none for no one', () => {
    expect(splitCounts({}, 2)).toEqual([{}, {}]);
    expect(splitCounts({ archer: 5 }, 0)).toEqual([]);
  });
});
