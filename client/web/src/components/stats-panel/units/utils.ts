import { FORT_ID_BY_KEY, TROOP_ID_BY_KEY, type FortKey, type TroopKey } from '@marchlands/core';
import type { Counters } from '@/components/stats-panel/types';
import { troopName } from '@/lib/game-data';

/** A unit counter; `died` is the fallen (`lost`, which includes those who came home injured) less the injured. */
export const unitCount = (c: Counters, g: string, k: string) =>
  g === 'died' ? Math.max(0, (c[`lost.${k}`] ?? 0) - (c[`injured.${k}`] ?? 0)) : (c[`${g}.${k}`] ?? 0);

/** A troop or fortification key's name in the current locale; an unknown key as is. */
export const unitName = (k: string) => {
  if (Object.hasOwn(TROOP_ID_BY_KEY, k)) return troopName(TROOP_ID_BY_KEY[k as TroopKey]);
  return Object.hasOwn(FORT_ID_BY_KEY, k) ? troopName(FORT_ID_BY_KEY[k as FortKey]) : k;
};
