// Building, upgrading and demolishing (incl. requirements in core construction.ts) (see index.ts).
export const BUILDING_MESSAGES = {
  /** a building type or level with no data */
  invalidBuilding: [],
  notFound: [],
  invalidPosition: [],
  /** a building type that can't be built at all */
  cannotBuild: [],
  cannotBuildHere: ['building'],
  positionTaken: [],
  /** the city already has as many of this building as it may */
  limitReached: ['building'],
  /** an outer field slot the Town Hall hasn't unlocked yet */
  slotLocked: [],
  queuesBusy: [],
  requirementsNotMet: [],
  /** an upgrade asked for while the building is already busy (often a stale client) */
  statusChanged: [],
  maxLevel: ['building'],
  busy: [],
  nothingToDemolish: [],
  cannotDemolish: ['building'],
  /** cancel / speed up asked for where nothing is being built or demolished */
  notInProgress: [],
  /** count: minutes the free speed-up covers */
  /** research and training rules that live in construction.ts */
  invalidTech: [],
  academyNeeded: ['building'],
  techRequirementsNotMet: [],
  troopRequirementsNotMet: [],
} as const;
