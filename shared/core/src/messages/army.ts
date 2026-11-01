// Sending and recalling armies, and why a march turned back (see index.ts).
export const ARMY_MESSAGES = {
  invalidMission: [],
  insufficientTroops: [],
  /** more resources than the troops can carry */
  overloaded: [],
  rallySpotRequired: ['building'],
  /** every army slot of the Rally Spot is in use */
  armyLimit: ['building', 'count'],
  troopLimit: ['building', 'level', 'count'],
  invalidTarget: [],
  transportTarget: [],
  noResources: [],
  reinforceTarget: [],
  alliedTroopsRefused: [],
  scoutsRequired: ['troop'],
  /** the sender is under beginner's protection: it ends after `count` days or at a Town Hall level */
  beginnerProtection: ['count', 'building', 'level'],
  truce: [],
  nothingToAttack: [],
  buildOnFlat: [],
  cityLimit: [],
  newCityResources: ['amount', 'resources'],
  heroRequiredAttack: [],
  heroRequiredSettlers: [],
  notFound: [],
  alreadyReturning: [],
  /** a landing time sooner than the march allows (`time`: the march) or further ahead than allowed (`time`: the limit) */
  landTooSoon: ['time'],
  landTooLate: ['time'],
  // why a march turned back (shown in a "Mission aborted" report)
  unknownMission: [],
  destinationNotFriendly: [],
  valleyNoLongerHeld: [],
  landNotFree: [],
  cityGone: [],
  cityNowFriendly: [],
  valleyAlreadyHeld: [],
  valleyNowFriendly: [],
  // why a won valley was not occupied
  homeCityGone: [],
  valleyLimit: ['building'],
  // valleys
  valleyNotHeld: [],
  upgradeTarget: [],
  upgradeHeld: [],
  valleyMaxLevel: ['level'],
  barbarianCityMaxLevel: ['level'],
} as const;
