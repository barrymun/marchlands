// The values of these constants are stored in the database and sent to clients, so changing one needs a data migration
// (AGENTS.md). Code and other tests use the names, so they wouldn't notice: this test is the one place that writes them out.

import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ClientCmd, PushCmd } from '@marchlands/contracts';
import {
  ALL_REPORTS,
  AllianceRank,
  AllianceRequestKind,
  ArmyDirection,
  BASIC_RESOURCES,
  BattleResult,
  BattleTarget,
  BuffId,
  BuildingArea,
  BuildingStatus,
  BuildingType,
  CandlePeriod,
  ChatChannel,
  FactionId,
  FactionTemperament,
  FlagColour,
  FLOW_TRAIN_MAX,
  FlowActionType,
  FlowCities,
  FlowHealWhen,
  FlowStatus,
  FlowWaitUntil,
  FortKey,
  FortKill,
  FortType,
  GameRefKind,
  GearPieceId,
  HealPayment,
  HeroBuffId,
  HeroItemPayment,
  HeroStatus,
  ItemCommand,
  ItemEffectKind,
  ItemId,
  ItemSpecialHandler,
  ItemUse,
  MailType,
  MarketOrderType,
  MarketSide,
  Mission,
  PlayerRelationKind,
  QuestTargetKind,
  Relation,
  ReportBodyKind,
  ReportKind,
  ReportOrder,
  ReportType,
  RequirementKind,
  RESOURCE_KEYS,
  ResourceKey,
  Sex,
  SpeedupId,
  SpotKind,
  StandingTier,
  StatCounter,
  StatGroup,
  TechType,
  TileType,
  TimedEventType,
  TraceKind,
  TradeCounterparty,
  TradeSide,
  TrendKey,
  TroopKey,
  TroopType,
  UnlockKind,
  WorldMapSource,
  WorldStateKey,
} from '@marchlands/core';

describe('stored values', () => {
  it('names troops and fortifications as stored counts do', () => {
    expect(TroopKey).toEqual({
      PEASANTS: 'peasants',
      MILITIA: 'militia',
      SCOUTER: 'scouter',
      PIKEMEN: 'pikemen',
      SWORDSMEN: 'swordsmen',
      ARCHER: 'archer',
      CARRIAGE: 'carriage',
      LIGHT_CAVALRY: 'lightCavalry',
      HEAVY_CAVALRY: 'heavyCavalry',
      BALLISTA: 'ballista',
      BATTERING_RAM: 'batteringRam',
      CATAPULT: 'catapult',
    });
    expect(FortKey).toEqual({ TRAP: 'trap', ABATIS: 'abatis', ARROW_TOWER: 'arrowTower', ROLLING_LOGS: 'rollingLogs', ROCKFALL: 'rockfall' });
  });

  it('names gear pieces as stored stars do', () => {
    expect(Object.values(GearPieceId)).toEqual([
      'weapon',
      'shield',
      'mount',
      'necklace',
      'charm',
      'ring',
      'head',
      'shoulder',
      'chest',
      'back',
      'gauntlets',
      'belt',
      'legs',
      'feet',
    ]);
  });

  it('names stored alliance requests and world state rows', () => {
    expect(AllianceRequestKind).toEqual({ APPLY: 'apply', INVITE: 'invite' });
    expect(WorldStateKey).toEqual({ WORLD: 'world', ZONES: 'zones', MERCHANT: 'merchant', NPC_ECONOMY: 'npc-economy', STATS_STARTED_AT: 'statsStartedAt' });
  });

  it('names stored statistics counters', () => {
    expect(Object.values(StatGroup)).toEqual([
      'trained',
      'killed',
      'lost',
      'injured',
      'healed',
      'deserted',
      'disbanded',
      'produced',
      'wasted',
      'taxed',
      'plundered',
      'stolen',
      'attacks.won',
      'attacks.lost',
      'defenses.won',
      'defenses.lost',
      'captured',
      'taken',
      'npcWins',
      'items.used',
      'items.gained',
      'market.bought',
      'market.sold',
      'gained.dailyGift',
      'gained.blessing',
      'spent.building',
      'spent.research',
      'spent.training',
      'spent.healing',
      'spent.speedups',
      'spent.items',
      'spent.heroes',
      'spent.valleys',
      'spent.comfort',
      'spent.other',
    ]);
    expect(Object.values(StatCounter)).toEqual([
      'honor',
      'heroes.hired',
      'levels.building',
      'levels.research',
      'levels.hero',
      'levels.demolished',
      'upkeep.food',
      'salaries.gold',
      'spent.healing.honor',
      'market.goldPaid',
      'market.goldReceived',
      'scouting.won',
      'scouting.lost',
      'scouting.wonDefending',
      'scouting.lostDefending',
      'captured.city',
      'captured.npc',
      'captured.valley',
    ]);
  });

  it('flows', () => {
    expect(FlowActionType).toEqual({
      SET_MAYOR: 'setMayor',
      TRAIN_TROOPS: 'trainTroops',
      HEAL_TROOPS: 'healTroops',
      ATTACK_TARGETS: 'attackTargets',
      HIRE_HEROES: 'hireHeroes',
      WAIT: 'wait',
    });
    expect(FlowStatus).toEqual({ IDLE: 'idle', QUEUED: 'queued', RUNNING: 'running', WAITING: 'waiting' });
    expect(FlowCities).toEqual({ ALL: 'all' });
    expect(FlowWaitUntil).toEqual({ TIME: 'time', ARMIES_HOME: 'armiesHome' });
    expect(FlowHealWhen).toEqual({ NOW: 'now', ARMIES_HOME: 'armiesHome' });
    expect(FLOW_TRAIN_MAX).toBe('max');
  });

  it('battle results', () => {
    expect(BattleResult).toEqual({ ATTACKER_WON: 'attackerWon', DEFENDER_WON: 'defenderWon', DRAW: 'draw' });
  });

  it('item uses and unlocks', () => {
    expect(ItemUse).toEqual({ DIRECT: 'direct', ELSEWHERE: 'elsewhere', NONE: 'none' });
    expect(UnlockKind).toEqual({ BUILDING: 'building', TROOP: 'troop', TECH: 'tech' });
  });

  it('references in messages', () => {
    expect(GameRefKind).toEqual({
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
    });
  });

  it('spots on sprites (assets/spots.json)', () => {
    expect(SpotKind).toEqual({
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
    });
  });

  it('healing', () => {
    expect(HealPayment).toEqual({ RESOURCES: 'resources', HONOR: 'honor' });
  });

  it('timed events', () => {
    expect(TimedEventType).toEqual({
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
    });
  });

  it('resources', () => {
    expect(ResourceKey).toEqual({ GOLD: 'gold', FOOD: 'food', WOOD: 'wood', STONE: 'stone', IRON: 'iron' });
    // the market numbers the basic resources by their position here (resType 0 food, 1 lumber, 2 stone, 3 iron)
    expect(BASIC_RESOURCES).toEqual(['food', 'wood', 'stone', 'iron']);
    expect(RESOURCE_KEYS).toEqual(['gold', 'food', 'wood', 'stone', 'iron']);
  });

  it('reports', () => {
    expect(ReportBodyKind).toEqual({
      BATTLE: 'battle',
      SCOUT: 'scout',
      MOVEMENT: 'movement',
      TRADE: 'trade',
      TEXT: 'text',
      DESERTION: 'desertion',
      DRAFT: 'draft',
    });
    expect(BattleTarget).toEqual({ CITY: 'city', NPC: 'npc', VALLEY: 'valley' });
    expect(TradeSide).toEqual({ BUY: 'buy', SELL: 'sell' });
    expect(ALL_REPORTS).toBe('all');
  });

  it('the market', () => {
    expect(MarketOrderType).toEqual({ LIMIT: 'limit', MARKET: 'market' });
    expect(TradeCounterparty).toEqual({ PLAYER: 'player', FACTIONS: 'factions', MERCHANT: 'merchant' });
  });

  it('heroes', () => {
    expect(HeroItemPayment).toEqual({ GOLD: 'gold' });
  });

  it('cities', () => {
    expect(BuildingArea).toEqual({ INSIDE: 'inside', OUTSIDE: 'outside', WALLS: 'walls' });
    expect(RequirementKind).toEqual({ BUILDING: 'building', TECH: 'tech', ITEM: 'item' });
  });

  it('chat and relations', () => {
    expect(ChatChannel).toEqual({ WORLD: 'world', BEGINNER: 'beginner', ALLIANCE: 'alliance', PRIVATE: 'private' });
    expect(PlayerRelationKind).toEqual({ FRIEND: 'friend', BLOCK: 'block' });
    expect(ClientCmd).toEqual({ PING: 'ping' });
  });

  it('push messages, the original protocol names and misspellings included', () => {
    expect(PushCmd).toEqual({
      CONNECTED: 'server.Connected',
      CONNECTION_LOST: 'server.ConnectionLost',
      BUILD_COMPLETE: 'server.BuildComplate',
      RESOURCE_UPDATE: 'server.ResourceUpdate',
      CASTLE_UPDATE: 'server.CastleUpdate',
      TROOP_UPDATE: 'server.TroopUpdate',
      INJURED_TROOP_UPDATE: 'server.InjuredTroopUpdate',
      FORTIFICATIONS_UPDATE: 'server.FortificationsUpdate',
      TROOP_QUEUE_UPDATE: 'server.TroopQueueUpdate',
      FORTIFICATIONS_QUEUE_UPDATE: 'server.FortificationsQueueUpdate',
      RESEARCH_UPDATE: 'server.ResearchUpdate',
      RESEARCH_COMPLETE_UPDATE: 'server.ResearchCompleteUpdate',
      HERO_UPDATE: 'server.HeroUpdate',
      PLAYER_INFO_UPDATE: 'server.PlayerInfoUpdate',
      ITEM_UPDATE: 'server.ItemUpdate',
      PLAYER_BUFF_UPDATE: 'server.PlayerBuffUpdate',
      FLOW_UPDATE: 'server.FlowUpdate',
      PLAYER_BUFFS_UPDATE: 'server.PlayerBuffsUpdate',
      SELF_ARMIES_UPDATE: 'server.SelfArmysUpdate',
      FRIEND_ARMIES_UPDATE: 'server.FriendArmysUpdate',
      ENEMY_ARMIES_UPDATE: 'server.EnemyArmysUpdate',
      NEW_MAIL: 'server.NewMail',
      NEW_REPORT: 'server.NewReport',
      TRADES_UPDATE: 'server.TradesUpdate',
      TRANSIT_TRADE_UPDATE: 'server.TransingTradeUpdate',
      MARKET_UPDATE: 'server.MarketUpdate',
      CHANNEL_CHAT_MESSAGE: 'server.ChannelChatMsg',
      ALLIANCE_CHAT_MESSAGE: 'server.AllianceChatMsg',
      PRIVATE_CHAT_MESSAGE: 'server.PrivateChatMessage',
      SYSTEM_INFO_MESSAGE: 'server.SystemInfoMsg',
      ALLIANCE_INVITE: 'server.AllianceInvite',
      PONG: 'pong',
    });
  });

  it('the world', () => {
    expect(WorldMapSource).toEqual({ GENERATED: 'generated', LEGACY: 'legacy' });
  });

  it('the map and the game data ids', () => {
    expect(TileType).toEqual({ FOREST: 1, DESERT: 2, HILL: 3, SWAMP: 4, GRASS: 5, LAKE: 6, FLAT: 10, CASTLE: 11, NPC: 12, HISTORIC: 13 });
    expect(BuildingType).toEqual({
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
    });
    expect(TroopType).toEqual({
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
    });
    expect(FortType).toEqual({ TRAP: 14, ABATIS: 15, ARCHER_TOWER: 16, ROLLING_LOG: 17, TREBUCHET: 18 });
    expect(TechType).toEqual({
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
      HERO_ENHANCEMENT: 21,
    });
    expect(BuildingStatus).toEqual({ IDLE: 0, BUILDING: 1 });
    expect(SpeedupId).toEqual({ FREE: 'free.speed', GOLD: 'gold.speed', HALF_TIME: 'player.speedup.1' });
  });

  it('players, alliances and heroes', () => {
    expect(Relation).toEqual({ ALLIANCE: 0, ALLY: 1, NEUTRAL: 2, ENEMY: 3, NO_RELATION: 4, SELF: 5 });
    expect(AllianceRank).toEqual({ HOST: 4, VICE_HOST: 5, PRESIDENT: 6, OFFICER: 7, MEMBER: 8 });
    expect(HeroStatus).toEqual({ IDLE: 0, MAYOR: 1, ATTACK: 3, RETURN: 5 });
    expect(Sex).toEqual({ MALE: 0, FEMALE: 1 });
    expect(HeroBuffId).toEqual({ POWER: 'power', MANAGEMENT: 'management', STRATAGEM: 'stratagem' });
    expect(FlagColour).toEqual({
      RED: 'red',
      ORANGE: 'orange',
      AMBER: 'amber',
      GREEN: 'green',
      TEAL: 'teal',
      SKY: 'sky',
      BLUE: 'blue',
      INDIGO: 'indigo',
      VIOLET: 'violet',
      PINK: 'pink',
      SLATE: 'slate',
      BLACK: 'black',
    });
    expect(BuffId).toEqual({
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
      TRUCE: 'PlayerPeaceBuff',
      TRUCE_COOLDOWN: 'PlayerPeaceCoolDownBuff',
      TELEPORT_COOLDOWN: 'MoveCastleCoolDownBuff',
      HOLIDAY: 'FurloughBuff',
    });
    expect(StandingTier).toEqual({ HOSTILE: 'hostile', UNFRIENDLY: 'unfriendly', NEUTRAL: 'neutral', FRIENDLY: 'friendly', HONOURED: 'honoured' });
    expect(FactionId).toEqual({
      SAXON_LEAGUE: 'saxon',
      LOTHARINGIAN_CROWN: 'lotharingian',
      FRANCONIAN_HEARTLAND: 'franconian',
      BOHEMIAN_CROWN: 'bohemian',
      ITALIAN_LEAGUE: 'italian',
    });
    expect(FactionTemperament).toEqual({ TRADING: 'trading', WARLIKE: 'warlike', INSULAR: 'insular' });
  });

  it('armies and battles', () => {
    expect(Mission).toEqual({ TRANSPORT: 1, REINFORCE: 2, SCOUT: 3, BUILD_CITY: 4, ATTACK: 5 });
    expect(ArmyDirection).toEqual({ FORWARD: 1, BACKWARD: 2, STAY: 3 });
    expect(FortKill).toEqual({ TRAP: 'trap', ABATIS: 'abatis', LOG: 'log', TREBUCHET: 'trebuchet', TOWER: 'tower' });
    expect(TraceKind).toEqual({ KILL: 'kill', ROUND: 'round' });
  });

  it('mail and reports', () => {
    expect(MailType).toEqual({ INBOX: 1, SYSTEM: 2, SENT: 3 });
    expect(ReportType).toEqual({ TRADE: 0, ARMY: 1, OTHER: 2 });
    expect(ReportKind).toEqual({ BATTLES: 'battles', SCOUTING: 'scouting', RETURNS: 'returns', MOVEMENTS: 'movements', OTHER: 'other' });
    expect(ReportOrder).toEqual({ NEWEST: 'newest', OLDEST: 'oldest' });
  });

  it('market sides and candle periods', () => {
    expect(MarketSide).toEqual({ BUY: 0, SELL: 1 });
    expect(CandlePeriod).toEqual({ MINUTE: 'minute', HOUR: 'hour', DAY: 'day' });
  });

  it('item ids, the original game ids', () => {
    expect(ItemId).toEqual({
      BEGINNER_GUIDELINES: 'consume.2.a',
      PRIMARY_GUIDELINES: 'consume.2.b',
      INTERMEDIATE_GUIDELINES: 'consume.2.b.1',
      SENIOR_GUIDELINES: 'consume.2.c',
      MASTER_GUIDELINES: 'consume.2.c.1',
      ULTIMATE_GUIDELINES: 'consume.2.d',
      NAPOLEONS_DIARY: 'player.troop.1.b',
      ARCHIMEDES_NOTE: 'player.fort.1.c',
      PLOWSHARES: 'player.resinc.1',
      IRON_RAKE: 'player.resinc.1.b',
      ARCH_SAW: 'player.resinc.2',
      DOUBLE_SAW: 'player.resinc.2.b',
      QUARRYING_TOOLS: 'player.resinc.3',
      ADV_QUARRYING_TOOLS: 'player.resinc.3.b',
      BLOWER: 'player.resinc.4',
      BLAST_FURNACE: 'player.resinc.4.b',
      TAX_POLICY: 'player.gold.1.a',
      ADV_TAX_POLICY: 'player.gold.1.b',
      WAR_HORN: 'player.attackinc.1',
      IVORY_HORN: 'player.attackinc.1.b',
      CORSELET: 'player.defendinc.1',
      ULTRA_CORSELET: 'player.defendinc.1.b',
      WAR_ENSIGN: 'player.troop.1.a',
      BERNINIS_HAMMER: 'player.queue.building',
      VESTAS_BLESSING: 'player.reduce.troops.upkeep.1',
      VESTAS_GRAND_BLESSING: 'player.reduce.troops.upkeep.7',
      QUARTERMASTERS_SEAL: 'player.reduce.troops.cost.1',
      QUARTERMASTERS_CHARTER: 'player.reduce.troops.cost.7',
      TRUCE_AGREEMENT: 'player.peace.1',
      CITY_TELEPORTER: 'consume.move.1',
      CIVIL_CODE: 'player.pop.1.a',
      PENICILLIN: 'player.relive.1',
      JUNIOR_MEDAL_BOX: 'player.box.special.1',
      MEDIUM_MEDAL_BOX: 'player.box.special.2',
      SENIOR_MEDAL_BOX: 'player.box.special.3',
      HERO_PACKAGE: 'player.box.currently.1',
      WELCOME_PACKAGE: 'player.box.present.2',
      HOLY_WATER: 'hero.reset.1',
      EXCALIBUR: 'hero.power.1',
      WEALTH_OF_NATIONS: 'hero.management.1',
      ART_OF_WAR: 'hero.intelligence.1',
      ANABASIS: 'player.experience.1.a',
      EPITOME_OF_MILITARY_SCIENCE: 'player.experience.1.b',
      ON_WAR: 'player.experience.1.c',
      CROSS_MEDAL: 'hero.loyalty.1',
      ROSE_MEDAL: 'hero.loyalty.2',
      LION_MEDAL: 'hero.loyalty.3',
      HONOUR_MEDAL: 'hero.loyalty.4',
      COURAGE_MEDAL: 'hero.loyalty.5',
      WISDOM_MEDAL: 'hero.loyalty.6',
      FREEDOM_MEDAL: 'hero.loyalty.7',
      JUSTICE_MEDAL: 'hero.loyalty.8',
      NATION_MEDAL: 'hero.loyalty.9',
    });
  });

  it('the statistics trends', () => {
    expect(TrendKey).toEqual({
      ATTACKS_WON: 'attacksWon',
      DEFENSES_WON: 'defensesWon',
      HONOR: 'honor',
      ENEMIES: 'enemies',
      TRAINED: 'trained',
      CAPTURED: 'captured',
    });
  });

  it('items and quests', () => {
    expect(ItemEffectKind).toEqual({ BUFF: 'buff', GRANT: 'grant', CHEST: 'chest', BOX: 'box', COMMAND: 'command', SPECIAL: 'special' });
    expect(ItemSpecialHandler).toEqual({ CIVIL_CODE: 'civilCode', CURE_INJURED: 'cureInjured', HERO_BOX: 'heroBox' });
    expect(ItemCommand).toEqual({
      SPEEDUP: 'speedup',
      TROOPS_SPEEDUP: 'troops.speedup',
      FORTIFICATIONS_SPEEDUP: 'fortifications.speedup',
      CITY_MOVE: 'city.move',
      CITY_TRUCE: 'city.truce',
      HEROES_RESET: 'heroes.reset',
      HEROES_USE_ITEM: 'heroes.useItem',
    });
    expect(QuestTargetKind).toEqual({
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
    });
  });
});

// A new set is easily forgotten here, and nothing else would notice: so every named set (a const object with a type of the
// same name beside it, as the lint rules see them) in the shared code and the backend must have its entry above, or be listed
// here with why it needs none. The client's own sets aren't scanned: the server neither stores nor sends them.
const SCANNED = ['shared/core/src', 'shared/contracts/src', 'backend/packages', 'backend/services'];
const SKIPPED_FOLDERS = new Set(['node_modules', 'generated', 'test', 'dist']);
const NEEDS_NO_ENTRY: Record<string, string> = {
  CultureId: 'private to hero-names.ts: it picks the words of a name, and only the finished name is stored',
  ProofCheck: 'private to the sign-up route, which answers with a message for it: neither stored nor sent',
};

/** The named sets a source file declares. */
function namedSets(source: string): string[] {
  return [...source.matchAll(/^(?:export )?const ([A-Z]\w*) = \{/gm)].flatMap((m) =>
    m[1] && new RegExp(`^(?:export )?type ${m[1]} =`, 'm').test(source) ? [m[1]] : [],
  );
}

/** Whether a test source writes a set's values out, as a whole or as a list. */
const writesOut = (test: string, set: string) => new RegExp(`expect\\((?:Object\\.values\\()?${set}\\)`).test(test);

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_FOLDERS.has(entry.name) ? [] : sourceFiles(file);
    return entry.name.endsWith('.ts') ? [file] : [];
  });
}

describe('every named set', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const sets = SCANNED.flatMap((dir) => sourceFiles(path.join(root, dir))).flatMap((file) => namedSets(fs.readFileSync(file, 'utf8')));
  const thisTest = fs.readFileSync(import.meta.filename, 'utf8');

  it('finds the sets of each part of the code', () => {
    expect(sets.length).toBeGreaterThan(60);
    expect(sets).toEqual(expect.arrayContaining(['BuffId', 'PushCmd', 'ProofCheck']));
  });

  it('has its values written out in this file, or a reason not to', () => {
    const missing = sets.filter((set) => !writesOut(thisTest, set) && !Object.hasOwn(NEEDS_NO_ENTRY, set));
    expect(missing, 'Add an entry above with its exact values, or to NEEDS_NO_ENTRY saying why it is neither stored nor sent').toEqual([]);
  });

  it('lists no reason for a set that is gone or has its entry', () => {
    for (const set of Object.keys(NEEDS_NO_ENTRY)) {
      expect(sets, set).toContain(set);
      expect(writesOut(thisTest, set), set).toBe(false);
    }
  });

  describe(namedSets.name, () => {
    it('finds a const object with a type of its name beside it, exported or not', () => {
      expect(namedSets("export const Pan = { UP: 'up' } as const;\nexport type Pan = (typeof Pan)[keyof typeof Pan];")).toEqual(['Pan']);
      expect(namedSets("const Pan = {\n  UP: 'up',\n} as const;\ntype Pan = (typeof Pan)[keyof typeof Pan];")).toEqual(['Pan']);
    });

    it('leaves out a const object with no such type, or a type with no such object', () => {
      expect(namedSets("export const Pan = { UP: 'up' } as const;\nexport type Direction = string;")).toEqual([]);
      expect(namedSets('export type Pan = string;')).toEqual([]);
      expect(namedSets('const pan = { up: 1 };\ntype pan = typeof pan;')).toEqual([]);
    });

    it('leaves out a schema with a type of its name', () => {
      expect(namedSets('export const Pan = z.object({});\nexport type Pan = z.infer<typeof Pan>;')).toEqual([]);
    });
  });

  describe(writesOut.name, () => {
    it('knows the two ways of writing a set out', () => {
      expect(writesOut('expect(Pan).toEqual({});', 'Pan')).toBe(true);
      expect(writesOut('expect(Object.values(Pan)).toEqual([]);', 'Pan')).toBe(true);
    });

    it('wants the whole set: not its name turning up, one of its values, or a longer name', () => {
      expect(writesOut('import { Pan } from "x";', 'Pan')).toBe(false);
      expect(writesOut('expect(Pan.UP).toBe(1);', 'Pan')).toBe(false);
      expect(writesOut('expect(PanDirection).toEqual({});', 'Pan')).toBe(false);
    });
  });
});
