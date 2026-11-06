import { StatGroup, statKey } from '@marchlands/core';

import { UNIT_IDS, UnitGroup } from '@/components/stats-panel/constants';
import type { Counters, UnitKey } from '@/components/stats-panel/types';
import { troopName } from '@/lib/game-data';

export const sumPrefix = (c: Counters, prefix: string) => Object.entries(c).reduce((s, [k, v]) => (k.startsWith(prefix) ? s + v : s), 0);

/** A unit counter; `died` is the fallen (`lost`, which includes those who came home injured) less the injured. */
export const unitCount = (c: Counters, g: UnitGroup, k: UnitKey) =>
  g === UnitGroup.DIED ? Math.max(0, (c[statKey(StatGroup.LOST, k)] ?? 0) - (c[statKey(StatGroup.INJURED, k)] ?? 0)) : (c[`${g}.${k}`] ?? 0);

/** A troop or fortification key's name in the current locale. */
export const unitName = (k: UnitKey) => troopName(UNIT_IDS[k]);

/** A share of a whole for a bar's length (0 to 1), 0 when the whole is nothing. */
export const shareOf = (part: number, whole: number) => (whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0);
