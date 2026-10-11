import { FORT_ID_BY_KEY, TROOP_ID_BY_KEY, type FortKey, type TroopKey } from '@marchlands/core';
import { RESOURCES, resourceLabel, type Resource } from '@/lib/format';
import { troopName } from '@/lib/game-data';

/** A troop or fortification key's name in the current locale; an unknown key as is. */
export const troopLabel = (k: string) => {
  if (Object.hasOwn(TROOP_ID_BY_KEY, k)) return troopName(TROOP_ID_BY_KEY[k as TroopKey]);
  return Object.hasOwn(FORT_ID_BY_KEY, k) ? troopName(FORT_ID_BY_KEY[k as FortKey]) : k;
};

/** A resource key's label ("Lumber"); an unknown key as is. */
export const resourceKeyLabel = (k: string) => ((RESOURCES as readonly string[]).includes(k) ? resourceLabel(k as Resource) : k);
