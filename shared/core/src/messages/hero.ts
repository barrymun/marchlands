// Heroes: hiring, mayors, points, gear, items, boosts (see index.ts).
export const HERO_MESSAGES = {
  /** recruiting needs the Inn (`building`) */
  needInn: ['building'],
  /** the Feasting Hall (`building`) has no free slot */
  noVacancy: ['building'],
  notIdle: [],
  /** a locked hero cannot be dismissed */
  locked: ['name'],
  noMayor: [],
  invalidPoints: [],
  /** `level`: BALANCE.heroMaxLevel */
  maxLevel: ['level'],
  /** an experience item used on a hero at the maximum level */
  maxLevelNoExperience: ['level'],
  notEnoughExperience: [],
  invalidAttribute: [],
  invalidGearPiece: [],
  gearMaxStars: [],
  /** stars are capped by the Hero Enhancement research (`tech`) level `limit`; research `level` first */
  gearStarLimit: ['tech', 'limit', 'level'],
  /** a gear star's medals (`item`), `amount` needed */
  notEnoughMedals: ['item', 'amount'],
  fullyLoyal: [],
  itemNotForGold: [],
  /** an item that does nothing for a hero */
  invalidItem: [],
} as const;
