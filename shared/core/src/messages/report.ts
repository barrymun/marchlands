// Battle, scout, trade and other report titles and texts (see index.ts).
export const REPORT_MESSAGES = {
  'title.missionAborted': [],
  'title.scoutReturned': [],
  'title.attackReturned': [],
  'title.returned': [],
  'title.transportReport': [],
  'title.transportReceived': [],
  'title.reinforcementArrived': [],
  'title.reinforcementsFrom': ['name'],
  'title.newCityFounded': [],
  'title.scoutReport': [],
  'title.enemyScouts': [],
  'title.scoutsRepelled': [],
  'title.attackSucceeded': [],
  'title.attackFailed': [],
  'title.cityAttacked': [],
  'title.attackRepelled': [],
  /** a player's historic city taken by the attacker who brought its loyalty to 0 */
  'title.seatLost': [],
  /** a player's historic city rose up (its loyalty at 0 from unrest) and stands again as one nobody holds */
  'title.seatRebelled': [],
  /** a held historic city drafted troops from a barbarian city */
  'title.draft': [],
  'title.reinforcementsFought': [],
  'title.valleyOccupied': [],
  'title.valleyLost': [],
  'title.valleyDefended': [],
  'title.tradeCompleted': [],
  'title.troopsDeserted': [],
  notFound: [],
  /** a stored report that no longer matches the report format */
  oldFormat: [],
  /** body of a "Historic city rebelled" report: the city's name and level */
  seatRebelled: ['name', 'level'],
  /** body of a "New city founded" report */
  cityFounded: ['name'],
} as const;
