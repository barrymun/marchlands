import { StatCounter, StatGroup, statPrefix } from '@marchlands/core';
import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';

import { UnitGroup } from '@/components/stats-panel/constants';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix, unitCount } from '@/components/stats-panel/utils';

/** The page's headline numbers, from the counters. */
export function headline(c: Counters) {
  const units = [...TROOP_KEY_LIST, ...FORT_KEY_LIST];
  const attacksWon = sumPrefix(c, statPrefix(StatGroup.ATTACKS_WON));
  const defensesWon = sumPrefix(c, statPrefix(StatGroup.DEFENSES_WON));
  // the enemy unit type defeated most, if any
  const [topEnemy] = units
    .filter((k) => unitCount(c, UnitGroup.KILLED, k) > 0)
    .sort((a, b) => unitCount(c, UnitGroup.KILLED, b) - unitCount(c, UnitGroup.KILLED, a));
  return {
    attacksWon,
    attacks: attacksWon + sumPrefix(c, statPrefix(StatGroup.ATTACKS_LOST)),
    defensesWon,
    defenses: defensesWon + sumPrefix(c, statPrefix(StatGroup.DEFENSES_LOST)),
    honor: c.honor ?? 0,
    enemies: sumPrefix(c, statPrefix(StatGroup.KILLED)),
    topEnemy: topEnemy ?? null,
    trained: sumPrefix(c, statPrefix(StatGroup.TRAINED)),
    fell: units.reduce((s, k) => s + unitCount(c, UnitGroup.DIED, k), 0),
    citiesCaptured: (c[StatCounter.CAPTURED_CITY] ?? 0) + (c[StatCounter.CAPTURED_NPC] ?? 0),
    valleys: c[StatCounter.CAPTURED_VALLEY] ?? 0,
  };
}
