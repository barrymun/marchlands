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
   * cost starMedals medals of that level, star 10 lastStarMedals Crown Medals
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
  /** (marchlands) the most times a flow's "hire heroes" action re-rolls one city's Inn a run, whatever its gold cap */
  flowHireMaxRerolls: 200,
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
   * as the player's refund credit covers (disbandRefund in construction.ts). (orig) one unit's full cost however many
   * went, a bug; (evony) disbanding is thought to have returned nothing
   */
  disbandRefund: 0.9,
  outerSlotsBase: 10, // (orig intended) field slots = 10 + 3*TownHall
  outerSlotsPerTownHall: 3,
  /** (marchlands) constructions a city may run at once (orig 1); Bernward's Hammer adds one more */
  buildQueues: 2,
  /** (marchlands) floor on a troop's training time per unit, in game seconds (orig 1); 0 lets a strong mayor train instantly */
  minTrainUnitSeconds: 0,
  /** (marchlands) technologies one city's Academy researches at once (orig 1) */
  researchQueues: 2,
  freeSpeedupMs: 5 * MINUTE, // (orig) free speed-up threshold & amount

  // ---- fortifications ----
  /** (evony) wall capacity in fort "space" by wall level 1..10 */
  wallSpace: [0, 1_000, 3_000, 6_000, 10_000, 15_000, 21_000, 28_000, 36_000, 45_000, 55_000],
  /**
   * (evony) wall space used per fort unit: trap 1, abatis 2, archer tower 3, rolling log 4, trebuchet 5 (Evony wiki,
   * Walls). Every NPC city's garrison (world.ts NPC_TABLE) fits its wall with these.
   */
  fortSpace: { 14: 1, 15: 2, 16: 3, 17: 4, 18: 5 } as Record<number, number>,

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
  /** (evony) Imperial Banner raises that limit by 25% */
  imperialBannerTroopBonus: 0.25,
  compassSpeedPerLevel: 0.1, // (orig) foot speed +10%/level
  horsebackSpeedPerLevel: 0.05, // (orig) mounted speed +5%/level
  logisticsLoadPerLevel: 0.1, // (evony) +10% load per level
  /** (evony) the longest an army may camp at its target before it comes home (real time) */
  maxRestTimeMs: 24 * HOUR,
  /**
   * (marchlands) historic cities, levels 12 to 18 (docs/features/historical-cities.md; garrisons from Age 2,
   * docs/reference/historic-cities.md, and tuned in docs/battle-sims/historic-cities.md)
   */
  historic: {
    /** troops by level: warriors, the day's foot troop (swordsmen or pikemen), archers, the day's horse, the day's siege engine */
    troops: {
      12: [1_120_000, 162_666, 42_807, 108_444, 14_640],
      14: [2_800_000, 406_666, 171_228, 271_111, 36_600],
      16: [7_000_000, 1_016_665, 428_070, 677_777, 91_500],
      18: [14_000_000, 2_033_330, 856_140, 1_355_555, 183_000],
    } as Record<12 | 14 | 16 | 18, readonly [number, number, number, number, number]>,
    /** the same fortifications at every level */
    forts: { trap: 22_000, abatis: 11_000, arrowTower: 6_666, rollingLogs: 6_000, rockfall: 5_000 },
    /** the defending hero's Attack and Intelligence by level (AeroCalc's) */
    hero: { 12: [110, 500], 14: [150, 800], 16: [200, 1_100], 18: [300, 1_650] } as Record<12 | 14 | 16 | 18, readonly [number, number]>,
    /** every research at this level but Archery, which stays at 0 so its catapults don't outrange every attacker */
    researchLevel: 10,
    /** loyalty at the start, and what each won attack takes off it */
    loyalty: 100,
    loyaltyPerWin: 3,
    /** troops and fortifications back each npcRegenMs, a little every second */
    refillShare: 0.1,
    /** a held one's Rally Spot sends this much more an army for each level step above 10 (12: +25% … 18: +100%) */
    rallyBonusPerStep: 0.25,
    /** a captured one is under truce this long (real time); its holder's own truce never covers it */
    truceMs: 24 * HOUR,
    /** each field level past 10 a held one builds costs and takes this many times the one before (levels 1 to 10 double) */
    fieldLevelStep: 2,
    /** the most a player may hold, by level */
    holdLimit: { 12: 3, 14: 2, 16: 1, 18: 1 } as Record<12 | 14 | 16 | 18, number>,
    /** a draft takes this share of every troop type of the city it drafts from */
    draftShare: 0.2,
    /** drafts a seat may make each UTC day; drafting by itself, one each equal part of the day */
    draftsPerDay: 4,
    /** gold a held seat pays its holder each real hour, into the seat city */
    tribute: { 12: 2_000, 14: 6_000, 16: 20_000, 18: 60_000 } as Record<12 | 14 | 16 | 18, number>,
    /** shares of the market fee (BALANCE.marketFee) paid to the holder of the buyer's state's capital, and of Atlantis */
    feeShare: { capital: 0.2, atlantis: 0.1 },
    /**
     * a state's ruler (its capital's holder): the state's barbarian cities are cut off from their faction and pay the
     * capital this much gold a real hour per member level instead (a member of level 7 pays 35; Tuscany's about 42,000)
     */
    stateTribute: { perMemberLevel: 5 },
    /** the share of a seat's tribute (and a capital's state tribute) its holder's alliance gets, paid to the other members every real hour */
    allianceShare: 0.25,
  },
  /** (marchlands) how far ahead an army can be set to land at a chosen time (camp times; real time) */
  landAtMaxAheadMs: 24 * HOUR,
  /**
   * (marchlands) wave plans (camp times, docs/features/camp-times.md): the most plans a player keeps (their own and
   * shared), waves a plan holds (each lands a millisecond after the one before, so fewer than 1,000), and how long a plan
   * stays after its landing second
   */
  warPlans: { maxPlans: 10, maxWaves: 100, keepMs: DAY },
  /** (evony) loyalty damage per successful attack on a barbarian city (before capture); lords' cities have no loyalty */
  npcLoyaltyDamagePerAttack: [10, 15],
  /** (evony) attacking army must kill all defenders and bring this loyalty to 0 to capture */
  npcLoyaltyStart: { low: 80, high: 90 },
  /**
   * (orig) NPC/valley regeneration interval: an NPC city's resources (+1/80) and loyalty (+1) come back each interval;
   * (marchlands) its troops and fortifications come back 10% of full each interval but a little every second, and a
   * valley's garrison is whole again one interval after it was hit, also a little every second (deviations.md)
   */
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
  /**
   * (marchlands) abandoning a city: the notice it takes, cancellable until then, and how long after capturing it abandoning takes the capture's prestige back (real time); and how long after keeping a city they moved out of a player can't move any city out, so starting,
   * moving and calling it off isn't a free teleport.
   */
  abandon: { delayMs: HOUR, prestigeBackMs: 7 * 24 * HOUR, moveOutCooldownMs: 24 * HOUR },
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
   * (marchlands) placing and cancelling market orders, per player and real time (not GAME_SPEED): up to
   * `burst` at once, then one more every `refillMs` (10 a minute). Quotes are free.
   */
  marketOrderLimit: { burst: 10, refillMs: 6_000 },
  /**
   * (marchlands) price candles (market_candles), by length in real time. Minute and hour candles are
   * deleted once older than `keepMs`; day candles are kept.
   */
  marketCandles: { keepMs: { minute: 7 * DAY, hour: 90 * DAY } },
  /**
   * (marchlands) trades with a player in them (market_trades) are kept this long (real time), then pruned by the
   * cleanup job: players see their last 50 and a market its last 30, and the candles keep the price history
   */
  marketTrades: { keepMs: 180 * DAY },
  /**
   * (marchlands) NPC factions (factions.ts): NPC cities from `minLevel` up belong to the faction holding their
   * zone; lower ones are unaligned bandits (no faction, no trade, no standing lost by attacking them)
   */
  factions: { minLevel: 5 },
  /**
   * (marchlands) NPC trade (npc-economy.ts): faction members trade in groups of one zone and level. A group's target
   * is its members' full-strength stock, its treasury their gold in the NPC table (npcTableGold); `turnover`,
   * `strength` and `restoreHalfLifeMs` apply to its gold as to its stock. Game time unless marked real.
   */
  npcTrade: {
    /** a tick, real time: one auction per resource */
    tickMs: MINUTE,
    /** real time: the most one tick catches up after the worker was stopped */
    maxCatchUpMs: HOUR,
    /** share of its target a group makes, and uses, per game hour */
    turnover: 0.02,
    /** a faction makes this much more of what it is strong in, and uses this much more of what it is short of */
    strength: 0.5,
    /** how much a zone's land (its valleys against the world average) shapes what it makes: 1 fully, 0 not at all */
    landWeight: 1,
    /** the world's stock this far below its target puts the price at the merchant's ask */
    edgeShare: 0.25,
    /** share of the gap between what a group holds and what it wants at the world price, traded each tick */
    adjust: 0.5,
    /** half of a group's distance from its target closes in this long, as its making adjusts */
    restoreHalfLifeMs: DAY,
    /** each faction's making wanders around normal at random: its spread, and half of a swing fades in `halfLifeMs` */
    wander: { sd: 0.25, halfLifeMs: DAY },
    /** factions sell to players this share above the world price and buy this share below (half each way) */
    playerSpread: 0.02,
    /** made-up trades kept for the Market page's ticker, and how many each tick adds per resource */
    ticker: { keep: 50, perResource: 2 },
  },
  /**
   * (marchlands) standing with each NPC faction (reputation.ts), from -max to max, starting at 0. A city trades with the
   * factions through the faction holding its zone, at a spread set by the player's standing with it. Game time.
   */
  reputation: {
    max: 100,
    /** half of a standing fades back to 0 in this long */
    driftHalfLifeMs: 3 * DAY,
    /** at or below this the home faction won't trade with the city */
    refuseBelow: -50,
    /** the factions' spread for players (npcTrade.playerSpread at 0) at standing `max` and at `refuseBelow`; never below 0, or a round trip would pay */
    spread: { best: 0, worst: 0.1 },
    /** lost for any attack on a faction member, per member level */
    attackPerLevel: 0.3,
    /** lost for capturing a member, on top of the attack */
    capture: 20,
    /** gained for a won attack on a bandit camp (below factions.minLevel), per level, with the faction whose land it's on */
    banditPerLevel: 0.1,
    /** gained for trading with the factions: one point per `goldPerPoint` traded, at most `maxPerDay` a game day */
    trade: { goldPerPoint: 20_000_000, maxPerDay: 5 },
    /**
     * historic cities (docs/features/historical-cities.md): an attack on one costs attackPerLevel x its level with the
     * faction whose state it stands in, capturing it `capture` x its level's factor more, and the factions bordering that
     * one gain `rivalShare` of the capture's cost; each draft costs `draft` with the drafted city's faction
     */
    seat: { captureFactor: { 12: 1, 14: 1, 16: 2, 18: 2 } as Record<12 | 14 | 16 | 18, number>, rivalShare: 0.5, draft: 1 },
    /** where the bands players see begin: hostile is at refuseBelow or lower */
    tiers: { unfriendly: -10, friendly: 10, honoured: 50 },
  },
  /**
   * (marchlands) computer merchant: always buys and sells every resource, in any amount. It sells at
   * its reference price x (1 + spread/2) and buys at x (1 - spread/2), so players' orders inside the
   * spread beat it: a market of last resort.
   * With `fixedPrice` set the reference is that price for every resource and never moves. Otherwise
   * it moves with the merchant's trades (x e^(qty/depth)) and drifts back to `basePrice` with a
   * half-life of `recoveryHalfLifeMs` (game time).
   */
  merchant: {
    fixedPrice: 1 as number | null,
    basePrice: { food: 0.2, wood: 0.3, stone: 0.4, iron: 0.5 },
    /** buys at 0.85 and sells at 1.15 around a reference of 1.00 */
    spread: 0.3,
    depth: 1_000_000,
    recoveryHalfLifeMs: 6 * HOUR,
    /** the reference never leaves [base / band, base x band] */
    band: 5,
  },
  /**
   * (marchlands) medals (hero.loyalty.1 Cross … .9 Crown) a won attack on a city can drop, by city
   * level L (barbarian level / Town Hall level): one medal with chance base + perLevel x L, of level
   * L-3 … L-1 (1 … 9); from level 8 a second (and from 9 a third) low-mid medal of level 1 … ceil(L/2)
   */
  medalDrops: { base: 0.1, perLevel: 0.07, secondFrom: 8, secondPerLevel: 0.25, thirdFrom: 9, thirdPerLevel: 0.2 },
  /** (marchlands) share of troop training cost saved while a Marshal's Seal or Charter runs (fortifications pay in full) */
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
      [ItemId.NOVICES_NOTES]: { cents: 5, cutMs: 15 * MINUTE },
      [ItemId.APPRENTICES_NOTES]: { cents: 10, cutMs: HOUR },
      [ItemId.JOURNEYMANS_NOTES]: { cents: 20, cutMs: 2.5 * HOUR },
      [ItemId.MASTERS_NOTES]: { cents: 50, cutMs: 8 * HOUR },
      [ItemId.GRANDMASTERS_NOTES]: { cents: 80, cutHours: [10, 30] },
      [ItemId.VILLARDS_SKETCHBOOK]: { cents: 120, cutShare: 0.3 },
      [SpeedupId.HALF_TIME]: { cents: 175, cutShare: 0.5 },
    } as Record<string, { cents: number; cutMs?: number; cutHours?: readonly [number, number]; cutShare?: number }>,
    /** (evony) Otto's Muster Roll / Henry's Castle Law: the share of a troop or fortification batch's total time they cut */
    batchSpeedupShare: 0.3,
    /** (evony) Magdeburg Rights: adds this share of the city's maximum population, at least `min` people (capped at the maximum) */
    civilCode: { share: 0.2, min: 100 },
    /** (evony) medal boxes: the medal levels each holds, `medalBoxCount.min`-`max` of each */
    medalBoxes: {
      [ItemId.BRONZE_COFFER]: [1, 2, 3],
      [ItemId.SILVER_COFFER]: [4, 5, 6],
      [ItemId.GOLD_COFFER]: [7, 8, 9],
    } as Record<string, readonly number[]>,
    medalBoxCount: { min: 2, max: 4 },
    /** (evony) the Founder's Gift every new player gets */
    foundersGift: {
      items: { [ItemId.NOVICES_NOTES]: 5, [ItemId.APPRENTICES_NOTES]: 3 } as Record<string, number>,
      resources: { food: 50_000, wood: 50_000, stone: 50_000, iron: 50_000 },
    },
    /** (evony) hero attribute items (Joyeuse etc.): +bonus of the attribute for durationMs */
    heroAttributeBuff: { bonus: 0.25, durationMs: DAY },
    /** (evony) hero boxes: the level of the hero inside and its lowest base attribute (`fallback`: a box not listed) */
    heroBoxes: { [ItemId.OATH_OF_FEALTY]: { level: 30, minStat: 55 } } as Record<string, { level: number; minStat: number }>,
    heroBoxFallback: { level: 10, minStat: 40 },
    /** (marchlands) a hero box hero's base attributes are each at least minStat + 0 … this */
    heroBoxStatSpread: 10,
    /** (orig) experience books: `share` of the experience the hero's next level needs, at least `min` */
    experienceBooks: {
      [ItemId.DEEDS_OF_THE_SAXONS]: { share: 0.08, min: 1_000 },
      [ItemId.EPITOME_OF_MILITARY_SCIENCE]: { share: 0.3, min: 10_000 },
      [ItemId.NIBELUNGENLIED]: { share: 1, min: 100_000 },
    } as Record<string, { share: number; min: number }>,
    /** (orig) loyalty each medal (hero.loyalty.1 Cross … .9 Crown) gives a hero */
    medalLoyalty: {
      [ItemId.CROSS_MEDAL]: 5,
      [ItemId.ROSE_MEDAL]: 10,
      [ItemId.LION_MEDAL]: 15,
      [ItemId.HONOUR_MEDAL]: 20,
      [ItemId.COURAGE_MEDAL]: 25,
      [ItemId.WISDOM_MEDAL]: 30,
      [ItemId.FIDELITY_MEDAL]: 40,
      [ItemId.JUSTICE_MEDAL]: 50,
      [ItemId.CROWN_MEDAL]: 60,
    } as Record<string, number>,
  },
  /** (marchlands) items that can be bought with city gold, and their price (item id -> gold each) */
  // set prices; every other item the original sold for cents costs goldForCents(its price) (itemGoldPrice)
  goldShop: {
    [ItemId.IMPERIAL_BANNER]: 250_000, // Imperial Banner (30 cents)
    [ItemId.LOCATORS_CHARTER]: 750_000, // Locator's Charter: picks the tile, like the original's Adv City Teleporter (90 cents)
    // a third building queue for 7 days (5 cents, 40,000 gold: far below the other 7-day boosts, docs/features/item-names.md)
    [ItemId.BERNWARDS_HAMMER]: 1_000_000,
    // production boosts, +25% for 1 day (8 cents) / 7 days (50 cents)
    [ItemId.PLOUGHSHARE]: 65_000,
    [ItemId.HEAVY_PLOUGH]: 415_000,
    [ItemId.BOW_SAW]: 65_000,
    [ItemId.WATER_SAW]: 415_000,
    [ItemId.MASONS_PICK]: 65_000,
    [ItemId.TREADWHEEL_CRANE]: 415_000,
    [ItemId.HAND_BELLOWS]: 65_000,
    [ItemId.WATER_BELLOWS]: 415_000,
    // gold income +25% for 1 day (45 cents) / 7 days (280 cents)
    [ItemId.TOLL_RIGHT]: 375_000,
    [ItemId.MINT_RIGHT]: 2_335_000,
    // troop upkeep -50% for 1 day (Elizabeth's Bread) / 7 days (Elizabeth's Granary)
    [ItemId.ELIZABETHS_BREAD]: 150_000,
    [ItemId.ELIZABETHS_GRANARY]: 950_000,
    // troop training cost -trainCostReduction for 1 day (Marshal's Seal) / 7 days (Marshal's Charter)
    [ItemId.MARSHALS_SEAL]: 250_000,
    [ItemId.MARSHALS_CHARTER]: 1_600_000,
  } as Record<string, number>,
  /**
   * (marchlands) items the original sold that the shop doesn't (itemGoldPrice: null), decided 2026-11-08
   * (docs/features/item-names.md, Items that don't earn their place). The speed-up books cost what finishing the
   * same time for gold does, and the experience books more than buying them at the moment of use: both can still
   * be bought then, and given. The medal boxes held what battle already gives in thousands.
   */
  notInShop: [
    ItemId.NOVICES_NOTES,
    ItemId.APPRENTICES_NOTES,
    ItemId.JOURNEYMANS_NOTES,
    ItemId.MASTERS_NOTES,
    ItemId.DEEDS_OF_THE_SAXONS,
    ItemId.EPITOME_OF_MILITARY_SCIENCE,
    ItemId.NIBELUNGENLIED,
    ItemId.BRONZE_COFFER,
    ItemId.SILVER_COFFER,
    ItemId.GOLD_COFFER,
  ] as readonly string[],
  /**
   * (marchlands) there are no cents: everything the original sold for cents costs city gold at this rate
   * (the Imperial Banner's: 30 cents = 250,000 gold), rounded to 5,000 (goldForCents)
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
