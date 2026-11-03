// Sending and recalling armies, and why a march turned back (see index.ts).
export const ARMY_MESSAGES = {
  /** wave plans (camp times): no such plan, or not one the player can see */
  planNotFound: [],
  /** the player already keeps BALANCE.warPlans.maxPlans plans */
  planLimit: ['count'],
  /** a plan holds BALANCE.warPlans.maxWaves waves at most */
  planWaveLimit: ['count'],
  /** only the plan's maker may do that (delete it, reorder its waves) */
  planNotOwner: [],
  /** a plan shared with an alliance needs one */
  planNoAlliance: [],
  /** a plan's waves attack or scout */
  planMission: [],
  /** the wave was sent already */
  planWaveSent: [],
  /** a plan's landing second is past, or too far ahead */
  planLandAt: ['time'],
  /** a plan with a wave sent keeps its target and landing second */
  planMoveSent: [],
  /** a shared plan with other players' waves stays shared */
  planKeepShared: [],
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
  /** a historic city just captured is under truce for `time` more */
  historicTruce: ['time'],
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
  /** a held historic city holds one valley per its level (maxValleysFor) */
  seatValleyLimit: ['level'],
  // valleys
  valleyNotHeld: [],
  upgradeTarget: [],
  upgradeHeld: [],
  valleyMaxLevel: ['level'],
  barbarianCityMaxLevel: ['level'],
} as const;
