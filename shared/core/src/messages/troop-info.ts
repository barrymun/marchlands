// Troop and fortification descriptions (core troop-info.ts) (see index.ts).
export const TROOP_INFO_MESSAGES = {
  /** `count`: resources each carries (troop load) */
  worker: ['count'],
  warrior: [],
  scout: [],
  /** `multiplier`: damage dealt to the two horse units */
  pikeman: ['multiplier', 'cavalry', 'cataphract'],
  /** `multiplier`: damage dealt to `target` (Pikeman) */
  swordsman: ['multiplier', 'target'],
  /** `targets`: the ranged units shot first */
  archer: ['targets'],
  /** `count`: resources each carries (troop load) */
  transporter: ['count'],
  /** `multiplier`: damage dealt to `target` (Archer); hurt by enemy `abatis` */
  cavalry: ['multiplier', 'target', 'abatis'],
  cataphract: ['multiplier', 'target', 'abatis'],
  ballista: [],
  batteringRam: [],
  catapult: [],
  /** `space`: wall space per unit (BALANCE.fortSpace) */
  trap: ['space'],
  abatis: ['cavalry', 'cataphract', 'space'],
  /** range grows with the `walls` level; takes `percent` of damage; upgraded by `techs` */
  archerTower: ['walls', 'percent', 'techs', 'space'],
  rollingLog: ['space'],
  trebuchet: ['space'],
} as const;
