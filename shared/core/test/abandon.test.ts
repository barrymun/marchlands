import { describe, expect, it } from 'vitest';
import { abandonPrestigeBack, BALANCE } from '@marchlands/core';

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
