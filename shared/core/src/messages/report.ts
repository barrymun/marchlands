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
  'title.reinforcementsFought': [],
  'title.valleyOccupied': [],
  'title.valleyLost': [],
  'title.valleyDefended': [],
  'title.tradeCompleted': [],
  'title.troopsDeserted': [],
  notFound: [],
  /** a stored report that no longer matches the report format */
  oldFormat: [],
  /** body of a "New city founded" report */
  cityFounded: ['name'],
} as const;
