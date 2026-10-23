import { describe, expect, it } from 'vitest';

import type { CityBean, HeroBean } from '@marchlands/api-client';
import { BALANCE } from '@marchlands/core';

import { fieldOutput, mayorGain, mayorShare } from '@/lib/mayor';

const res = (fields: number) => ({ breakdown: { fields } });
/** A city whose fields make 100 food, 200 lumber, 300 stone and 400 iron an hour (gold isn't a field resource). */
const city = { resource: { gold: res(999), food: res(100), wood: res(200), stone: res(300), iron: res(400) } } as unknown as CityBean;
const hero = (management: number, added = 0, buff = 0) => ({ management, managementAdded: added, managementBuffAdded: buff }) as HeroBean;

describe(fieldOutput.name, () => {
  it('adds up the basic resources the fields make, not gold', () => {
    expect(fieldOutput(city)).toBe(1000);
  });
});

describe(mayorShare.name, () => {
  it('turns politics, gear and boosts included, into a share of production', () => {
    expect(mayorShare(hero(50))).toBeCloseTo(50 * BALANCE.mayorManagementProductionFactor);
    expect(mayorShare(hero(50, 20, 10))).toBeCloseTo(80 * BALANCE.mayorManagementProductionFactor);
  });

  it('is soft-capped above the knee', () => {
    const { knee } = BALANCE.heroSoftCap;
    expect(mayorShare(hero(knee * 4))).toBeLessThan(knee * 4 * BALANCE.mayorManagementProductionFactor);
  });
});

describe(mayorGain.name, () => {
  it('is the share of the field output, rounded', () => {
    expect(mayorGain(city, hero(50))).toBe(Math.round(1000 * 50 * BALANCE.mayorManagementProductionFactor));
  });

  it('is nothing for a hero with no politics, or a city with no fields', () => {
    expect(mayorGain(city, hero(0))).toBe(0);
    expect(mayorGain({ resource: { ...city.resource, food: res(0), wood: res(0), stone: res(0), iron: res(0) } } as CityBean, hero(50))).toBe(0);
  });
});
