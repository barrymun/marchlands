import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setGameSpeed } from '@marchlands/core';
import { clockTime, dateTime, duration, fmt, fmtDecimal, fmtExact, percent, resourceLabel, shortDuration, signed, signedRate } from '@/lib/format';
import { buildingName, troopName } from '@/lib/game-data';
import { i18n } from '@/lib/i18n';

beforeEach(() => setGameSpeed(1));
afterEach(async () => {
  setGameSpeed(1);
  await i18n.changeLanguage('en-GB');
});

describe(percent.name, () => {
  it('rounds a fraction to a whole percent', () => {
    expect(percent(0.25)).toBe('25%');
    expect(percent(0.256)).toBe('26%');
    expect(percent(0.004)).toBe('0%');
    expect(percent(1)).toBe('100%');
  });
});

describe(fmt.name, () => {
  it('writes whole numbers below 100,000 in full, rounding down', () => {
    expect(fmt(1234.9)).toBe('1,234');
  });

  it('abbreviates from 100,000 on', () => {
    expect(fmt(1_234_567)).toBe('1.2M');
    expect(fmt(-250_000)).toBe('-250K');
  });

  it('follows the locale (Japanese counts in 万)', async () => {
    await i18n.changeLanguage('ja-JP');
    expect(fmt(1_234_567)).toBe('123.5万');
    expect(fmt(1234.9)).toBe('1,234');
  });
});

describe(fmtExact.name, () => {
  it('never abbreviates', () => {
    expect(fmtExact(1_234_567.8)).toBe('1,234,567');
  });
});

describe(signed.name, () => {
  it('always shows the sign', () => {
    expect(signed(-5)).toBe('-5');
    expect(signed(150_000)).toBe('+150K');
    expect(signed(0)).toBe('+0');
  });
});

describe(signedRate.name, () => {
  it('is per real hour: a game-hour rate times the game speed', () => {
    expect(signedRate(100)).toBe('+100/h');
    setGameSpeed(60);
    expect(signedRate(100)).toBe('+6,000/h');
  });

  it('uses the locale unit', async () => {
    await i18n.changeLanguage('ja-JP');
    expect(signedRate(100)).toBe('+100/時');
  });
});

describe(duration.name, () => {
  it('shows the units that matter, padding the smaller ones', () => {
    expect(duration(3_723_000)).toBe('1h 02m 03s');
    expect(duration(90_061_000)).toBe('1d 1h 01m');
    expect(duration(65_000)).toBe('1m 05s');
    expect(duration(9_000)).toBe('9s');
  });

  it('rounds up to the second and never goes below 0', () => {
    expect(duration(1)).toBe('1s');
    expect(duration(-5_000)).toBe('0s');
  });

  it('uses the locale units', async () => {
    await i18n.changeLanguage('ja-JP');
    expect(duration(3_723_000)).toBe('1時間 02分 03秒');
    expect(duration(90_061_000)).toBe('1日 1時間 01分');
  });
});

describe(shortDuration.name, () => {
  it('keeps the two largest units', () => {
    expect(shortDuration(3_723_000)).toBe('1h 02m');
    expect(shortDuration(9_000)).toBe('9s');
  });
});

describe(resourceLabel.name, () => {
  it('names a resource in the locale (wood is lumber)', async () => {
    expect(resourceLabel('wood')).toBe('Lumber');
    expect(resourceLabel('gold')).toBe('Gold');
    await i18n.changeLanguage('ja-JP');
    expect(resourceLabel('wood')).toBe('木材');
  });
});

describe(troopName.name, () => {
  it('falls back to the id for an unknown troop', () => {
    expect(troopName(999)).toBe('Unit 999');
  });
});

describe(buildingName.name, () => {
  it('falls back to the id for an unknown building', () => {
    expect(buildingName(999)).toBe('Building 999');
  });
});

describe(fmtDecimal.name, () => {
  it('keeps up to the given decimals, at least the minimum, never abbreviating', () => {
    expect(fmtDecimal(1234.5678, 2)).toBe('1,234.57');
    expect(fmtDecimal(2, 1)).toBe('2');
    expect(fmtDecimal(0.5, 3, 3)).toBe('0.500');
    expect(fmtDecimal(1_234_567.1, 1)).toBe('1,234,567.1');
  });
});

// built from local time, so the expected text holds in any time zone
const AT = new Date(2026, 9, 11, 13, 4, 5).getTime();

describe(dateTime.name, () => {
  it('writes the date and time the way the locale does', async () => {
    expect(dateTime(AT)).toBe('11/10/2026, 13:04:05');
    await i18n.changeLanguage('en-US');
    expect(dateTime(AT)).toBe('10/11/2026, 1:04:05 PM');
    await i18n.changeLanguage('ja-JP');
    expect(dateTime(AT)).toBe('2026/10/11 13:04:05');
  });
});

describe(clockTime.name, () => {
  it('writes the time of day, without seconds when short', async () => {
    expect(clockTime(AT)).toBe('13:04:05');
    expect(clockTime(AT, true)).toBe('13:04');
    await i18n.changeLanguage('en-US');
    expect(clockTime(AT)).toBe('1:04:05 PM');
    expect(clockTime(AT, true)).toBe('01:04 PM');
  });
});
