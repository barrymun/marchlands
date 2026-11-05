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
  /** name: a held historic city's own name, which it keeps (docs/features/historical-cities.md, Names) */
  historicKeepsName: ['name'],
  // the daily draft of a held historic city
  notHistoric: [],
  noDraftsLeft: ['count'],
  draftOutOfArea: [],
  /** Draft now: no city it may draft from (and hasn't today) is left in the seat's area */
  noDraftTarget: [],
  /** a seat drafts only from barbarian cities and lower historic cities nobody holds (canDraftFrom) */
  draftNotTarget: [],
  /** a seat drafts from each city at most once a day */
  draftedToday: [],
  nothingToDraft: [],
  /** abandoning: a player always keeps a regular city, as a historic one can be taken from them */
  abandonKeepRegular: [],
  abandonAlready: [],
  abandonNotRunning: [],
  recallTroopsFirst: [],
  foreignTroops: [],
  notFreeFlat: [],
} as const;
