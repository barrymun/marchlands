import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';

import { UnitGroup } from '@/components/stats-panel/constants';
import type { Counters } from '@/components/stats-panel/types';
import { sumPrefix, unitCount } from '@/components/stats-panel/utils';

/** The page's headline numbers, from the counters. */
export function headline(c: Counters) {
  const units = [...TROOP_KEY_LIST, ...FORT_KEY_LIST];
  const attacksWon = sumPrefix(c, 'attacks.won.');
  const defensesWon = sumPrefix(c, 'defenses.won.');
  // the enemy unit type defeated most, if any
  const [topEnemy] = units
    .filter((k) => unitCount(c, UnitGroup.KILLED, k) > 0)
    .sort((a, b) => unitCount(c, UnitGroup.KILLED, b) - unitCount(c, UnitGroup.KILLED, a));
  return {
    attacksWon,
    attacks: attacksWon + sumPrefix(c, 'attacks.lost.'),
    defensesWon,
    defenses: defensesWon + sumPrefix(c, 'defenses.lost.'),
    honor: c.honor ?? 0,
    enemies: sumPrefix(c, 'killed.'),
    topEnemy: topEnemy ?? null,
    trained: sumPrefix(c, 'trained.'),
    fell: units.reduce((s, k) => s + unitCount(c, UnitGroup.DIED, k), 0),
    citiesCaptured: (c['captured.city'] ?? 0) + (c['captured.npc'] ?? 0),
    valleys: c['captured.valley'] ?? 0,
  };
}
