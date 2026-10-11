// Alliances: membership, ranks, diplomacy, events (see index.ts).
export const ALLIANCE_MESSAGES = {
  /** what a name is for, as the `what` of common.nameLength / common.nameInvalid */
  name: [],
  notFound: [],
  /** an alliance looked up by the name someone typed */
  namedNotFound: ['name'],
  nameTaken: ['name'],
  notMember: [],
  alreadyMember: [],
  /** the player's alliance rank does not allow this */
  rankTooLow: [],
  full: [],
  /** `count` hours (game time) before a player may rejoin the alliance they left */
  rejoinCooldown: ['count'],
  hostMustTransfer: [],
  playerInOtherAlliance: ['name'],
  inviteNotFound: [],
  applicationNotFound: [],
  notApplied: [],
  /** `building`: the Embassy, as a reference */
  buildingRequired: ['building'],
  invalidRank: [],
  memberNotFound: [],
  ownRank: [],
  /** at most `count` members of `rank` (a rank reference) */
  rankLimit: ['count', 'rank'],
  hostToViceHostOnly: [],
  kickSelf: [],
  kickHigherRank: [],
  invalidRelation: [],
  invalidTarget: [],
  /** `relation`: a nested relation.* */
  alreadyRelation: ['relation'],
  warCooldown: [],
  /** system pushes */
  invited: ['name'],
  warDeclared: ['name', 'target'],
  /** alliance event log and announcements */
  'event.created': ['name'],
  'event.joined': ['name'],
  'event.left': ['name'],
  'event.applied': ['name'],
  'event.promoted': ['actor', 'name', 'rank'],
  'event.demoted': ['actor', 'name', 'rank'],
  'event.newHost': ['name'],
  'event.removed': ['name', 'actor'],
  'event.relationSet': ['name', 'relation'],
  /** diplomatic relations, nested in other messages */
  'relation.ally': [],
  'relation.neutral': [],
  'relation.enemy': [],
} as const;
