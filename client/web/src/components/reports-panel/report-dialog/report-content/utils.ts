import { FORT_ID_BY_KEY, TROOP_ID_BY_KEY, TROOP_NAMES, type FortKey, type TroopKey } from '@marchlands/core';

export const troopLabel = (k: string) => TROOP_NAMES[TROOP_ID_BY_KEY[k as TroopKey] ?? FORT_ID_BY_KEY[k as FortKey]] ?? k;
