import type { FortKey, TroopKey } from '@marchlands/core';

export type Counters = Record<string, number>;

/** What the statistics count by unit: a troop or a fortification. */
export type UnitKey = TroopKey | FortKey;
