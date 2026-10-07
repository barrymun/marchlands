// Tunable game-balance constants. Values marked (orig) come straight from the original
// server; values marked (evony) fill gaps the original never implemented, chosen to match
// Evony Age 1 as closely as is known. Keep every magic number here.

import { HOUR, MINUTE } from './time.ts';

export const BALANCE = {
  // ---- world ----
  mapSize: 800, // (orig) 800x800 tiles, 16 states of 200x200
  stateGrid: 4,

  // ---- city economy ----
  baseStorage: 10_000, // (orig) per resource, before fields
  basePopulation: 50, // (orig) max population before cottages
  baseProductionPerHour: 100, // (orig) every resource, regardless of fields
  /** (orig) cottage max-population bonus by level 1..10 */
  cottagePopulation: [0, 100, 300, 600, 1000, 1500, 2100, 2800, 3600, 4500, 5500],
  /** (orig) field multiplier F by level 1..10: production 100F/h, storage 10000F, workers 10F */
  fieldFactor: [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55],
  fieldProductionPerF: 100,
  fieldStoragePerF: 10_000,
  fieldWorkersPerF: 10,
  /** (evony) production bonus per effective level of Agriculture/Lumbering/Masonry/Mining */
  resourceTechBonusPerLevel: 0.1,
  /** (evony) production bonus = mayor management / 100 */
  mayorManagementProductionFactor: 0.01,
  /**
   * (evony) production bonus of an occupied valley, indexed by level 1-10 (index 0 unused).
   * Evony: grassland +1%/level from 3%, lake +3%/level from 8%, every other valley +2%/level from 5%
   * (grass [0, .03 … .12], other [0, .05 … .23]). (evony-re) every valley now uses the lake's table.
   */
  /** (evony-re) gold to raise an unowned valley from level 1 to 2; doubles each level, up to `maxLevel` */
  valleyUpgrade: { baseGold: 10_000, maxLevel: 10 },
  valleyBonus: {
    grass: [0, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35],
    lake: [0, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35],
    other: [0, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35],
  },
  /** (evony-re) multiplies every city's food/lumber/stone/iron storage, after Stockpile (orig 1) */
  storageMultiplier: 100,
  /** (evony) Stockpile: +10% storage per level */
  stockpileStorageBonusPerLevel: 0.1,
  /** (evony) warehouse protects this much of each resource per level from plunder (x storePercent) */
  warehouseProtectPerLevel: [0, 10_000, 30_000, 60_000, 100_000, 150_000, 210_000, 280_000, 360_000, 450_000, 550_000],
  /** (evony) resinc buff: production +25% */
  resourceBuffBonus: 0.25,

  // population / loyalty drift (orig: every 6 minutes)
  cityTickMs: 6 * MINUTE,
  /** (evony-re) a city's loyalty drifts 1 point per cityTickMs of real time, unaffected by GAME_SPEED */
  cityLoyaltyRealTime: true as boolean,
  populationStep: 0.05,
  startLoyalty: 90,
  startTaxRate: 10,
  startPopulation: 50,

  /** (evony-re) heroes stop levelling here (orig: no limit); they keep growing through gear (gear.ts) */
  heroMaxLevel: 100,
  /**
   * (evony-re) hero gear (Age II Hero Enhancement): piece levels follow the Hero Enhancement research,
   * each level adds its number in points (55 per piece at 10); each star adds starPoints; star 10 of a
   * piece costs lastStarMedals Nation Medals (stars 1-9: one medal of that level)
   */
  heroGear: { maxLevel: 10, maxStars: 10, starPoints: 3, lastStarMedals: 3 },
  /**
   * (evony-re) soft caps for geared heroes (orig: linear). With a toggle on, a hero attribute counts
   * in full up to `knee` and as √(knee × attribute) above it (knee 200: 450 → 300, 800 → 400,
   * 1,250 → 500): `production` for the mayor's production bonus, `battle` for hero attack in battle.
   * Training speed is never capped.
   */
  heroSoftCap: { production: true as boolean, battle: true as boolean, knee: 200 },
  /**
   * (evony-re) the most a mayor's attribute can cut construction / research times to: at least this
   * share of the time is kept (null: no floor, orig). Training is never floored.
   */
  heroTimeFloor: { building: 0.1 as number | null, research: 0.1 as number | null },
  heroSalaryPerLevel: 20, // (orig) gold per hour per hero level
  /**
   * (evony-re) hero items bought with the hero's city gold instead of cents: experience books cost
   * `perExp` gold per experience point they give, attribute boosts a flat price
   */
  heroItemGold: { perExp: 1, attributeBoost: 100_000 },
  /** (evony-re) on: every hero costs heroSalaryPerLevel gold per hour per level (orig). Off: heroes are free */
  heroSalaries: false as boolean,
  /** (evony-re) on: salaries are paid per real hour, unaffected by GAME_SPEED. Off: per game hour (orig) */
  salaryPerRealHour: true as boolean,
  heroHireCostPerLevel: 1000, // (orig)
  /** (evony-re) gold to re-roll the Inn's offers, per Inn level (the Hero Hunting item does it for free) */
  tavernRefreshGoldPerInnLevel: 1000,
  heroAwardCostPerLevel: 100, // (orig)

  // comfort / levy (orig)
  comfortCooldownMs: 15 * MINUTE,
  levyCooldownMs: 15 * MINUTE,
  levyLoyaltyCost: 20,

  // ---- construction ----
  heroTimeFactor: 0.995, // (orig) per point of the relevant mayor attribute
  techTimeFactor: 0.9, // (orig) per research level
  demolishRefund: 1 / 3, // (orig)
  cancelBuildRefund: 1, // (orig intended)
  cancelResearchRefund: 1 / 3, // (orig)
  cancelTrainInProgressRefund: 1 / 3, // (orig)
  cancelTrainQueuedRefund: 1, // (orig)
  disbandRefund: 0, // (evony) disbanding returns nothing
  outerSlotsBase: 10, // (orig intended) field slots = 10 + 3*TownHall
  outerSlotsPerTownHall: 3,
  /** (evony-re) constructions a city may run at once (orig 1); Bernini's Hammer adds one more */
  buildQueues: 2,
  /** (evony-re) floor on a troop's training time per unit, in game seconds (orig 1); 0 lets a strong mayor train instantly */
  minTrainUnitSeconds: 0,
  /** (evony-re) off: level-10 buildings no longer need (and use up) a Michelangelo's Script (orig on) */
  buildingItemRequirements: false as boolean,
  /** (evony-re) technologies one city's Academy researches at once (orig 1) */
  researchQueues: 2,
  freeSpeedupMs: 5 * MINUTE, // (orig) free speed-up threshold & amount

  // ---- fortifications ----
  /** (evony) wall capacity in fort "space" by wall level 1..10 */
  wallSpace: [0, 1_000, 3_000, 6_000, 10_000, 15_000, 21_000, 28_000, 36_000, 45_000, 55_000],
  /** (evony) wall space used per fort unit */
  fortSpace: { 14: 1, 15: 1, 16: 2, 17: 3, 18: 4 } as Record<number, number>,

  // ---- army ----
  /** (orig) slowest unit of each group decides speed; values are tiles per 1000 minutes */
  rallySpotArmiesPerLevel: 1,
  /** (evony) troops one army may hold: 10,000 per Rally Spot level (100,000 at level 10) */
  rallySpotTroopsPerLevel: 10_000,
  /** (evony) War Ensign raises that limit by 25% */
  warEnsignTroopBonus: 0.25,
  compassSpeedPerLevel: 0.1, // (orig) foot speed +10%/level
  horsebackSpeedPerLevel: 0.05, // (orig) mounted speed +5%/level
  logisticsLoadPerLevel: 0.1, // (evony) +10% load per level
  /** (evony) reinforcement / scout / transport to own or allied cities move this much faster */
  maxRestTimeMs: 24 * HOUR,
  /** (evony) loyalty damage per successful attack on a city (before capture) */
  cityLoyaltyDamagePerAttack: [10, 15],
  /** (evony) attacking army must kill all defenders and bring this loyalty to 0 to capture */
  npcLoyaltyStart: { low: 80, high: 90 },
  /** (orig) NPC/valley regeneration interval */
  npcRegenMs: 6 * MINUTE,
  /** (evony-re) barbarian city loyalty recovers +1 per npcRegenMs of real time, not game time */
  npcLoyaltyRegenRealTime: true as boolean,
  /**
   * (evony-re) barbarian cities hold as much gold as their largest resource (level 10: 19M, like
   * their food) and regenerate it like the other resources (orig: the table's gold, never regenerated)
   */
  npcGoldMatchesTopResource: true as boolean,
  /** (evony) share of plunderable stock taken per successful attack, capped by load */
  plunderShare: 1,
  /** (evony) attacker troops lost in a win that become injured (Relief/Medicine aware) */
  injuredShare: 0.2,
  /**
   * (evony-re) on: troops eat their upkeep per real hour, unaffected by GAME_SPEED (production still
   * speeds up). Off: per game hour, like every other rate (orig)
   */
  upkeepPerRealHour: true as boolean,
  /** (evony-re) on: troops desert 10% per game hour while food is at 0 (Evony). Off: food stops at 0 and troops stay */
  starvationDesertion: false as boolean,
  /** (orig) healing an injured troop costs this share of its training cost */
  healCostShare: 0.25,
  /** (evony) Medicine: +5% of lost defenders recover as injured per level */
  medicinePerLevel: 0.05,
  /** (evony-re) the Medicine share also applies to an attacking army's fallen: they come home injured */
  attackersGetInjured: true as boolean,
  /** (evony-re) healing an injured unit with honor costs its food upkeep x this (the honor killing one earns) */
  healHonorPerUpkeep: 1,
  /** (evony) hero exp per point of experience weight (orig TROOP_EXPS, troops.ts unitExp) of enemy units killed */
  heroExpPerKill: 0.1,
  /** (evony) mayor exp per point of experience weight of troops and fortifications trained in the city */
  heroExpPerTrain: 0.02,
  /** (evony) mayor exp per unit of resources (gold included) a completed research level cost */
  heroExpPerResearch: 0.1,
  /** (evony) mayor exp per unit of resources (gold included) a completed building level cost */
  heroExpPerBuild: 0.1,

  // ---- player ----
  beginnerProtectionMs: 7 * 24 * HOUR, // (orig)
  beginnerTownHallLevel: 5, // (orig)
  startingCents: 0,
  startingResources: 100_000, // (orig) every resource
  truceDurationMs: 12 * HOUR, // (orig)
  truceCooldownMs: 12 * HOUR, // (orig)
  teleportCooldownMs: 12 * HOUR, // (orig)

  // ---- chat ----
  worldChatSpeakerCost: 1, // (evony) Speakers per world-chat line

  // ---- alliance ----
  allianceCreateGold: 10_000, // (orig)
  allianceMaxMembers: 500, // (orig)
  allianceWarCooldownMs: 24 * HOUR, // (orig)

  // ---- market ----
  marketFee: 0.005, // (evony) 0.5% of gold paid
  /** (evony-re) market trades are instant (orig Evony: goods travel 60 min / Marketplace level); > 0 restores travel */
  marketShipmentBaseMs: 0 * MINUTE,
  marketMaxOrdersPerLevel: 2,
  /**
   * (evony-re) computer merchant: always buys and sells every resource. Its reference price moves
   * with its trades (x e^(qty/depth)) and drifts back to `basePrice` with a half-life of
   * `recoveryHalfLifeMs` (game time). It sells at reference x (1 + spread/2), buys at x (1 - spread/2).
   * When `fixedPrice` is set, all of that is switched off: the merchant buys and sells every
   * resource at exactly that price, in any amount (a floor for sellers, a ceiling for buyers).
   */
  merchant: {
    fixedPrice: 1 as number | null,
    basePrice: { food: 0.2, wood: 0.3, stone: 0.4, iron: 0.5 },
    spread: 0.1,
    depth: 1_000_000,
    recoveryHalfLifeMs: 6 * HOUR,
    /** the reference never leaves [base / band, base x band] */
    band: 5,
  },
  /**
   * (evony-re) medals (hero.loyalty.1 Cross … .9 Nation) a won attack on a city can drop, by city
   * level L (barbarian level / Town Hall level): one medal with chance base + perLevel x L, of level
   * L-3 … L-1 (1 … 9); from level 8 a second (and from 9 a third) low-mid medal of level 1 … ceil(L/2)
   */
  medalDrops: { base: 0.1, perLevel: 0.07, secondFrom: 8, secondPerLevel: 0.25, thirdFrom: 9, thirdPerLevel: 0.2 },
  /** (evony-re) items that can be bought with city gold, and their price (item id -> gold each) */
  goldShop: { 'player.troop.1.a': 250_000 } as Record<string, number>,
  /** (orig) units of resource per cent in shop.buyResource */
  shopResourcePerCent: { food: 100_000, wood: 100_000, stone: 50_000, iron: 40_000 },
} as const;

/** Global multiplier for every timer (GAME_SPEED env). Set once at boot. */
let gameSpeed = 1;
export function setGameSpeed(speed: number): void {
  if (!(speed > 0)) throw new Error(`invalid game speed ${speed}`);
  gameSpeed = speed;
}
export function getGameSpeed(): number {
  return gameSpeed;
}
/** Scale a duration (ms) by the configured game speed. */
export function scaled(ms: number): number {
  return Math.max(0, Math.floor(ms / gameSpeed));
}
