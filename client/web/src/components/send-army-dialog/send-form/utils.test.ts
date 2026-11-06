import { describe, expect, it } from 'vitest';

import type { CityBean } from '@marchlands/api-client';
import { HeroStatus, Mission } from '@marchlands/core';

import { NO_HERO } from '@/components/send-army-dialog/send-form/constants';
import { bestIdleHero, capTroops, defaultHero, freeTroops } from '@/components/send-army-dialog/send-form/utils';

type Hero = CityBean['heros'][number];

const hero = (id: number, power: number, status: HeroStatus = HeroStatus.IDLE) => ({ id, status, power, powerAdded: 0, powerBuffAdded: 0 }) as Hero;

describe(bestIdleHero.name, () => {
  it('is the idle hero with the highest Attack, counting added and item points', () => {
    const boosted = { ...hero(3, 40), powerAdded: 10, powerBuffAdded: 20 };
    expect(bestIdleHero([hero(1, 50), hero(2, 60), boosted])).toBe('3');
  });

  it('leaves out busy heroes', () => {
    expect(bestIdleHero([hero(1, 90, HeroStatus.MAYOR), hero(2, 80, HeroStatus.ATTACK), hero(4, 10)])).toBe('4');
  });

  it('leaves out the excluded hero (one just sent)', () => {
    expect(bestIdleHero([hero(1, 90), hero(2, 50)], 1)).toBe('2');
  });

  it("is 'none' without an idle hero", () => {
    expect(bestIdleHero([])).toBe(NO_HERO);
    expect(bestIdleHero([hero(1, 90)], 1)).toBe(NO_HERO);
  });
});

describe(defaultHero.name, () => {
  const heros = [hero(1, 90), hero(2, 50)];

  it('is the strongest idle hero for an attack, leaving out the excluded one', () => {
    expect(defaultHero(Mission.ATTACK, heros)).toBe('1');
    expect(defaultHero(Mission.ATTACK, heros, 1)).toBe('2');
  });

  it("is 'none' for every other mission", () => {
    for (const m of [Mission.TRANSPORT, Mission.REINFORCE, Mission.SCOUT, Mission.BUILD_CITY]) expect(defaultHero(m, heros)).toBe(NO_HERO);
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

describe(freeTroops.name, () => {
  it('takes the planned troops from those at home', () => {
    expect(freeTroops({ archer: 100, militia: 10 }, { archer: 40 })).toEqual({ archer: 60, militia: 10 });
  });

  it('never goes below zero (troops lost since the wave was planned)', () => {
    expect(freeTroops({ archer: 10 }, { archer: 40, militia: 5 })).toEqual({ archer: 0 });
  });
});
