// Identifiers and enumerations of Evony Age 1, as used by the original client/server
// (see evony-private-server/src/defines.h). Values are part of the wire contract.

export const TileType = {
  FOREST: 1,
  DESERT: 2,
  HILL: 3,
  SWAMP: 4,
  GRASS: 5,
  LAKE: 6,
  FLAT: 10,
  CASTLE: 11,
  NPC: 12,
  /** (marchlands) a historic city, levels 12 to 18 (docs/features/historical-cities.md) */
  HISTORIC: 13,
} as const;
export type TileType = (typeof TileType)[keyof typeof TileType];

/** Valley tile types (can be occupied by a city for production bonuses). */
export const VALLEY_TYPES: readonly number[] = [TileType.FOREST, TileType.DESERT, TileType.HILL, TileType.SWAMP, TileType.GRASS, TileType.LAKE, TileType.FLAT];

export const BuildingType = {
  COTTAGE: 1,
  BARRACKS: 2,
  WAREHOUSE: 3,
  SAWMILL: 4,
  QUARRY: 5,
  IRONMINE: 6,
  FARM: 7,
  TRAP: 14,
  ABATIS: 15,
  ARCHER_TOWER: 16,
  ROLLING_LOG: 17,
  TREBUCHET: 18,
  STABLE: 20,
  INN: 21,
  FORGE: 22,
  MARKETPLACE: 23,
  RELIEF_STATION: 24,
  ACADEMY: 25,
  WORKSHOP: 26,
  FEASTING_HALL: 27,
  EMBASSY: 28,
  RALLY_SPOT: 29,
  BEACON_TOWER: 30,
  TOWN_HALL: 31,
  WALLS: 32,
} as const;
export type BuildingType = (typeof BuildingType)[keyof typeof BuildingType];

/** Troop type ids (config_troops.troopid). */
export const TroopType = {
  WORKER: 2,
  WARRIOR: 3,
  SCOUT: 4,
  PIKE: 5,
  SWORDS: 6,
  ARCHER: 7,
  TRANSPORTER: 8,
  CAVALRY: 9,
  CATAPHRACT: 10,
  BALLISTA: 11,
  RAM: 12,
  CATAPULT: 13,
} as const;
export type TroopType = (typeof TroopType)[keyof typeof TroopType];

/** Fortification type ids (share the troop id space, produced at the walls). */
export const FortType = {
  TRAP: 14,
  ABATIS: 15,
  ARCHER_TOWER: 16,
  ROLLING_LOG: 17,
  TREBUCHET: 18,
} as const;
export type FortType = (typeof FortType)[keyof typeof FortType];

/** Troop keys as used in client objects, indexed by troop id. */
export const TROOP_KEYS = {
  2: 'peasants',
  3: 'militia',
  4: 'scouter',
  5: 'pikemen',
  6: 'swordsmen',
  7: 'archer',
  8: 'carriage',
  9: 'lightCavalry',
  10: 'heavyCavalry',
  11: 'ballista',
  12: 'batteringRam',
  13: 'catapult',
} as const;
export type TroopKey = (typeof TROOP_KEYS)[keyof typeof TROOP_KEYS];
export const TROOP_KEY_LIST = Object.values(TROOP_KEYS) as TroopKey[];
export const TROOP_ID_BY_KEY = Object.fromEntries(Object.entries(TROOP_KEYS).map(([id, key]) => [key, Number(id)])) as Record<TroopKey, TroopType>;

export const FORT_KEYS = {
  14: 'trap',
  15: 'abatis',
  16: 'arrowTower',
  17: 'rollingLogs',
  18: 'rockfall',
} as const;
export type FortKey = (typeof FORT_KEYS)[keyof typeof FORT_KEYS];
export const FORT_KEY_LIST = Object.values(FORT_KEYS) as FortKey[];
export const FORT_ID_BY_KEY = Object.fromEntries(Object.entries(FORT_KEYS).map(([id, key]) => [key, Number(id)])) as Record<FortKey, FortType>;

export const TechType = {
  AGRICULTURE: 1,
  LUMBERING: 2,
  MASONRY: 3,
  MINING: 4,
  METAL_CASTING: 5,
  INFORMATICS: 7,
  MILITARY_SCIENCE: 8,
  MILITARY_TRADITION: 9,
  IRON_WORKING: 10,
  LOGISTICS: 11,
  COMPASS: 12,
  HORSEBACK_RIDING: 13,
  ARCHERY: 14,
  STOCKPILE: 15,
  MEDICINE: 16,
  CONSTRUCTION: 17,
  ENGINEERING: 18,
  MACHINERY: 19,
  PRIVATEERING: 20,
  /** (marchlands) hero gear level (gear.ts) */
  HERO_ENHANCEMENT: 21,
} as const;
export type TechType = (typeof TechType)[keyof typeof TechType];

/** Player state flags (playerInfo.status). */
export const PlayerStatus = {
  NORMAL: 0,
  PEACETIME: 1,
  TRUCE: 2,
  BEGINNER: 3,
  HOLIDAY: 5,
} as const;

export const Relation = {
  ALLIANCE: 0,
  ALLY: 1,
  NEUTRAL: 2,
  ENEMY: 3,
  NO_RELATION: 4,
  SELF: 5,
} as const;
export type Relation = (typeof Relation)[keyof typeof Relation];

export const AllianceRank = {
  HOST: 4,
  VICE_HOST: 5,
  PRESIDENT: 6,
  OFFICER: 7,
  MEMBER: 8,
} as const;
export type AllianceRank = (typeof AllianceRank)[keyof typeof AllianceRank];

export const HeroStatus = {
  IDLE: 0,
  MAYOR: 1,
  ATTACK: 3,
  SEIZED: 4,
  RETURN: 5,
} as const;
export type HeroStatus = (typeof HeroStatus)[keyof typeof HeroStatus];

/** A player's or hero's sex (playerInfo.sex, heroes.sex). */
export const Sex = {
  MALE: 0,
  FEMALE: 1,
} as const;
export type Sex = (typeof Sex)[keyof typeof Sex];

export const Mission = {
  TRANSPORT: 1,
  REINFORCE: 2,
  SCOUT: 3,
  BUILD_CITY: 4,
  ATTACK: 5,
} as const;
export type Mission = (typeof Mission)[keyof typeof Mission];

export const ArmyDirection = {
  FORWARD: 1,
  BACKWARD: 2,
  STAY: 3,
} as const;
export type ArmyDirection = (typeof ArmyDirection)[keyof typeof ArmyDirection];

export const MailType = {
  INBOX: 1,
  SYSTEM: 2,
  SENT: 3,
} as const;
export type MailType = (typeof MailType)[keyof typeof MailType];

/** Report tabs (reports.type_id). */
export const ReportType = {
  TRADE: 0,
  ARMY: 1,
  OTHER: 2,
} as const;
export type ReportType = (typeof ReportType)[keyof typeof ReportType];

export const MarketSide = {
  BUY: 0,
  SELL: 1,
} as const;
export type MarketSide = (typeof MarketSide)[keyof typeof MarketSide];

/** (marchlands) Lengths of the market's price candles, in real time (market_candles.period). */
export const CandlePeriod = {
  MINUTE: 'minute',
  HOUR: 'hour',
  DAY: 'day',
} as const;
export type CandlePeriod = (typeof CandlePeriod)[keyof typeof CandlePeriod];
export const CANDLE_PERIODS = Object.values(CandlePeriod) as [CandlePeriod, ...CandlePeriod[]];
export const CANDLE_PERIOD_MS: Record<CandlePeriod, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };

export const RESOURCE_KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

/**
 * The four basic resources (everything but gold), produced by fields and traded on the market. The order is the
 * original protocol's: the market numbers them by their index here (resType 0 food, 1 lumber, 2 stone, 3 iron).
 */
export const BASIC_RESOURCES = ['food', 'wood', 'stone', 'iron'] as const;
export type BasicResource = (typeof BASIC_RESOURCES)[number];

/** Timed effects on a player (players.buffs[].id). The values are the ids stored and sent to the client. */
export const BuffId = {
  FOOD_PRODUCTION: 'FoodProductionBuff',
  WOOD_PRODUCTION: 'WoodProductionBuff',
  STONE_PRODUCTION: 'StoneProductionBuff',
  IRON_PRODUCTION: 'IronProductionBuff',
  GOLD_PRODUCTION: 'GoldProductionBuff',
  ATTACK: 'AttackBuff',
  DEFENSE: 'DefenseBuff',
  WAR_ENSIGN: 'WarEnsignBuff',
  BUILDING_QUEUE: 'BuildingQueueBuff',
  UPKEEP_REDUCE: 'UpkeepReduceBuff',
  TRAIN_COST_REDUCE: 'TrainCostReduceBuff',
  /** Truce Agreement */
  TRUCE: 'PlayerPeaceBuff',
  TRUCE_COOLDOWN: 'PlayerPeaceCoolDownBuff',
  /** City Teleporter */
  TELEPORT_COOLDOWN: 'MoveCastleCoolDownBuff',
  /** holiday mode */
  HOLIDAY: 'FurloughBuff',
} as const;
export type BuffId = (typeof BuffId)[keyof typeof BuffId];
export const BUFF_IDS = Object.values(BuffId) as [BuffId, ...BuffId[]];

/** Timed effects on a hero (heroes.buffs[].id): attribute boosts, and where a captured hero goes home to. */
export const HeroBuffId = {
  POWER: 'power',
  MANAGEMENT: 'management',
  STRATAGEM: 'stratagem',
  /** param: the city a captured hero returns to when released */
  HOME_CITY: 'homeCity',
} as const;
export type HeroBuffId = (typeof HeroBuffId)[keyof typeof HeroBuffId];
export const HERO_BUFF_IDS = Object.values(HeroBuffId) as [HeroBuffId, ...HeroBuffId[]];

/** (marchlands) no demolishing status: demolition is instant (orig 2, a timed demolition) */
export const BuildingStatus = {
  IDLE: 0,
  BUILDING: 1,
} as const;
export type BuildingStatus = (typeof BuildingStatus)[keyof typeof BuildingStatus];

/** Targets one city may attack in a flow action (a level 10 Rally Spot sends 10 armies). */
export const FLOW_MAX_TARGETS_PER_CITY = 10;

/** Longest a flow's "wait" action can wait (real time). */
export const FLOW_MAX_WAIT_MINUTES = 7 * 24 * 60;

/** (marchlands) The NPC factions (factions.ts has what each holds and is like). Stored in faction_standing and sent to the client. */
export const FactionId = {
  SAXON_LEAGUE: 'saxon',
  LOTHARINGIAN_CROWN: 'lotharingian',
  FRANCONIAN_HEARTLAND: 'franconian',
  BOHEMIAN_CROWN: 'bohemian',
  ITALIAN_LEAGUE: 'italian',
} as const;
export type FactionId = (typeof FactionId)[keyof typeof FactionId];
export const FACTION_IDS = Object.values(FactionId) as [FactionId, ...FactionId[]];
