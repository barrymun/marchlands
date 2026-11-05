import type { CityBean } from '@marchlands/api-client';
import { FLOW_MAX_TARGETS_PER_CITY, HeroStatus } from '@marchlands/core';

/** Idle heroes in a city: each can lead one attack. */
export const idleHeroes = (c: Pick<CityBean, 'heros'>) => c.heros.filter((h) => h.status === HeroStatus.IDLE).length;

/** Most targets a city can list: its idle heroes (and at most FLOW_MAX_TARGETS_PER_CITY). */
export const targetCap = (c: Pick<CityBean, 'heros'>) => Math.min(FLOW_MAX_TARGETS_PER_CITY, idleHeroes(c));
