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
  /** a player's city, abandoned once its hour was up */
  'title.cityAbandoned': [],
  /** abandoning a city was called off when its hour was up: it was the last regular city left */
  'title.abandonCancelled': [],
  /** a player's historic city rose up (no longer happens: kept for the reports from before 2026-11-05) */
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
  /** body of a "City abandoned" report */
  cityAbandoned: ['name'],
  /** the same, abandoned soon after capturing it: the prestige taken back (abandonPrestigeBack) */
  cityAbandonedPrestige: ['name', 'prestige'],
  /** body of an "Abandoning cancelled" report */
  abandonCancelled: ['name'],
  /** body of a "Historic city rebelled" report, as above: the city's name and level */
  seatRebelled: ['name', 'level'],
  /** body of a "New city founded" report */
  cityFounded: ['name'],
} as const;
