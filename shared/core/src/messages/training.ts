// Training troops and fortifications, healing (see index.ts).
export const TRAINING_MESSAGES = {
  /** fortifications need the Walls (`building`) */
  wallsNeeded: ['building'],
  /** the chosen building is not a built Barracks (`building`) */
  invalidBarracks: ['building'],
  queueFull: [],
  /** every Barracks (`building`) queue is full */
  allQueuesFull: ['building'],
  wallSpaceFull: [],
  notEnoughPopulation: [],
  /** a multi-order takes 1 to `max` unit types */
  orderLimit: ['max'],
  duplicateOrder: [],
  fortsAtWalls: [],
  batchNotFound: [],
  invalidFort: [],
  /** fewer of `unit` (a troop or fortification) than asked for */
  notEnoughUnits: ['unit'],
  notEnoughInjured: [],
  notEnoughHonor: ['amount'],
  /** system mail from migration 0025: fortifications taken down in `city` when wall space per fortification grew */
  'mail.wallSpaceRefund.title': [],
  'mail.wallSpaceRefund.content': ['city', 'count'],
} as const;
