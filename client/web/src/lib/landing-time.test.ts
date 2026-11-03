import { describe, expect, it } from 'vitest';
import { firstLanding, landingTime, utcFields } from '@/lib/landing-time';

describe(landingTime.name, () => {
  it('reads a UTC date and a time, with or without seconds', () => {
    expect(landingTime('2026-11-01', '20:00:05')).toBe(Date.UTC(2026, 10, 1, 20, 0, 5));
    expect(landingTime('2026-11-01', '20:00')).toBe(Date.UTC(2026, 10, 1, 20, 0, 0));
  });

  it('refuses anything else', () => {
    expect(landingTime('', '20:00')).toBeNull();
    expect(landingTime('2026-11-01', '')).toBeNull();
    expect(landingTime('1/11/2026', '20:00')).toBeNull();
    expect(landingTime('2026-11-01', '8pm')).toBeNull();
    expect(landingTime('2026-13-45', '20:00')).toBeNull();
  });
});

describe(utcFields.name, () => {
  it('writes a moment as its UTC date and time to the second', () => {
    expect(utcFields(Date.UTC(2026, 10, 1, 9, 5, 7, 900))).toEqual({ date: '2026-11-01', time: '09:05:07' });
  });

  it('reads back as the same second', () => {
    const at = Date.UTC(2026, 11, 31, 23, 59, 59);
    const { date, time } = utcFields(at);
    expect(landingTime(date, time)).toBe(at);
  });
});

describe(firstLanding.name, () => {
  it('rounds up to the minute, at least a minute after the soonest landing', () => {
    const now = Date.UTC(2026, 10, 1, 20, 0, 10);
    expect(firstLanding(now, 90_000)).toBe(Date.UTC(2026, 10, 1, 20, 3, 0));
    expect(firstLanding(Date.UTC(2026, 10, 1, 20, 0, 0), 0)).toBe(Date.UTC(2026, 10, 1, 20, 1, 0));
  });
});
