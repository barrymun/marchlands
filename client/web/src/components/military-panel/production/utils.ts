import { BALANCE, RESOURCE_KEYS, type ResourceKey } from '@marchlands/core';
import { TrainLimit } from '@/components/military-panel/production/constants';
import { i18n } from '@/lib/i18n';

/** Most units of a type the city can order now: resources, idle population and (fortifications) wall space. */
export function maxTrainable(
  u: { typeId: number; population: number } & Record<ResourceKey, number>,
  have: Record<ResourceKey, number>,
  idlePopulation: number,
  wallRoom: number,
  fort: boolean,
): { count: number; limit: TrainLimit } {
  const limits: [TrainLimit, number][] = RESOURCE_KEYS.filter((k) => u[k] > 0).map((k) => [k, Math.floor(have[k] / u[k])]);
  if (u.population > 0) limits.push([TrainLimit.IDLE_POPULATION, Math.floor(idlePopulation / u.population)]);
  if (fort) limits.push([TrainLimit.WALL_SPACE, Math.floor(wallRoom / (BALANCE.fortSpace[u.typeId] ?? 1))]);
  if (!limits.length) return { count: 0, limit: TrainLimit.RESOURCES };
  const [limit, count] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { count: Math.max(0, count), limit };
}

/** What limits an order, as it reads in a sentence ("not enough lumber", "limited by idle population"). */
export function limitLabel(limit: TrainLimit): string {
  switch (limit) {
    case TrainLimit.IDLE_POPULATION:
      return i18n.t('military-panel:limits.idlePopulation');
    case TrainLimit.WALL_SPACE:
      return i18n.t('military-panel:limits.wallSpace');
    case TrainLimit.RESOURCES:
      return i18n.t('military-panel:limits.resources');
    default:
      return i18n.t(`common:resourcesInline.${limit}`);
  }
}
