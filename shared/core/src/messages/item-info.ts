// Item descriptions and how-to text (core item-info.ts) (see index.ts).
export const ITEM_INFO_MESSAGES = {
  // ---- a length of time inside a description ("1 day", "12 hours") ----
  'period.days': ['count'],
  'period.hours': ['count'],
  'period.minutes': ['count'],

  // ---- speed-ups (BALANCE.items.speedups) ----
  /** a fixed cut, `time`: a period */
  'speedup.time': ['time'],
  /** a random cut between `min` and `count` hours */
  'speedup.hours': ['min', 'count'],
  /** a share of the total time */
  'speedup.percent': ['percent'],
  /** a share of one troop-training batch (training.ts BATCH_SPEEDUP) */
  'speedup.troopBatch': ['percent'],
  /** a share of one fortification batch (training.ts BATCH_SPEEDUP) */
  'speedup.fortBatch': ['percent'],

  // ---- hero items ----
  /** loyalty medal: `amount` loyalty, up to `max` */
  loyalty: ['amount', 'max'],
  /** attribute item (BALANCE.items.heroAttributeBuff): `stat`, `percent`, `period` */
  heroStat: ['stat', 'percent', 'period'],
  /** experience book: `percent` of the next level, at least `min` (BALANCE.items.experienceBooks) */
  'experience.share': ['percent', 'min'],
  /** experience book worth a full level, at least `min` */
  'experience.level': ['min'],
  /** Holy Water */
  holyWater: [],

  // ---- used from the inventory ----
  /** timed buff: `effect` (the buff's own description, msg-buff), `period` */
  buff: ['effect', 'period'],
  /** a grant to the player: `contents` (a list of contents.*) */
  grant: ['contents'],
  /** a grant (resources or troops) to the current city */
  grantCity: ['contents'],
  /** one line of contents: `amount` × `item` */
  'contents.item': ['amount', 'item'],
  /** one line of contents: `amount` of `name` (a resource or a troop) */
  'contents.amount': ['amount', 'name'],
  /** locked chest: `key` (item), `contents` */
  chest: ['key', 'contents'],
  /** chest key: `chest` (item) */
  key: ['chest'],
  /** medal box: `min`–`max` of each of `medals` (items) (BALANCE.items.medalBoxes) */
  medalBox: ['min', 'max', 'medals'],
  randomBox: [],
  /** Civil Code (BALANCE.items.civilCode): `percent` of the maximum population, at least `min` */
  civilCode: ['percent', 'min'],
  cureInjured: [],
  /** hero box (BALANCE.items.heroBoxes): `level`, `minStat`, `building`: the Feasting Hall */
  heroBox: ['level', 'minStat', 'building'],
  /** City Teleporter, `period`: BALANCE.teleportCooldownMs */
  teleporter: ['period'],
  /** Truce Agreement, `period`: BALANCE.truceDurationMs */
  truce: ['period'],
  notUsable: [],
  noEffect: [],

  // ---- how to use an item consumed by another action ----
  'howTo.speedup': [],
  'howTo.troopsSpeedup': [],
  'howTo.fortificationsSpeedup': [],
  'howTo.cityMove': [],
  'howTo.heroesReset': [],
  'howTo.heroesUseItem': [],
  'howTo.cityTruce': [],
  /** a chest key, `chest` (item) */
  'howTo.key': ['chest'],
  /** the Welcome Package */
  'howTo.welcome': [],
} as const;
