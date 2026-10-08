// Shapes of persisted game state (stored as jsonb) shared by core, db, contracts and clients.
// Each shape is a zod schema; the TypeScript type is inferred from it, so the database column
// types (`jsonb().$type<...>()`), the API contract and the client all use one definition.

import { z } from 'zod';
import { FORT_KEY_LIST, RESOURCE_KEYS, TROOP_KEY_LIST, type FortKey, type TroopKey } from './constants.ts';

const count = z.number().nonnegative();

export const TroopKeySchema = z.enum(TROOP_KEY_LIST as [TroopKey, ...TroopKey[]]);
export const FortKeySchema = z.enum(FORT_KEY_LIST as [FortKey, ...FortKey[]]);
export const ResourceKeySchema = z.enum(RESOURCE_KEYS);

export const ResourceSetSchema = z.object({ gold: z.number(), food: z.number(), wood: z.number(), stone: z.number(), iron: z.number() });
export type ResourceSet = z.infer<typeof ResourceSetSchema>;

export const TroopCountsSchema = z.partialRecord(TroopKeySchema, count);
export type TroopCounts = z.infer<typeof TroopCountsSchema>;

export const FortCountsSchema = z.partialRecord(FortKeySchema, count);
export type FortCounts = z.infer<typeof FortCountsSchema>;

export const BuildingStatus = {
  IDLE: 0,
  BUILDING: 1,
  DEMOLISHING: 2,
} as const;
export const BuildingStatusSchema = z.literal([BuildingStatus.IDLE, BuildingStatus.BUILDING, BuildingStatus.DEMOLISHING]);
export type BuildingStatus = z.infer<typeof BuildingStatusSchema>;

export const BuildingStateSchema = z.object({
  /** -1 Town Hall, -2 Walls, 0..31 inside, 1001..1040 fields outside */
  positionId: z.number().int(),
  typeId: z.number().int(),
  /** current completed level; a new building under construction has level 0 */
  level: z.number().int(),
  status: BuildingStatusSchema,
  startTime: z.number(),
  endTime: z.number(),
});
export type BuildingState = z.infer<typeof BuildingStateSchema>;

/** One batch of troops (or fortifications) in a production queue. */
export const TrainBatchSchema = z.object({
  queueId: z.number().int(),
  troopId: z.number().int(),
  count: z.number().int(),
  /** time the batch started producing (0 while waiting) */
  startTime: z.number(),
  /** completion time (0 while waiting) */
  endTime: z.number(),
  /** total production time of the batch, ms */
  costTime: z.number(),
  /** (marchlands) share of the normal cost paid (troopCostShare; absent = 1): what a cancel refunds from */
  paidShare: z.number().optional(),
});
export type TrainBatch = z.infer<typeof TrainBatchSchema>;

export const TroopQueueStateSchema = z.object({
  /** barracks position */
  positionId: z.number().int(),
  nextQueueId: z.number().int(),
  queue: z.array(TrainBatchSchema),
});
export type TroopQueueState = z.infer<typeof TroopQueueStateSchema>;

export const FortQueueStateSchema = z.object({
  nextQueueId: z.number().int(),
  queue: z.array(TrainBatchSchema),
});
export type FortQueueState = z.infer<typeof FortQueueStateSchema>;

export const ResearchEntrySchema = z.object({
  level: z.number().int(),
  /** city currently researching the next level (absent when idle) */
  cityId: z.number().int().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
});
export type ResearchEntry = z.infer<typeof ResearchEntrySchema>;
/** techId -> state */
export const ResearchStateSchema = z.record(z.string(), ResearchEntrySchema);
export type ResearchState = z.infer<typeof ResearchStateSchema>;

/** itemId -> count */
export const ItemCountsSchema = z.record(z.string(), z.number());
export type ItemCounts = z.infer<typeof ItemCountsSchema>;

export const BuffStateSchema = z.object({
  id: z.string(),
  desc: z.string(),
  endTime: z.number(),
  /** optional magnitude (e.g. upkeep reduction) */
  param: z.number().optional(),
  /** city-scoped buffs */
  cityId: z.number().int().optional(),
  /** (marchlands) the item last used to set or extend it (items sharing a buff, e.g. 1-day and 7-day ones) */
  itemId: z.string().optional(),
});
export type BuffState = z.infer<typeof BuffStateSchema>;

export const CastleSignSchema = z.object({
  tileId: z.number().int(),
  name: z.string(),
  x: z.number().int(),
  y: z.number().int(),
});
export type CastleSign = z.infer<typeof CastleSignSchema>;

export const CityMiscSchema = z.object({
  /** last population/loyalty drift tick boundary (ms) */
  lastTickAt: z.number().optional(),
  /** last loyalty drift boundary on real time (BALANCE.cityLoyaltyRealTime) */
  loyaltyTickAt: z.number().optional(),
  lastComfortAt: z.number().optional(),
  lastLevyAt: z.number().optional(),
  /** food shortfall carried into troop desertion */
  starvingSince: z.number().optional(),
});
export type CityMisc = z.infer<typeof CityMiscSchema>;

/** A named army composition a lord saved to send again quickly. */
export const ArmyPresetSchema = z.object({ id: z.string(), name: z.string(), troops: TroopCountsSchema });
export type ArmyPreset = z.infer<typeof ArmyPresetSchema>;

/** Targets one city may attack in a flow action (a level 10 Rally Spot sends 10 armies). */
export const FLOW_MAX_TARGETS_PER_CITY = 10;

/** Longest a flow's "wait" action can wait (real time). */
export const FLOW_MAX_WAIT_MINUTES = 7 * 24 * 60;

/**
 * (marchlands) One action of a flow (flows.ts): appoint the city's best hero by an attribute as mayor,
 * train troops, attack a target list, heal, or wait (the whole flow pauses, every city together).
 */
export const FlowActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('setMayor'), stat: z.enum(['power', 'management', 'stratagem']).describe('attribute the new mayor is best at') }),
  z.object({
    type: z.literal('trainTroops'),
    troopId: z.number().int().describe('troop type id'),
    amount: z.union([z.literal('max'), z.number().int().min(1)]).describe("a number, or 'max' for as many as the city can afford"),
  }),
  z.object({
    type: z.literal('healTroops'),
    payWith: z.enum(['resources', 'honor']).describe('heal every injured troop, paid with resources or honor'),
    when: z.enum(['now', 'armiesHome']).default('now').describe("'armiesHome': once every army of the city is back (e.g. after farming)"),
  }),
  z.object({
    type: z.literal('attackTargets'),
    presetId: z.string().describe('saved army sent at each target'),
    /** each city's own targets (city id -> tile ids), attacked in order with its idle heroes, strongest Attack first */
    targets: z.record(z.string(), z.array(z.number().int()).max(FLOW_MAX_TARGETS_PER_CITY)),
  }),
  z.object({
    type: z.literal('wait'),
    until: z.enum(['time', 'armiesHome']).describe("'time': a number of real minutes; 'armiesHome': until every army this run sent is back"),
    minutes: z.number().int().min(1).max(FLOW_MAX_WAIT_MINUTES).default(10).describe("real minutes (for until 'time'); not sped up by GAME_SPEED"),
  }),
]);
export type FlowAction = z.infer<typeof FlowActionSchema>;

/** (marchlands) A named series of actions a lord runs on any of their cities. */
export const FlowSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(40),
  actions: z.array(FlowActionSchema).min(1).max(20),
  /** cities the flow runs on: 'all' (every city, including ones gained later) or chosen city ids */
  cities: z.union([z.literal('all'), z.array(z.number().int())]).default('all'),
  /** start the flow again after each run, until it fails or is switched off */
  repeat: z.boolean().default(false),
});
export type Flow = z.infer<typeof FlowSchema>;

export const PlayerMiscSchema = z.object({
  icon: z.number().int().optional(),
  changedFace: z.boolean().optional(),
  allianceApply: z.string().optional(),
  allianceApplyAt: z.number().optional(),
  lastAllianceLeftAt: z.number().optional(),
  lastAllianceLeftId: z.number().int().optional(),
  /** daily purchase counters: itemId -> { day, count } */
  dailyLimits: z.record(z.string(), z.object({ day: z.string(), count: z.number().int() })).optional(),
  tutorialStep: z.number().int().optional(),
  dailyGiftDay: z.string().optional(),
  denyChatUntil: z.number().optional(),
  /** (marchlands) saved army compositions for the send-army dialog */
  armyPresets: z.array(ArmyPresetSchema).optional(),
  /** (marchlands) hero gear stars bought per piece (gear.ts) */
  gearStars: z.record(z.string(), z.number().int()).optional(),
});
export type PlayerMisc = z.infer<typeof PlayerMiscSchema>;

// ---- report payloads ----
// Unions of plain objects resolve to the first variant that parses (unknown keys are stripped),
// so variants that extend another one are listed before it.

/** A hero as shown in a report (guards of NPC cities and valleys have id 0). */
export const ReportHeroSchema = z.object({ id: z.number().int(), name: z.string(), level: z.number().int(), logoUrl: z.string() });
export type ReportHero = z.infer<typeof ReportHeroSchema>;

const ReportHeroBriefSchema = z.object({ name: z.string(), level: z.number().int() });
const BeforeLostAfter = <T extends z.ZodType>(s: T) => z.object({ before: s, lost: s, after: s });

export const BattleSideReportSchema = z.object({
  player: z.string(),
  hero: ReportHeroSchema.nullable(),
  troops: BeforeLostAfter(TroopCountsSchema),
  /** fallen troops that survived injured (Medicine); heal them in the city's Military tab */
  injured: TroopCountsSchema.optional(),
  honor: z.number(),
  heroExp: z.number(),
});
export const BattleDefenderReportSchema = BattleSideReportSchema.extend({
  forts: BeforeLostAfter(FortCountsSchema).optional(),
  wallLevel: z.number().int().optional(),
});

const BattleBaseSchema = z.object({
  result: z.enum(['attackerWon', 'defenderWon', 'draw']),
  rounds: z.number().int(),
  attacker: BattleSideReportSchema,
  defender: BattleDefenderReportSchema,
});
const BattlePlunderSchema = z.object({
  plunder: ResourceSetSchema,
  loyaltyDamage: z.number(),
  loyaltyLeft: z.number(),
  captured: z.boolean(),
  /** medals the attacker found (item id -> count) */
  medals: z.record(z.string(), z.number()).optional(),
});
/** Extra fields of each battle report variant, by target (player city, NPC city, valley). */
export const BattleCityExtraSchema = BattlePlunderSchema.extend({ city: z.string() });
export const BattleNpcExtraSchema = BattlePlunderSchema.extend({ level: z.number().int() });
export const BattleValleyExtraSchema = z.object({
  occupied: z.boolean(),
  /** why a won valley was not occupied ('' otherwise) */
  reason: z.string(),
  valley: z.object({ type: z.number().int(), level: z.number().int() }),
});
export type BattleExtra = z.infer<typeof BattleCityExtraSchema> | z.infer<typeof BattleNpcExtraSchema> | z.infer<typeof BattleValleyExtraSchema>;

export const BattleReportSchema = z.union([
  BattleBaseSchema.extend(BattleCityExtraSchema.shape),
  BattleBaseSchema.extend(BattleNpcExtraSchema.shape),
  BattleBaseSchema.extend(BattleValleyExtraSchema.shape),
]);
export type BattleReport = z.infer<typeof BattleReportSchema>;

const ScoutFightSchema = z.object({
  rounds: z.number().int(),
  attackerScouts: z.object({ before: z.number(), after: z.number() }),
  defenderScouts: z.object({ before: z.number(), after: z.number() }),
});
export const ScoutReportSchema = z.union([
  /** NPC city: full intel, scouting always succeeds */
  z.object({
    target: z.literal('npc'),
    level: z.number().int(),
    success: z.boolean(),
    loyalty: z.number(),
    population: z.number(),
    resources: ResourceSetSchema,
    troops: TroopCountsSchema,
    fortifications: FortCountsSchema,
    wallLevel: z.number().int(),
    buildings: z.array(z.object({ typeId: z.number().int(), levels: z.array(z.number().int()) })),
    hero: ReportHeroBriefSchema,
  }),
  /** valley or empty land */
  z.object({
    target: z.literal('valley'),
    type: z.number().int(),
    level: z.number().int(),
    owner: z.string().nullable(),
    success: z.boolean(),
    troops: TroopCountsSchema,
    /** the defending hero of an unowned valley (the one the next attack meets) */
    hero: ReportHeroBriefSchema.optional(),
  }),
  /** player city, the scouting player's copy */
  z.object({
    target: z.literal('city'),
    owner: z.string(),
    success: z.boolean(),
    battle: ScoutFightSchema,
    /** null when the scouts were repelled */
    intel: z
      .object({
        resources: ResourceSetSchema,
        troops: TroopCountsSchema,
        fortifications: FortCountsSchema,
        wallLevel: z.number().int(),
        loyalty: z.number(),
        population: z.number(),
        /** Informatics 1+ */
        heroes: z.array(ReportHeroBriefSchema).optional(),
        /** Informatics 2+ */
        buildings: z.array(z.object({ typeId: z.number().int(), level: z.number().int() })).optional(),
        stationed: z.array(TroopCountsSchema),
      })
      .nullable(),
  }),
  /** player city, the scouted player's copy */
  z.object({ target: z.literal('city'), from: z.string(), success: z.boolean(), battle: ScoutFightSchema }),
]);
export type ScoutReport = z.infer<typeof ScoutReportSchema>;

export const MovementReportSchema = z.union([
  /** reinforcements reached one of the player's own cities (heroReturned: no free hero slot) */
  z.object({ hero: ReportHeroSchema.nullable(), troops: TroopCountsSchema, resources: ResourceSetSchema, heroReturned: z.boolean() }),
  /** an army returned home */
  z.object({ hero: ReportHeroSchema.nullable(), troops: TroopCountsSchema, resources: ResourceSetSchema }),
  /** an ally's reinforcements arrived */
  z.object({ from: z.string(), hero: ReportHeroSchema.nullable(), troops: TroopCountsSchema }),
]);
export type MovementReport = z.infer<typeof MovementReportSchema>;

export const TradeReportSchema = z.union([
  /** a market order filled */
  z.object({ side: z.enum(['buy', 'sell']), resource: ResourceKeySchema, amount: z.number(), price: z.number(), gold: z.number() }),
  /** a transport delivered goods */
  z.object({ from: z.string(), to: z.string(), resources: ResourceSetSchema }),
]);
export type TradeReport = z.infer<typeof TradeReportSchema>;

/** Troops that deserted a city while it had no food (economy.ts starve). */
export const DesertionReportSchema = z.object({
  cityId: z.number(),
  city: z.string(),
  /** troops that left, summed over every settle merged into this report */
  troops: TroopCountsSchema,
  /** game time the city first ran short (start of the first merged settle window) */
  from: z.number(),
  /** game time of the last settle that found deserters */
  to: z.number(),
  /** food production, troop upkeep and net food per hour when the report was last updated */
  food: z.object({ production: z.number(), upkeep: z.number(), net: z.number() }),
  /** the latest merged settle window: a settle that was not saved is recomputed from the same start and replaces it */
  last: z.object({ from: z.number(), troops: TroopCountsSchema }),
});
export type DesertionReport = z.infer<typeof DesertionReportSchema>;

/** Report payloads are structured JSON (the original wrote XML files). */
export const ReportBodySchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('battle'), battle: BattleReportSchema }),
  z.object({ kind: z.literal('scout'), scout: ScoutReportSchema }),
  z.object({ kind: z.literal('movement'), movement: MovementReportSchema }),
  z.object({ kind: z.literal('trade'), trade: TradeReportSchema }),
  z.object({ kind: z.literal('text'), text: z.string() }),
  z.object({ kind: z.literal('desertion'), desertion: DesertionReportSchema }),
]);
export type ReportBody = z.infer<typeof ReportBodySchema>;
