import { FORT_ID_BY_KEY, TROOP_ID_BY_KEY, TROOP_NAMES, type FortKey, type TroopKey } from '@marchlands/core';
import type { Counters } from '@/components/stats-panel/types';

/** A unit counter; `died` is the fallen (`lost`, which includes those who came home injured) less the injured. */
export const unitCount = (c: Counters, g: string, k: string) =>
  g === 'died' ? Math.max(0, (c[`lost.${k}`] ?? 0) - (c[`injured.${k}`] ?? 0)) : (c[`${g}.${k}`] ?? 0);

export const unitName = (k: string) => TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey] ?? FORT_ID_BY_KEY[k as FortKey]] ?? k;
