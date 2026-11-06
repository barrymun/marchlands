import { FORT_KEY_LIST, TROOP_KEY_LIST } from '@marchlands/core';

import { UnitGroup } from '@/components/stats-panel/constants';
import type { Counters, UnitKey } from '@/components/stats-panel/types';
import { unitCount } from '@/components/stats-panel/utils';

/** What became of each of the player's own unit types: trained, fallen for good, injured, healed, deserted, disbanded. */
export interface TroopRow {
  key: UnitKey;
  trained: number;
  died: number;
  injured: number;
  healed: number;
  deserted: number;
  disbanded: number;
}

/** A row's bar: as long as the most of trained and fallen (troops can fall that were never trained, drafted ones), and the fallen part. */
export const troopBar = (r: TroopRow) => ({ total: Math.max(r.trained, r.died), fell: r.died });

/** The player's units with anything to show, troops then fortifications, the biggest bar first. */
export function troopRows(c: Counters): TroopRow[] {
  return [...TROOP_KEY_LIST, ...FORT_KEY_LIST]
    .map((key) => ({
      key,
      trained: unitCount(c, UnitGroup.TRAINED, key),
      died: unitCount(c, UnitGroup.DIED, key),
      injured: unitCount(c, UnitGroup.INJURED, key),
      healed: unitCount(c, UnitGroup.HEALED, key),
      deserted: unitCount(c, UnitGroup.DESERTED, key),
      disbanded: unitCount(c, UnitGroup.DISBANDED, key),
    }))
    .filter((r) => r.trained + r.died + r.injured + r.healed + r.deserted + r.disbanded > 0)
    .sort((a, b) => troopBar(b).total - troopBar(a).total);
}
