import { describe, expect, it } from 'vitest';

import type { CityBean } from '@marchlands/api-client';
import { HeroStatus, Mission } from '@marchlands/core';

import { bestIdleHero, capTroops, defaultHero, firstLanding, landingTime, utcFields } from '@/components/send-army-dialog/send-form/utils';

type Hero = CityBean['heros'][number];

const hero = (id: number, power: number, status: HeroStatus = HeroStatus.IDLE, seized = false) =>
  ({ id, status, seized, power, powerAdded: 0, powerBuffAdded: 0 }) as Hero;

describe(bestIdleHero.name, () => {
  it('is the idle hero with the highest Attack, counting added and item points', () => {
    const boosted = { ...hero(3, 40), powerAdded: 10, powerBuffAdded: 20 };
    expect(bestIdleHero([hero(1, 50), hero(2, 60), boosted])).toBe('3');
  });

  it('leaves out busy and captive heroes', () => {
    expect(bestIdleHero([hero(1, 90, HeroStatus.MAYOR), hero(2, 80, HeroStatus.ATTACK), hero(3, 99, HeroStatus.IDLE, true), hero(4, 10)])).toBe('4');
  });

  it('leaves out the excluded hero (one just sent)', () => {
    expect(bestIdleHero([hero(1, 90), hero(2, 50)], 1)).toBe('2');
  });

  it("is 'none' without an idle hero", () => {
    expect(bestIdleHero([])).toBe('none');
    expect(bestIdleHero([hero(1, 90)], 1)).toBe('none');
  });
});

describe(defaultHero.name, () => {
  const heros = [hero(1, 90), hero(2, 50)];

  it('is the strongest idle hero for an attack, leaving out the excluded one', () => {
    expect(defaultHero(Mission.ATTACK, heros)).toBe('1');
    expect(defaultHero(Mission.ATTACK, heros, 1)).toBe('2');
  });

  it("is 'none' for every other mission", () => {
    for (const m of [Mission.TRANSPORT, Mission.REINFORCE, Mission.SCOUT, Mission.BUILD_CITY]) expect(defaultHero(m, heros)).toBe('none');
  });
});

describe(capTroops.name, () => {
  it('caps each amount to what the city has', () => {
    expect(capTroops({ archer: '5000', militia: '20' }, { archer: 4900, militia: 100 })).toEqual({ archer: '4900', militia: '20' });
  });

  it('caps a troop type the city no longer has to 0', () => {
    expect(capTroops({ archer: '100' }, {})).toEqual({ archer: '0' });
  });

  it('keeps an empty field empty', () => {
    expect(capTroops({ archer: '', militia: undefined }, { archer: 10 })).toEqual({ archer: '', militia: undefined });
  });
});

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
