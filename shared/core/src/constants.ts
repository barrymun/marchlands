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

/** Valley tile types, flat land included (raised for gold, drawn as valleys). The ones a city can hold are HOLDABLE_VALLEY_TYPES. */
export const VALLEY_TYPES: readonly number[] = [TileType.FOREST, TileType.DESERT, TileType.HILL, TileType.SWAMP, TileType.GRASS, TileType.LAKE, TileType.FLAT];

/** The valleys a city can hold for their production bonus: every valley type but flat land, which is settled, not held. */
export const HOLDABLE_VALLEY_TYPES: readonly number[] = VALLEY_TYPES.filter((t) => t !== TileType.FLAT);

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
  /** (marchlands) no prisoners: heroes are never captured (orig 4, seized) */
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

/** (marchlands) What a report is about, to filter the list by: battles, scouting, armies coming home, other army movements, the rest. */
export const ReportKind = {
  BATTLES: 'battles',
  SCOUTING: 'scouting',
  RETURNS: 'returns',
  MOVEMENTS: 'movements',
  OTHER: 'other',
} as const;
export type ReportKind = (typeof ReportKind)[keyof typeof ReportKind];
export const REPORT_KINDS = Object.values(ReportKind) as [ReportKind, ...ReportKind[]];

/** (marchlands) Which reports the list shows first. */
export const ReportOrder = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
} as const;
export type ReportOrder = (typeof ReportOrder)[keyof typeof ReportOrder];
export const REPORT_ORDERS = Object.values(ReportOrder) as [ReportOrder, ...ReportOrder[]];

/** What a report's body holds (stored in reports.body.kind, which the list filters by). */
export const ReportBodyKind = {
  BATTLE: 'battle',
  SCOUT: 'scout',
  MOVEMENT: 'movement',
  TRADE: 'trade',
  TEXT: 'text',
  DESERTION: 'desertion',
  DRAFT: 'draft',
} as const;
export type ReportBodyKind = (typeof ReportBodyKind)[keyof typeof ReportBodyKind];

/** What a battle or scouting was against (in reports, and in the names of the battle statistics). */
export const BattleTarget = { CITY: 'city', NPC: 'npc', VALLEY: 'valley' } as const;
export type BattleTarget = (typeof BattleTarget)[keyof typeof BattleTarget];

/** How a battle ended (in reports). */
export const BattleResult = { ATTACKER_WON: 'attackerWon', DEFENDER_WON: 'defenderWon', DRAW: 'draw' } as const;
export type BattleResult = (typeof BattleResult)[keyof typeof BattleResult];
export const BATTLE_RESULTS = Object.values(BattleResult) as [BattleResult, ...BattleResult[]];

/** Marking reports read: every report of the player, in place of a list of ids. */
export const ALL_REPORTS = 'all';

/** The longest report search the server takes (coordinates, or part of a name). */
export const REPORT_SEARCH_MAX = 60;

export const MarketSide = {
  BUY: 0,
  SELL: 1,
} as const;
export type MarketSide = (typeof MarketSide)[keyof typeof MarketSide];

/** (marchlands) A trade's side in words (in trade reports; the factions' and merchant's prices): `MarketSide` is the same choice as the original protocol's number. */
export const TradeSide = { BUY: 'buy', SELL: 'sell' } as const;
export type TradeSide = (typeof TradeSide)[keyof typeof TradeSide];
export const TRADE_SIDES = Object.values(TradeSide) as [TradeSide, ...TradeSide[]];

/** What a market order does with what it can't fill now: rests on the book, or fills now at any price and nothing rests. */
export const MarketOrderType = { LIMIT: 'limit', MARKET: 'market' } as const;
export type MarketOrderType = (typeof MarketOrderType)[keyof typeof MarketOrderType];
export const MARKET_ORDER_TYPES = Object.values(MarketOrderType) as [MarketOrderType, ...MarketOrderType[]];

/** Who is on the other side of a market fill. */
export const TradeCounterparty = { PLAYER: 'player', FACTIONS: 'factions', MERCHANT: 'merchant' } as const;
export type TradeCounterparty = (typeof TradeCounterparty)[keyof typeof TradeCounterparty];
export const TRADE_COUNTERPARTIES = Object.values(TradeCounterparty) as [TradeCounterparty, ...TradeCounterparty[]];

/** (marchlands) Lengths of the market's price candles, in real time (market_candles.period). */
export const CandlePeriod = {
  MINUTE: 'minute',
  HOUR: 'hour',
  DAY: 'day',
} as const;
export type CandlePeriod = (typeof CandlePeriod)[keyof typeof CandlePeriod];
export const CANDLE_PERIODS = Object.values(CandlePeriod) as [CandlePeriod, ...CandlePeriod[]];
export const CANDLE_PERIOD_MS: Record<CandlePeriod, number> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };

export const ResourceKey = { GOLD: 'gold', FOOD: 'food', WOOD: 'wood', STONE: 'stone', IRON: 'iron' } as const;
export type ResourceKey = (typeof ResourceKey)[keyof typeof ResourceKey];
export const RESOURCE_KEYS = [ResourceKey.GOLD, ResourceKey.FOOD, ResourceKey.WOOD, ResourceKey.STONE, ResourceKey.IRON] as const;

/**
 * The four basic resources (everything but gold), produced by fields and traded on the market. The order is the
 * original protocol's: the market numbers them by their index here (resType 0 food, 1 lumber, 2 stone, 3 iron).
 */
export const BASIC_RESOURCES = [ResourceKey.FOOD, ResourceKey.WOOD, ResourceKey.STONE, ResourceKey.IRON] as const;
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

/** A hero's attributes: what gear boosts and flows choose by, and the timed boosts on a hero, named after them (heroes.buffs[].id). */
export const HeroBuffId = {
  POWER: 'power',
  MANAGEMENT: 'management',
  STRATAGEM: 'stratagem',
} as const;
export type HeroBuffId = (typeof HeroBuffId)[keyof typeof HeroBuffId];
export const HERO_BUFF_IDS = Object.values(HeroBuffId) as [HeroBuffId, ...HeroBuffId[]];

/** What using an item does (items.ts). */
export const ItemEffectKind = { BUFF: 'buff', GRANT: 'grant', CHEST: 'chest', BOX: 'box', COMMAND: 'command', SPECIAL: 'special' } as const;
export type ItemEffectKind = (typeof ItemEffectKind)[keyof typeof ItemEffectKind];

/** The items the game service handles one by one (an `ItemEffectKind.SPECIAL` item's handler). */
export const ItemSpecialHandler = { CIVIL_CODE: 'civilCode', CURE_INJURED: 'cureInjured', HERO_BOX: 'heroBox' } as const;
export type ItemSpecialHandler = (typeof ItemSpecialHandler)[keyof typeof ItemSpecialHandler];

/** The action an item is used through (an `ItemEffectKind.COMMAND` item's command). */
export const ItemCommand = {
  SPEEDUP: 'speedup',
  TROOPS_SPEEDUP: 'troops.speedup',
  FORTIFICATIONS_SPEEDUP: 'fortifications.speedup',
  CITY_MOVE: 'city.move',
  CITY_TRUCE: 'city.truce',
  HEROES_RESET: 'heroes.reset',
  HEROES_USE_ITEM: 'heroes.useItem',
} as const;
export type ItemCommand = (typeof ItemCommand)[keyof typeof ItemCommand];

/** How an item is used: from the inventory (POST /player/items/{id}/use), consumed by another action, or not at all (sent in the static config). */
export const ItemUse = { DIRECT: 'direct', ELSEWHERE: 'elsewhere', NONE: 'none' } as const;
export type ItemUse = (typeof ItemUse)[keyof typeof ItemUse];
export const ITEM_USES = Object.values(ItemUse) as [ItemUse, ...ItemUse[]];

/** What a hero item is paid with when not paid with the item itself. */
export const HeroItemPayment = { GOLD: 'gold' } as const;
export type HeroItemPayment = (typeof HeroItemPayment)[keyof typeof HeroItemPayment];

/** What a quest target asks for (quests.ts). */
export const QuestTargetKind = {
  BUILDING: 'building',
  RESEARCH: 'research',
  TROOPS: 'troops',
  HEROES: 'heroes',
  MAYOR: 'mayor',
  ALLIANCE: 'alliance',
  CITIES: 'cities',
  VALLEYS: 'valleys',
  PRESTIGE: 'prestige',
  POPULATION: 'population',
  TAX_RATE: 'taxRate',
  MAIL_SENT: 'mailSent',
  FRIEND: 'friend',
} as const;
export type QuestTargetKind = (typeof QuestTargetKind)[keyof typeof QuestTargetKind];

/** What a prerequisite asks for (construction.ts checkRequirements). */
export const RequirementKind = { BUILDING: 'building', TECH: 'tech', ITEM: 'item' } as const;
export type RequirementKind = (typeof RequirementKind)[keyof typeof RequirementKind];
export const REQUIREMENT_KINDS = Object.values(RequirementKind) as [RequirementKind, ...RequirementKind[]];

/** What needs a building or technology: another building, a troop or a technology (building-info.ts, tech-info.ts). */
export const UnlockKind = { BUILDING: 'building', TROOP: 'troop', TECH: 'tech' } as const;
export type UnlockKind = (typeof UnlockKind)[keyof typeof UnlockKind];

/** The parts of a city a building can go in (the available buildings' list). */
export const BuildingArea = { INSIDE: 'inside', OUTSIDE: 'outside', WALLS: 'walls' } as const;
export type BuildingArea = (typeof BuildingArea)[keyof typeof BuildingArea];
export const BUILDING_AREAS = Object.values(BuildingArea) as [BuildingArea, ...BuildingArea[]];

/** Chat channels (stored in chat_messages.channel). */
export const ChatChannel = { WORLD: 'world', BEGINNER: 'beginner', ALLIANCE: 'alliance', PRIVATE: 'private' } as const;
export type ChatChannel = (typeof ChatChannel)[keyof typeof ChatChannel];
export const CHAT_CHANNELS = Object.values(ChatChannel) as [ChatChannel, ...ChatChannel[]];

/** What one player has listed another as (stored in player_relations.kind). */
export const PlayerRelationKind = { FRIEND: 'friend', BLOCK: 'block' } as const;
export type PlayerRelationKind = (typeof PlayerRelationKind)[keyof typeof PlayerRelationKind];

/** Where the world's tiles came from (stored in world_state, the WORLD_MAP setting). */
export const WorldMapSource = { GENERATED: 'generated', LEGACY: 'legacy' } as const;
export type WorldMapSource = (typeof WorldMapSource)[keyof typeof WorldMapSource];
export const WORLD_MAP_SOURCES = Object.values(WorldMapSource) as [WorldMapSource, ...WorldMapSource[]];

/** (marchlands) no demolishing status: demolition is instant (orig 2, a timed demolition) */
export const BuildingStatus = {
  IDLE: 0,
  BUILDING: 1,
} as const;
export type BuildingStatus = (typeof BuildingStatus)[keyof typeof BuildingStatus];

/** (marchlands) What a flow's action does (stored in flows.actions). */
export const FlowActionType = {
  SET_MAYOR: 'setMayor',
  TRAIN_TROOPS: 'trainTroops',
  HEAL_TROOPS: 'healTroops',
  ATTACK_TARGETS: 'attackTargets',
  HIRE_HEROES: 'hireHeroes',
  WAIT: 'wait',
} as const;
export type FlowActionType = (typeof FlowActionType)[keyof typeof FlowActionType];

/** (marchlands) A flow between runs, waiting its turn, running its actions, or paused on a wait action (stored in flows.status). */
export const FlowStatus = { IDLE: 'idle', QUEUED: 'queued', RUNNING: 'running', WAITING: 'waiting' } as const;
export type FlowStatus = (typeof FlowStatus)[keyof typeof FlowStatus];
export const FLOW_STATUSES = Object.values(FlowStatus) as [FlowStatus, ...FlowStatus[]];

/** (marchlands) The cities a flow runs on: every city with a hero, including ones gained later, or the ids chosen (stored in flows.cities). */
export const FlowCities = { ALL: 'all' } as const;
export type FlowCityChoice = typeof FlowCities.ALL | number[];

/** (marchlands) What a flow's wait action waits for: a number of real minutes, or every army the run sent to be back. */
export const FlowWaitUntil = { TIME: 'time', ARMIES_HOME: 'armiesHome' } as const;
export type FlowWaitUntil = (typeof FlowWaitUntil)[keyof typeof FlowWaitUntil];
export const FLOW_WAIT_UNTILS = Object.values(FlowWaitUntil) as [FlowWaitUntil, ...FlowWaitUntil[]];

/** (marchlands) When a flow's heal action heals: at once, or once every army of the city is back. */
export const FlowHealWhen = { NOW: 'now', ARMIES_HOME: 'armiesHome' } as const;
export type FlowHealWhen = (typeof FlowHealWhen)[keyof typeof FlowHealWhen];
export const FLOW_HEAL_WHENS = Object.values(FlowHealWhen) as [FlowHealWhen, ...FlowHealWhen[]];

/** (marchlands) A flow's train action: as many as the city can afford, in place of a number. */
export const FLOW_TRAIN_MAX = 'max';

/** What healing injured troops is paid with. */
export const HealPayment = { RESOURCES: 'resources', HONOR: 'honor' } as const;
export type HealPayment = (typeof HealPayment)[keyof typeof HealPayment];
export const HEAL_PAYMENTS = Object.values(HealPayment) as [HealPayment, ...HealPayment[]];

/** The game clock's kinds of timed event (stored in timed_events.type), each with its handler in the game package's events.ts. */
export const TimedEventType = {
  BUILDING: 'building',
  RESEARCH: 'research',
  TRAIN: 'train',
  ARMY: 'army',
  ARMY_DEPART: 'army.depart',
  BUFF_EXPIRE: 'buff.expire',
  HERO_BUFF: 'hero.buff',
  SHIPMENT: 'shipment',
  CITY_ABANDON: 'city.abandon',
  FLOW_HEAL: 'flow.heal',
  FLOW_RESUME: 'flow.resume',
  FLOW_QUEUE: 'flow.queue',
} as const;
export type TimedEventType = (typeof TimedEventType)[keyof typeof TimedEventType];

/** Targets one city may attack in a flow action (a level 10 Rally Spot sends 10 armies). */
export const FLOW_MAX_TARGETS_PER_CITY = 10;

/** Longest a flow's "wait" action can wait (real time). */
export const FLOW_MAX_WAIT_MINUTES = 7 * 24 * 60;

/** The most heroes a flow's "hire heroes" action may aim for in a city (a level 10 Feasting Hall's places). */
export const FLOW_MAX_HIRES = 10;

/** The highest base attribute an Inn hero can be born with (heroes.ts randomStat). */
export const HERO_BASE_STAT_MAX = 79;

/** Game data a message refers to (`ref`, messages/index.ts), named by the client in the player's language: stored in messages and sent to the client. */
export const GameRefKind = {
  TROOP: 'troop',
  BUILDING: 'building',
  TECH: 'tech',
  ITEM: 'item',
  TITLE: 'title',
  TILE: 'tile',
  RESOURCE: 'resource',
  STAT: 'stat',
  ZONE: 'zone',
  RANK: 'rank',
  GEAR: 'gear',
  ITEM_CATEGORY: 'itemCategory',
} as const;
export type GameRefKind = (typeof GameRefKind)[keyof typeof GameRefKind];
export const GAME_REF_KINDS = Object.values(GameRefKind) as [GameRefKind, ...GameRefKind[]];

/** What a battle trace reports (battle/simulator.ts, TraceEvent): a kill, or how a round stood. Not stored or sent; the battle simulations read it. */
export const TraceKind = { KILL: 'kill', ROUND: 'round' } as const;
export type TraceKind = (typeof TraceKind)[keyof typeof TraceKind];

/**
 * What stands at a spot of a sprite drawn in code, where something moves or lights up: written by the art scripts
 * (tools/art/pixel.ts) to client/web/src/assets/spots.json, read by the client's animations.
 */
export const SpotKind = {
  ANVIL: 'anvil',
  BANNER: 'banner',
  BLADE: 'blade',
  CATAPULT: 'catapult',
  CROPS: 'crops',
  DOME: 'dome',
  DUMMY: 'dummy',
  FIRE: 'fire',
  FLAP: 'flap',
  GEM: 'gem',
  GLOW: 'glow',
  HORSE: 'horse',
  LOGS: 'logs',
  MINE: 'mine',
  NOD: 'nod',
  ROCK: 'rock',
  SAILS: 'sails',
  SHEEP: 'sheep',
  SHINE: 'shine',
  SMOKE: 'smoke',
  STALL: 'stall',
  STAR: 'star',
  STIR: 'stir',
  STONE: 'stone',
  SWAY: 'sway',
  SWING: 'swing',
  TENT: 'tent',
  WATER: 'water',
  WELL: 'well',
  WHEEL: 'wheel',
  WINDOW: 'window',
} as const;
export type SpotKind = (typeof SpotKind)[keyof typeof SpotKind];

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
