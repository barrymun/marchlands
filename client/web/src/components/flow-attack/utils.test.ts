import { describe, expect, it } from 'vitest';

import type { CityBean } from '@marchlands/api-client';
import { FLOW_MAX_TARGETS_PER_CITY, HeroStatus, Sex } from '@marchlands/core';

import { idleHeroes, targetCap } from '@/components/flow-attack/utils';

type Hero = CityBean['heros'][number];

let nextId = 1;

const hero = (status: HeroStatus): Hero => ({
  id: nextId++,
  name: `Hero ${nextId}`,
  logoUrl: '',
  status,
  level: 10,
  upgradeExp: 0,
  loyalty: 100,
  power: 50,
  management: 50,
  stratagem: 50,
  powerAdded: 0,
  managementAdded: 0,
  stratagemAdded: 0,
  powerBuffAdded: 0,
  managementBuffAdded: 0,
  stratagemBuffAdded: 0,
  remainPoint: 0,
  basePower: 50,
  baseManagement: 50,
  baseStratagem: 50,
  cityId: 1,
  locked: false,
  experience: 0,
  gearStat: 'power',
  sex: Sex.MALE,
  buffs: [],
});

const city = (...heros: Hero[]): Pick<CityBean, 'heros'> => ({ heros });

const idle = (n: number) => Array.from({ length: n }, () => hero(HeroStatus.IDLE));

describe(idleHeroes.name, () => {
  it('is 0 for a city without heroes', () => {
    expect(idleHeroes(city())).toBe(0);
  });

  it('counts only idle heroes', () => {
    const c = city(hero(HeroStatus.IDLE), hero(HeroStatus.MAYOR), hero(HeroStatus.ATTACK), hero(HeroStatus.RETURN), hero(HeroStatus.IDLE));
    expect(idleHeroes(c)).toBe(2);
  });

  it('is 0 when every hero is busy', () => {
    expect(idleHeroes(city(hero(HeroStatus.MAYOR), hero(HeroStatus.ATTACK)))).toBe(0);
  });
});

describe(targetCap.name, () => {
  it('is one target per idle hero', () => {
    expect(targetCap(city(...idle(3), hero(HeroStatus.MAYOR)))).toBe(3);
    expect(targetCap(city(hero(HeroStatus.IDLE)))).toBe(1);
  });

  it('is 0 without idle heroes', () => {
    expect(targetCap(city())).toBe(0);
    expect(targetCap(city(hero(HeroStatus.ATTACK)))).toBe(0);
  });

  it('stops at FLOW_MAX_TARGETS_PER_CITY', () => {
    expect(targetCap(city(...idle(FLOW_MAX_TARGETS_PER_CITY)))).toBe(FLOW_MAX_TARGETS_PER_CITY);
    expect(targetCap(city(...idle(FLOW_MAX_TARGETS_PER_CITY + 5)))).toBe(FLOW_MAX_TARGETS_PER_CITY);
  });
});
