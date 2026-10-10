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

export const BUILDING_NAMES: Record<number, string> = {
  1: 'Cottage',
  2: 'Barracks',
  3: 'Warehouse',
  4: 'Sawmill',
  5: 'Quarry',
  6: 'Ironmine',
  7: 'Farm',
  20: 'Stable',
  21: 'Inn',
  22: 'Forge',
  23: 'Marketplace',
  24: 'Relief Station',
  25: 'Academy',
  26: 'Workshop',
  27: 'Feasting Hall',
  28: 'Embassy',
  29: 'Rally Spot',
  30: 'Beacon Tower',
  31: 'Town Hall',
  32: 'Walls',
};

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

/** Display names by troop / fortification id. */
export const TROOP_NAMES: Record<number, string> = {
  2: 'Worker',
  3: 'Warrior',
  4: 'Scout',
  5: 'Pikeman',
  6: 'Swordsman',
  7: 'Archer',
  8: 'Transporter',
  9: 'Cavalry',
  10: 'Cataphract',
  11: 'Ballista',
  12: 'Battering Ram',
  13: 'Catapult',
  14: 'Trap',
  15: 'Abatis',
  16: "Archer's Tower",
  17: 'Rolling Log',
  18: 'Trebuchet',
};

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

export const TECH_NAMES: Record<number, string> = {
  1: 'Agriculture',
  2: 'Lumbering',
  3: 'Masonry',
  4: 'Mining',
  5: 'Metal Casting',
  7: 'Informatics',
  8: 'Military Science',
  9: 'Military Tradition',
  10: 'Iron Working',
  11: 'Logistics',
  12: 'Compass',
  13: 'Horseback Riding',
  14: 'Archery',
  15: 'Stockpile',
  16: 'Medicine',
  17: 'Construction',
  18: 'Engineering',
  19: 'Machinery',
  20: 'Privateering',
  21: 'Hero Enhancement',
};

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

export const STATE_NAMES = [
  'FRIESLAND',
  'SAXONY',
  'NORTH MARCH',
  'BOHEMIA',
  'LOWER LORRAINE',
  'FRANCONIA',
  'THURINGIA',
  'MORAVIA',
  'UPPER LORRAINE',
  'SWABIA',
  'BAVARIA',
  'CARINTHIA',
  'BURGUNDY',
  'LOMBARDY',
  'TUSCANY',
  'ROMAGNA',
] as const;

export const RESOURCE_KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;
export type ResourceKey = (typeof RESOURCE_KEYS)[number];

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
