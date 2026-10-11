import { BALANCE } from '@marchlands/core';
import { i18n } from '@/lib/i18n';
import { RES_KEYS } from '@/components/military-panel/production/constants';
import type { TrainLimit } from '@/components/military-panel/production/types';

/** Most units of a type the city can order now: resources, idle population and (fortifications) wall space. */
export function maxTrainable(
  u: { typeId: number; population: number } & Record<(typeof RES_KEYS)[number], number>,
  have: Record<(typeof RES_KEYS)[number], number>,
  idlePopulation: number,
  wallRoom: number,
  fort: boolean,
): { count: number; limit: TrainLimit } {
  const limits: [TrainLimit, number][] = RES_KEYS.filter((k) => u[k] > 0).map((k) => [k, Math.floor(have[k] / u[k])]);
  if (u.population > 0) limits.push(['idlePopulation', Math.floor(idlePopulation / u.population)]);
  if (fort) limits.push(['wallSpace', Math.floor(wallRoom / (BALANCE.fortSpace[u.typeId] ?? 1))]);
  if (!limits.length) return { count: 0, limit: 'resources' };
  const [limit, count] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { count: Math.max(0, count), limit };
}

/** What limits an order, as it reads in a sentence ("not enough lumber", "limited by idle population"). */
export function limitLabel(limit: TrainLimit): string {
  switch (limit) {
    case 'idlePopulation':
      return i18n.t('military-panel:limits.idlePopulation');
    case 'wallSpace':
      return i18n.t('military-panel:limits.wallSpace');
    case 'resources':
      return i18n.t('military-panel:limits.resources');
    default:
      return i18n.t(`common:resourcesInline.${limit}`);
  }
}
