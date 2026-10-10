import { BALANCE } from '@marchlands/core';
import { RES_KEYS } from '@/components/military-panel/production/constants';

/** Most units of a type the city can order now: resources, idle population and (fortifications) wall space. */
export function maxTrainable(
  u: { typeId: number; population: number } & Record<(typeof RES_KEYS)[number], number>,
  have: Record<(typeof RES_KEYS)[number], number>,
  idlePopulation: number,
  wallRoom: number,
  fort: boolean,
): { count: number; limit: string } {
  const limits: [string, number][] = RES_KEYS.filter((k) => u[k] > 0).map((k) => [k === 'wood' ? 'lumber' : k, Math.floor(have[k] / u[k])]);
  if (u.population > 0) limits.push(['idle population', Math.floor(idlePopulation / u.population)]);
  if (fort) limits.push(['wall space', Math.floor(wallRoom / (BALANCE.fortSpace[u.typeId] ?? 1))]);
  if (!limits.length) return { count: 0, limit: 'resources' };
  const [limit, count] = limits.reduce((a, b) => (b[1] < a[1] ? b : a));
  return { count: Math.max(0, count), limit };
}
