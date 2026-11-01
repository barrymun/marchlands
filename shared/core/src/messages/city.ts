// City settings: name, tax, work rates, comforting, teleport (see index.ts).
export const CITY_MESSAGES = {
  taxRateRange: [],
  workRateRange: [],
  invalidStorePercent: [],
  storePercentTotal: [],
  /** time left before the city can be comforted again */
  comfortCooldown: ['time'],
  notEnoughFood: [],
  invalidComfortType: [],
  invalidLogo: [],
  /** item: the City Teleporter */
  teleportCooldown: ['item'],
  /** a captured historic city stays where it stands */
  historicCannotMove: [],
  recallTroopsFirst: [],
  foreignTroops: [],
  notFreeFlat: [],
} as const;
