// Tunable game-balance constants. Values marked (orig) come straight from the original
// server; values marked (evony) fill gaps the original never implemented, chosen to match
// Evony Age 1 as closely as is known. Keep every magic number here.

import { ItemId, SpeedupId } from '#/item-ids.ts';
import { DAY, HOUR, MINUTE } from '#/time.ts';

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
   * (grass [0, .03 … .12], other [0, .05 … .23]). (marchlands) every valley now uses the lake's table.
   */
  /** (marchlands) gold to raise an unowned valley from level 1 to 2; doubles each level, up to `maxLevel` */
  valleyUpgrade: { baseGold: 10_000, maxLevel: 10 },
  valleyBonus: {
    grass: [0, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35],
    lake: [0, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35],
    other: [0, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23, 0.26, 0.29, 0.32, 0.35],
  },
  /** (marchlands) multiplies every city's food/lumber/stone/iron storage, after Stockpile (orig 1) */
  storageMultiplier: 100,
  /** (evony) Stockpile: +10% storage per level */
  stockpileStorageBonusPerLevel: 0.1,
  /** (evony) warehouse protects this much of each resource per level from plunder (x storePercent) */
  warehouseProtectPerLevel: [0, 10_000, 30_000, 60_000, 100_000, 150_000, 210_000, 280_000, 360_000, 450_000, 550_000],
  /** (evony) resinc buff: production +25% */
  resourceBuffBonus: 0.25,

  // population drift (orig: every 6 minutes); (marchlands) lords' cities have no loyalty
  cityTickMs: 6 * MINUTE,
  populationStep: 0.05,
  /**
   * (marchlands) the tax rate (0-100%) sells that share of a city's field output to the merchant as it is
   * produced; the people always pay this base tax (population x share gold per hour; orig: population x rate)
   */
  baseTaxShare: 0.1,
  startTaxRate: 0,
  startPopulation: 50,

  /** (marchlands) heroes stop levelling here (orig: no limit); they keep growing through gear (gear.ts) */
  heroMaxLevel: 100,
  /** (evony) the highest loyalty a hero can have; new heroes start at it */
  heroMaxLoyalty: 100,
  /**
   * (marchlands) hero gear (Age II Hero Enhancement, gear.ts): piece levels follow the Hero Enhancement research,
   * each level adding levelPoints to a piece (10 at level 10); star N of a piece adds N points (55 for all 10).
   * The set bonus adds setBonus for every star level all 14 pieces have reached (140 at 10 stars each). Stars 1-9
   * cost starMedals medals of that level, star 10 lastStarMedals Nation Medals
   */
  heroGear: { maxLevel: 10, maxStars: 10, levelPoints: 1, setBonus: 14, starMedals: 2, lastStarMedals: 6 },
  /**
   * (marchlands) soft caps for geared heroes (orig: linear). With a toggle on, a hero attribute counts
   * in full up to `knee` and as √(knee × attribute) above it (knee 200: 450 → 300, 800 → 400,
   * 1,250 → 500): `production` for the mayor's production bonus, `battle` for hero attack in battle.
   * Training speed is never capped.
   */
  heroSoftCap: { production: true as boolean, battle: true as boolean, knee: 200 },
  /**
   * (marchlands) the most a mayor's attribute can cut construction / research times to: at least this
   * share of the time is kept (null: no floor, orig). Training is never floored.
   */
  heroTimeFloor: { building: 0.1 as number | null, research: 0.1 as number | null },
  heroSalaryPerLevel: 20, // (orig) gold per hour per hero level
  /**
   * (marchlands) hero items bought with the hero's city gold instead of cents: experience books cost
   * `perExp` gold per experience point they give, attribute boosts a flat price
   */
  heroItemGold: { perExp: 1, attributeBoost: 100_000 },
  /** (marchlands) on: every hero costs heroSalaryPerLevel gold per hour per level (orig). Off: heroes are free */
  heroSalaries: true as boolean,
  /** (marchlands) on: salaries are paid per real hour, unaffected by GAME_SPEED. Off: per game hour (orig) */
  salaryPerRealHour: true as boolean,
  heroHireCostPerLevel: 1000, // (orig)
  /** (marchlands) gold to re-roll the Inn's offers, per Inn level (the Hero Hunting item does it for free) */
  tavernRefreshGoldPerInnLevel: 1000,
  /** (orig) the Inn offers one hero per level, up to `maxOffers`, each of level 1 to `heroLevelsPerInnLevel` x Inn level */
  inn: { maxOffers: 10, heroLevelsPerInnLevel: 5 },
  heroAwardCostPerLevel: 100, // (orig)

  // comfort (orig); (marchlands) the levy is removed
  comfortCooldownMs: 15 * MINUTE,

  // ---- construction ----
  heroTimeFactor: 0.995, // (orig) per point of the relevant mayor attribute
  techTimeFactor: 0.9, // (orig) per research level
  /**
   * (orig) share of a level's cost demolishing it returns. (marchlands) demolishing is instant and removes the
   * whole building, returning this share of every level's cost (orig: one level per timed demolition)
   */
  demolishRefund: 1 / 3,
  cancelBuildRefund: 1, // (orig intended)
  cancelResearchRefund: 1 / 3, // (orig)
  cancelTrainInProgressRefund: 1 / 3, // (orig)
  cancelTrainQueuedRefund: 1, // (orig)
  /**
   * (marchlands) share of the training cost disbanding troops or destroying fortifications returns, for as many units
   * as the player's refund credit covers (disbandRefund in construction.ts). (evony) disbanding returned nothing
   */
  disbandRefund: 0.9,
  outerSlotsBase: 10, // (orig intended) field slots = 10 + 3*TownHall
  outerSlotsPerTownHall: 3,
  /** (marchlands) constructions a city may run at once (orig 1); Bernini's Hammer adds one more */
  buildQueues: 2,
  /** (marchlands) floor on a troop's training time per unit, in game seconds (orig 1); 0 lets a strong mayor train instantly */
  minTrainUnitSeconds: 0,
  /** (marchlands) technologies one city's Academy researches at once (orig 1) */
  researchQueues: 2,
  freeSpeedupMs: 5 * MINUTE, // (orig) free speed-up threshold & amount

  // ---- fortifications ----
  /** (evony) wall capacity in fort "space" by wall level 1..10 */
  wallSpace: [0, 1_000, 3_000, 6_000, 10_000, 15_000, 21_000, 28_000, 36_000, 45_000, 55_000],
  /** (evony) wall space used per fort unit */
  fortSpace: { 14: 1, 15: 1, 16: 2, 17: 3, 18: 4 } as Record<number, number>,

  // ---- battle ----
  /**
   * (orig) battle simulator rules (battle/simulator.ts, battle/resolve.ts). The simulator is a bit-exact
   * port of the original, so changing any of these breaks parity with the original's regression data.
   */
  battle: {
    /** damage multipliers: pikemen vs cavalry and cataphracts, swordsmen vs pikemen, cavalry and cataphracts vs archers */
    damage: { pikemanVsMounted: 1.8, swordsmanVsPikeman: 1.1, mountedVsArcher: 1.2 },
    /** share of the damage aimed at an archer tower that it takes */
    towerDamageTaken: 0.3,
    /** wall hit points: this x level x (level + 1) */
    wallHitPointsFactor: 50_000,
    /** archer tower range +this % per wall level */
    wallTowerRangePct: 4.5,
    /**
     * research bonuses in %, per level: Military Tradition attack, Iron Working defence, Medicine life,
     * Archery range, Compass foot speed and Horseback Riding mounted and siege speed
     */
    researchPct: { attack: 5, defence: 5, life: 5, range: 5, footSpeed: 10, mountedSpeed: 5 },
    /** kill power of traps, rolling logs and trebuchets (the defender's fortifications) */
    fortKillPower: { trap: 1.25, rollingLog: 1.25, trebuchet: 1.25 },
  },

  // ---- army ----
  /** (evony) a settler army must carry at least this much of each basic resource (food, lumber, stone, iron) to found a city */
  newCityMinResource: 10_000,
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
  /** (evony) loyalty damage per successful attack on a barbarian city (before capture); lords' cities have no loyalty */
  npcLoyaltyDamagePerAttack: [10, 15],
  /** (evony) attacking army must kill all defenders and bring this loyalty to 0 to capture */
  npcLoyaltyStart: { low: 80, high: 90 },
  /** (orig) NPC/valley regeneration interval */
  npcRegenMs: 6 * MINUTE,
  /** (marchlands) barbarian city loyalty recovers +1 per npcRegenMs of real time, not game time */
  npcLoyaltyRegenRealTime: true as boolean,
  /**
   * (marchlands) barbarian cities hold as much gold as their largest resource (level 10: 19M, like
   * their food) and regenerate it like the other resources (orig: the table's gold, never regenerated)
   */
  npcGoldMatchesTopResource: true as boolean,
  /** (evony) share of plunderable stock taken per successful attack, capped by load */
  plunderShare: 1,
  /** (evony) attacker troops lost in a win that become injured (Relief/Medicine aware) */
  injuredShare: 0.2,
  /**
   * (marchlands) on: troops eat their upkeep per real hour, unaffected by GAME_SPEED (production still
   * speeds up). Off: per game hour, like every other rate (orig)
   */
  upkeepPerRealHour: true as boolean,
  /** (marchlands) on: troops desert 10% per game hour while food is at 0 (Evony). Off: food stops at 0 and troops stay */
  starvationDesertion: false as boolean,
  /** (orig) healing an injured troop costs this share of its training cost */
  healCostShare: 0.25,
  /** (evony) Medicine: +5% of lost defenders recover as injured per level */
  medicinePerLevel: 0.05,
  /** (evony) the most of the fallen troops Medicine can save */
  medicineMaxShare: 0.5,
  /** (marchlands) the Medicine share also applies to an attacking army's fallen: they come home injured */
  attackersGetInjured: true as boolean,
  /** (marchlands) healing an injured unit with honor costs its food upkeep x this (the honor killing one earns) */
  healHonorPerUpkeep: 1,
  /** (evony) hero exp per point of experience weight (orig TROOP_EXPS, troops.ts unitExp) of enemy units killed */
  heroExpPerKill: 0.01,
  /** (evony) mayor exp per point of experience weight of troops and fortifications trained in the city */
  heroExpPerTrain: 0.02,
  /** (evony) mayor exp per unit of resources (gold included) a completed research level cost */
  heroExpPerResearch: 0.1,
  /** (evony) mayor exp per unit of resources (gold included) a completed building level cost */
  heroExpPerBuild: 0.1,

  // ---- player ----
  // (marchlands) beginner protection, truces and the teleport cooldown last real time, unaffected by GAME_SPEED
  beginnerProtectionMs: 7 * 24 * HOUR, // (orig)
  beginnerTownHallLevel: 5, // (orig)
  startingResources: 100_000, // (orig) every resource
  truceDurationMs: 12 * HOUR, // (orig)
  /** (orig) holiday mode costs 10 cents a day, charged in city gold (goldForCents) */
  furloughCentsPerDay: 10,
  truceCooldownMs: 12 * HOUR, // (orig)
  teleportCooldownMs: 12 * HOUR, // (orig)
  /** (marchlands) renaming the lord is free, once per this much real time (orig: a New ID item each time) */
  renameCooldownMs: 24 * HOUR,
  /** (marchlands) changing gender in Player settings: free, once per this much real time */
  genderCooldownMs: 24 * HOUR,

  // ---- chat ----

  // ---- alliance ----
  allianceCreateGold: 10_000, // (orig)
  allianceMaxMembers: 500, // (orig)
  allianceWarCooldownMs: 24 * HOUR, // (orig)
  /** (orig) game hours before a player may rejoin the alliance they left */
  allianceRejoinCooldownHours: 23,

  // ---- market ----
  marketFee: 0.005, // (evony) 0.5% of gold paid
  /** (marchlands) the daily gift: resources into a city of the lord's choice, once a day (orig: an Amulet) */
  dailyGift: { gold: 50_000, food: 100_000, wood: 100_000, stone: 100_000, iron: 100_000 },
  /** (marchlands) market trades are instant (orig Evony: goods travel 60 min / Marketplace level); > 0 restores travel */
  marketShipmentBaseMs: 0 * MINUTE,
  marketMaxOrdersPerLevel: 2,
  /**
   * (marchlands) computer merchant: always buys and sells every resource. Its reference price moves
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
   * (marchlands) medals (hero.loyalty.1 Cross … .9 Nation) a won attack on a city can drop, by city
   * level L (barbarian level / Town Hall level): one medal with chance base + perLevel x L, of level
   * L-3 … L-1 (1 … 9); from level 8 a second (and from 9 a third) low-mid medal of level 1 … ceil(L/2)
   */
  medalDrops: { base: 0.1, perLevel: 0.07, secondFrom: 8, secondPerLevel: 0.25, thirdFrom: 9, thirdPerLevel: 0.2 },
  /** (marchlands) share of troop training cost saved while a Quartermaster item's buff runs (fortifications pay in full) */
  trainCostReduction: 0.25,
  /** (evony) attack / defence items: the army's attack or defence +20% in battle */
  battleBuffBonus: 0.2,
  /** (evony) upkeep item: troop food upkeep -50% */
  upkeepBuffReduction: 0.5,
  /** item effects (items.ts, construction.ts, heroes.ts) */
  items: {
    /** (evony) how long the 1-day and 7-day buff items last */
    buffDurationMs: { short: DAY, long: 7 * DAY },
    /**
     * (orig) construction and research speed-ups: their price in cents, and what they cut from the time
     * left: a fixed time (`cutMs`), a random whole number of hours from `cutHours[0]` to `cutHours[1]`,
     * or a share of the total time (`cutShare`)
     */
    speedups: {
      [ItemId.BEGINNER_GUIDELINES]: { cents: 5, cutMs: 15 * MINUTE },
      [ItemId.PRIMARY_GUIDELINES]: { cents: 10, cutMs: HOUR },
      [ItemId.INTERMEDIATE_GUIDELINES]: { cents: 20, cutMs: 2.5 * HOUR },
      [ItemId.SENIOR_GUIDELINES]: { cents: 50, cutMs: 8 * HOUR },
      [ItemId.MASTER_GUIDELINES]: { cents: 80, cutHours: [10, 30] },
      [ItemId.ULTIMATE_GUIDELINES]: { cents: 120, cutShare: 0.3 },
      [SpeedupId.HALF_TIME]: { cents: 175, cutShare: 0.5 },
    } as Record<string, { cents: number; cutMs?: number; cutHours?: readonly [number, number]; cutShare?: number }>,
    /** (evony) Napoleon's Diary / Archimedes' Note: the share of a troop or fortification batch's total time they cut */
    batchSpeedupShare: 0.3,
    /** (evony) Civil Code: adds this share of the city's maximum population, at least `min` people (capped at the maximum) */
    civilCode: { share: 0.2, min: 100 },
    /** (evony) medal boxes: the medal levels each holds, `medalBoxCount.min`-`max` of each */
    medalBoxes: {
      [ItemId.JUNIOR_MEDAL_BOX]: [1, 2, 3],
      [ItemId.MEDIUM_MEDAL_BOX]: [4, 5, 6],
      [ItemId.SENIOR_MEDAL_BOX]: [7, 8, 9],
    } as Record<string, readonly number[]>,
    medalBoxCount: { min: 2, max: 4 },
    /** (evony) the Welcome Package every new player gets */
    welcomePackage: {
      items: { [ItemId.BEGINNER_GUIDELINES]: 5, [ItemId.PRIMARY_GUIDELINES]: 3 } as Record<string, number>,
      resources: { food: 50_000, wood: 50_000, stone: 50_000, iron: 50_000 },
    },
    /** (evony) hero attribute items (Excalibur etc.): +bonus of the attribute for durationMs */
    heroAttributeBuff: { bonus: 0.25, durationMs: DAY },
    /** (evony) hero boxes: the level of the hero inside and its lowest base attribute (`fallback`: a box not listed) */
    heroBoxes: { [ItemId.HERO_PACKAGE]: { level: 30, minStat: 55 } } as Record<string, { level: number; minStat: number }>,
    heroBoxFallback: { level: 10, minStat: 40 },
    /** (marchlands) a hero box hero's base attributes are each at least minStat + 0 … this */
    heroBoxStatSpread: 10,
    /** (orig) experience books: `share` of the experience the hero's next level needs, at least `min` */
    experienceBooks: {
      [ItemId.ANABASIS]: { share: 0.08, min: 1_000 },
      [ItemId.EPITOME_OF_MILITARY_SCIENCE]: { share: 0.3, min: 10_000 },
      [ItemId.ON_WAR]: { share: 1, min: 100_000 },
    } as Record<string, { share: number; min: number }>,
    /** (orig) loyalty each medal (hero.loyalty.1 Cross … .9 Nation) gives a hero */
    medalLoyalty: {
      [ItemId.CROSS_MEDAL]: 5,
      [ItemId.ROSE_MEDAL]: 10,
      [ItemId.LION_MEDAL]: 15,
      [ItemId.HONOUR_MEDAL]: 20,
      [ItemId.COURAGE_MEDAL]: 25,
      [ItemId.WISDOM_MEDAL]: 30,
      [ItemId.FREEDOM_MEDAL]: 40,
      [ItemId.JUSTICE_MEDAL]: 50,
      [ItemId.NATION_MEDAL]: 60,
    } as Record<string, number>,
  },
  /** (marchlands) items that can be bought with city gold, and their price (item id -> gold each) */
  // set prices; every other item the original sold for cents costs goldForCents(its price) (itemGoldPrice)
  goldShop: {
    [ItemId.WAR_ENSIGN]: 250_000, // War Ensign (30 cents)
    [ItemId.CITY_TELEPORTER]: 750_000, // City Teleporter: picks the tile, like the original's Adv City Teleporter (90 cents)
    // production boosts, +25% for 1 day (8 cents) / 7 days (50 cents)
    [ItemId.PLOWSHARES]: 65_000,
    [ItemId.IRON_RAKE]: 415_000,
    [ItemId.ARCH_SAW]: 65_000,
    [ItemId.DOUBLE_SAW]: 415_000,
    [ItemId.QUARRYING_TOOLS]: 65_000,
    [ItemId.ADV_QUARRYING_TOOLS]: 415_000,
    [ItemId.BLOWER]: 65_000,
    [ItemId.BLAST_FURNACE]: 415_000,
    // gold income +25% for 1 day (45 cents) / 7 days (280 cents)
    [ItemId.TAX_POLICY]: 375_000,
    [ItemId.ADV_TAX_POLICY]: 2_335_000,
    // troop upkeep -50% for 1 day (Vesta's Blessing) / 7 days (Vesta's Grand Blessing)
    [ItemId.VESTAS_BLESSING]: 150_000,
    [ItemId.VESTAS_GRAND_BLESSING]: 950_000,
    // troop training cost -trainCostReduction for 1 day (Quartermaster's Seal) / 7 days (Quartermaster's Charter)
    [ItemId.QUARTERMASTERS_SEAL]: 250_000,
    [ItemId.QUARTERMASTERS_CHARTER]: 1_600_000,
  } as Record<string, number>,
  /**
   * (marchlands) there are no cents: everything the original sold for cents costs city gold at this rate
   * (the War Ensign's: 30 cents = 250,000 gold), rounded to 5,000 (goldForCents)
   */
  goldPerCent: 250_000 / 30,
} as const;

/** (marchlands) Gold for something the original priced in cents (BALANCE.goldPerCent), rounded to 5,000 (at least 5,000). */
export function goldForCents(cents: number): number {
  if (cents <= 0) return 0;
  return Math.max(5_000, Math.round((cents * BALANCE.goldPerCent) / 5_000) * 5_000);
}

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
