import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';
import type { Counters } from '@/components/stats-panel/types';
import { unitCount } from '@/components/stats-panel/utils';

/**
 * The enemy troops and fortifications defeated, most first: the first `top` by type, and the rest added up (how many
 * types and units).
 */
export function enemyRows(c: Counters, top: number) {
  const all = [...TROOP_KEY_LIST, ...FORT_KEY_LIST]
    .map((key) => ({ key, count: unitCount(c, 'killed', key) }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);
  const rest = all.slice(top);
  return { rows: all.slice(0, top), rest: { types: rest.length, count: rest.reduce((s, x) => s + x.count, 0) } };
}
