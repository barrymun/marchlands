import { FORT_ID_BY_KEY, type FortKey, TROOP_ID_BY_KEY, type TroopKey } from '@marchlands/core';

import { UnitGroup } from '@/components/stats-panel/constants';
import type { Counters } from '@/components/stats-panel/types';
import { troopName } from '@/lib/game-data';

export const sumPrefix = (c: Counters, prefix: string) => Object.entries(c).reduce((s, [k, v]) => (k.startsWith(prefix) ? s + v : s), 0);

/** A unit counter; `died` is the fallen (`lost`, which includes those who came home injured) less the injured. */
export const unitCount = (c: Counters, g: UnitGroup, k: string) =>
  g === UnitGroup.DIED ? Math.max(0, (c[`lost.${k}`] ?? 0) - (c[`injured.${k}`] ?? 0)) : (c[`${g}.${k}`] ?? 0);

/** A troop or fortification key's name in the current locale; an unknown key as is. */
export const unitName = (k: string) => {
  if (Object.hasOwn(TROOP_ID_BY_KEY, k)) return troopName(TROOP_ID_BY_KEY[k as TroopKey]);
  return Object.hasOwn(FORT_ID_BY_KEY, k) ? troopName(FORT_ID_BY_KEY[k as FortKey]) : k;
};

/** A share of a whole for a bar's length (0 to 1), 0 when the whole is nothing. */
export const shareOf = (part: number, whole: number) => (whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0);
