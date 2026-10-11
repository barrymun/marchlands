// Messages any part of the server can send (see index.ts). Each entry: the message's name within its area
// and the names of its params; the wording is in the client's locale files (msg-common.json).
export const COMMON_MESSAGES = {
  /** text stored before messages had codes (converted by migration 0021), shown as it was */
  legacyText: ['text'],
  /** an API request that doesn't match its schema */
  invalidRequest: [],
  serverError: [],
  /** any other failed request (e.g. a body too large), by HTTP status */
  requestFailed: ['status'],
  routeNotFound: ['method', 'url'],
  notAllowed: [],
  adminsOnly: [],
  invalidData: [],
  invalidAmount: [],
  invalidCastle: [],
  invalidCoordinates: [],
  invalidTroopType: [],
  invalidTroopCount: [],
  unknownTroopType: ['key'],
  noTroopsSelected: [],
  notEnoughResources: [],
  notEnoughGold: [],
  /** with the amount needed */
  notEnoughGoldFor: ['amount'],
  insufficientItems: [],
  playerNotFound: [],
  /** a player looked up by the name someone typed */
  playerNamedNotFound: ['name'],
  cityNotFound: [],
  heroNotFound: [],
  /** what a name is for, as the `what` of the name messages below */
  playerName: [],
  cityName: [],
  heroName: [],
  name: [],
  nameLength: ['what', 'min', 'max'],
  nameInvalid: ['what'],
  nameNotAllowed: [],
  /** a free speed-up asked for before the job's last stretch (`time`: how long that stretch is) */
  freeSpeedupTooEarly: ['time'],
  invalidSpeedup: [],
} as const;
