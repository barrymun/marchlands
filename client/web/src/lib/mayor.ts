import type { CityBean, HeroBean } from '@marchlands/api-client';
import { BASIC_RESOURCES, heroManagement, mayorProductionBonus } from '@marchlands/core';

/** What a city's fields produce an hour in basic resources (efficiency-adjusted): the base a mayor's bonus adds to. */
export function fieldOutput(city: Pick<CityBean, 'resource'>): number {
  return BASIC_RESOURCES.reduce((sum, r) => sum + city.resource[r].breakdown.fields, 0);
}

/** The share of field output a hero's politics would add as mayor (soft-capped above BALANCE.heroSoftCap.knee when on). */
export const mayorShare = (h: HeroBean) => mayorProductionBonus(heroManagement(h));

/** The resources an hour a hero would add as the city's mayor. */
export const mayorGain = (city: Pick<CityBean, 'resource'>, h: HeroBean) => Math.round(fieldOutput(city) * mayorShare(h));
