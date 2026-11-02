// City management: interior, buildings, research, troops and fortifications
// (backend/services/api/src/routes/cities.ts).

import { z } from 'zod';

import { FortKeySchema, MessageSchema, RequirementCheckSchema, ResourceKeySchema, TroopKeySchema } from '@marchlands/core';

import { BuildingBean } from '#/beans.ts';
import { Ms, ResourceAmounts, zCityParams, zId, zTroops } from '#/common.ts';

// ---- requests ----

export const BuildingPositionId = z.coerce.number().int().min(-2).max(1040);
export const CityPositionParams = zCityParams.extend({ positionId: BuildingPositionId });
export const TrainingQueueParams = zCityParams.extend({ positionId: BuildingPositionId, queueId: zId });
export const SpeedupBody = z.object({
  itemId: z.string().describe('free.speed | gold.speed | consume.2.a ... consume.2.d'),
});

export const UpdateCityBody = z.object({
  name: z.string().optional(),
  logoUrl: z.string().optional(),
  goOutForBattle: z.boolean().optional(),
  allowAlliance: z.boolean().optional(),
});
export const TaxRateBody = z.object({ rate: z.number().int() });
export const ResourcePercentBody = z.object({ food: z.number().int(), wood: z.number().int(), stone: z.number().int(), iron: z.number().int() }).partial();
export const ComfortBody = z.object({ typeId: z.number().int().describe('3 blessing (gold for food), 4 population raising (food for people)') });
export const MoveCityBody = z.object({ targetTileId: zId.describe('a free flat') });
/** (marchlands) the daily draft of a held historic city */
export const DraftBody = z.object({
  tileId: zId.optional().describe("a barbarian city nobody holds, in the seat's area; without one, the one the seat would pick drafting by itself"),
});
export const DraftModeBody = z.object({ auto: z.boolean().describe('draft by itself (true) or only when its holder chooses') });

export const AvailableBuildingsQuery = z.object({ area: z.enum(['inside', 'outside', 'walls']).default('inside') });
export const ConstructBody = z.object({ typeId: z.number().int(), positionId: z.number().int() });

export const ResearchBody = z.object({ techId: z.number().int() });
/** Picks one of the city's researches; optional while the city researches only one. */
export const ResearchTechQuery = z.object({
  techId: z.coerce.number().int().optional().describe('tech to act on (required when the city researches several)'),
});
export const ResearchSpeedupBody = SpeedupBody.extend({
  techId: z.number().int().optional().describe('tech to speed up (required when the city researches several)'),
});

export const TrainBody = z.object({ troopId: z.number().int(), count: z.number().int(), positionId: z.number().int().optional() });
export const TrainSplitBody = z.object({ troopId: z.number().int(), count: z.number().int() });
export const TrainSplitResult = z
  .object({
    batches: z.array(z.object({ positionId: z.number().int().describe('barracks'), count: z.number().int(), endTime: Ms.describe('estimated finish') })),
    finishAt: Ms.describe('when the last batch finishes'),
  })
  .meta({ id: 'TrainSplitResult' });
export type TrainSplitResult = z.infer<typeof TrainSplitResult>;
export const TrainManyBody = z.object({
  orders: z
    .array(z.object({ troopId: z.number().int(), count: z.number().int().min(1) }))
    .min(1)
    .max(20)
    .describe('one order per unit type, all trained or none'),
  split: z.boolean().default(true).describe('troops: split each order over every barracks (false: all at positionId)'),
  positionId: z.number().int().optional().describe('troops: the barracks when not splitting'),
});
export const TrainManyResult = z.object({ orders: z.number().int(), units: z.number().int() }).meta({ id: 'TrainManyResult' });
export const TroopCountBody = z.object({ troopId: z.number().int(), count: z.number().int() });
export const InjuredTroopsBody = z.object({ troops: zTroops });
export const CureInjuredBody = InjuredTroopsBody.extend({
  payWith: z.enum(['resources', 'honor']).default('resources').describe('resources: a share of the training cost; honor: each unit costs its food upkeep'),
});

// ---- shared pieces ----

const int = () => z.number().int();
/** Config costs are whole numbers. */
const costShape = { gold: int(), food: int(), wood: int(), stone: int(), iron: int() };

export const RequirementCheck = RequirementCheckSchema.meta({ id: 'RequirementCheck' });
export type RequirementCheck = z.infer<typeof RequirementCheck>;

export const CitySpeedupCost = z
  .object({ goldNeed: int().describe('city gold to finish now'), timeLeft: z.number().describe('ms') })
  .meta({ id: 'CitySpeedupCost' });
export type CitySpeedupCost = z.infer<typeof CitySpeedupCost>;

// ---- interior ----

export const ComfortResult = z.object({ freeBlessing: z.boolean().describe('blessing (type 3) granted double food') }).meta({ id: 'ComfortResult' });
export type ComfortResult = z.infer<typeof ComfortResult>;

export const ResourceProductionLine = z
  .object({
    typeid: int().describe('1 food, 2 wood, 3 stone, 4 iron'),
    resource: ResourceKeySchema.exclude(['gold']),
    basicOutput: int().describe('per hour, regardless of fields'),
    fieldOutput: int().describe('per hour, after work rate and efficiency'),
    bonus: z.number().describe('production bonus as a share (0.25 = +25%)'),
    armyConsumption: int().describe('food upkeep per hour (0 for other resources)'),
    totalOutput: int().describe('net per hour'),
    commenceRate: int().describe('work rate, %'),
    maxLabour: int(),
    storage: int(),
  })
  .meta({ id: 'ResourceProductionLine' });
export type ResourceProductionLine = z.infer<typeof ResourceProductionLine>;

export const ProductionBreakdown = z.array(ResourceProductionLine).meta({ id: 'ProductionBreakdown' });
export type ProductionBreakdown = z.infer<typeof ProductionBreakdown>;

export const CityMoveResult = z.object({ fieldId: int().describe('new tile id'), x: int(), y: int() }).meta({ id: 'CityMoveResult' });
export type CityMoveResult = z.infer<typeof CityMoveResult>;
export const DraftResult = z.object({ troops: zTroops.describe('the troops drafted into the seat') }).meta({ id: 'DraftResult' });
export type DraftResult = z.infer<typeof DraftResult>;

// ---- buildings ----

export const BuildingLevelInfo = z
  .object({
    typeId: int(),
    level: int().describe('level being built'),
    time: int().describe('build time, seconds'),
    ...costShape,
    requirements: z.array(RequirementCheck),
    ok: z.boolean().describe('all requirements met'),
    effect: MessageSchema.nullable().describe('what the building gives at this level (`buildingInfo.effect.*`); null when nothing measurable'),
  })
  .meta({ id: 'BuildingLevelInfo' });

export const BuildingDescription = z
  .object({
    typeId: int(),
    summary: MessageSchema.nullable().describe('what the building does (`buildingInfo.summary.*`); null for an unknown type'),
    placement: MessageSchema.nullable().describe('where it can be built and how many (`buildingInfo.placement.*`); null for an unknown type'),
    unlocks: z
      .array(
        z.object({
          kind: z.enum(['building', 'troop', 'tech']),
          id: int().describe('building type, troop or technology id'),
          level: int().describe('level of this building required'),
        }),
      )
      .describe('buildings, troops and technologies that need this building, by level needed'),
  })
  .meta({ id: 'BuildingDescription' });
export type BuildingDescription = z.infer<typeof BuildingDescription>;
export type BuildingLevelInfo = z.infer<typeof BuildingLevelInfo>;

export const AvailableBuildings = z
  .object({ buildings: z.array(BuildingLevelInfo.extend({ info: BuildingDescription }).nullable()), unlockedOuterSlots: int() })
  .meta({ id: 'AvailableBuildings' });
export type AvailableBuildings = z.infer<typeof AvailableBuildings>;

export const BuildingUpgradeInfo = z
  .object({
    building: BuildingBean,
    info: BuildingDescription,
    effect: MessageSchema.nullable().describe('what the building gives at its current level (`buildingInfo.effect.*`); null when nothing measurable'),
    maxLevel: int(),
    next: BuildingLevelInfo.nullable().describe('null at max level'),
    demolishRefund: ResourceAmounts.nullable().describe(
      'what demolishing returns: BALANCE.demolishRefund of every level up to the current one (unrounded); null at level 0',
    ),
  })
  .meta({ id: 'BuildingUpgradeInfo' });
export type BuildingUpgradeInfo = z.infer<typeof BuildingUpgradeInfo>;

// ---- research ----

export const TechBean = z
  .object({
    typeId: int(),
    level: int(),
    maxLevel: int(),
    effectiveLevel: int().describe('level usable in this city (capped by the Academy level)'),
    upgrading: z.boolean(),
    castleId: int().nullable().describe('city researching the next level'),
    startTime: Ms.describe('0 when idle'),
    endTime: Ms.describe('0 when idle'),
    permission: z.boolean().describe('can be researched here now'),
    description: MessageSchema.describe('what the technology does (`techInfo.summary.*`), worded by the client'),
    effect: MessageSchema.nullable().describe('total effect at the effective level (`techInfo.effect.*`; null at 0 or when it has no measurable effect)'),
    nextEffect: MessageSchema.nullable().describe(
      'total effect after the next level (`techInfo.effect.*`; null at max level or when it has no measurable effect)',
    ),
    unlocks: z
      .array(
        z.object({
          kind: z.enum(['building', 'troop', 'tech']),
          id: int().describe('building type, troop or technology id'),
          level: int().describe('level of this technology required'),
        }),
      )
      .describe('buildings, troops and technologies that need this technology'),
    next: z
      .object({ time: int().describe('seconds'), requirements: z.array(RequirementCheck), ...costShape })
      .nullable()
      .describe('null at max level'),
  })
  .meta({ id: 'TechBean' });
export type TechBean = z.infer<typeof TechBean>;

export const ResearchList = z
  .object({
    academyLevel: int(),
    researching: int().nullable().describe('first tech being researched in this city'),
    researchingIds: z.array(int()).describe('every tech being researched in this city'),
    slots: int().describe('technologies this city can research at once'),
    techs: z.array(TechBean),
  })
  .meta({ id: 'ResearchList' });
export type ResearchList = z.infer<typeof ResearchList>;

export const ResearchStarted = z
  .object({ typeId: int(), level: int().describe('current level (the next one is being researched)'), startTime: Ms, endTime: Ms, castleId: int() })
  .meta({ id: 'ResearchStarted' });
export type ResearchStarted = z.infer<typeof ResearchStarted>;

export const ResearchSpeedupResult = z.object({ endTime: Ms }).meta({ id: 'ResearchSpeedupResult' });
export type ResearchSpeedupResult = z.infer<typeof ResearchSpeedupResult>;

// ---- troops & fortifications ----

export const TrainableUnit = z
  .object({
    typeId: int(),
    key: z.union([TroopKeySchema, FortKeySchema]).optional(),
    ...costShape,
    costShare: z.number().describe('(marchlands) share of the cost above actually paid (below 1 while a Quartermaster item runs)'),
    population: int().describe('per unit'),
    time: int().describe('seconds per unit'),
    requirements: z.array(RequirementCheck),
    permission: z.boolean(),
    description: MessageSchema.optional().describe('role and special battle rules (`troopInfo.*`), worded by the client'),
    stats: z.object({ life: int(), attack: int(), defense: int(), speed: int(), range: int(), load: int(), upkeep: int().describe('food per hour') }),
  })
  .meta({ id: 'TrainableUnit' });
export type TrainableUnit = z.infer<typeof TrainableUnit>;

export const TrainableList = z.array(TrainableUnit).meta({ id: 'TrainableList' });
export type TrainableList = z.infer<typeof TrainableList>;

export const ProduceBatch = z
  .object({
    queueId: int(),
    type: int().describe('troop / fortification type id'),
    num: int(),
    startTime: Ms.describe('0 while waiting'),
    endTime: Ms.describe('0 while waiting'),
    costTime: int().describe('seconds'),
  })
  .meta({ id: 'ProduceBatch' });
export type ProduceBatch = z.infer<typeof ProduceBatch>;

export const ProduceQueue = z
  .object({ positionId: int().describe('barracks position (-2 for the walls)'), allProduceQueue: z.array(ProduceBatch) })
  .meta({ id: 'ProduceQueue' });
export type ProduceQueue = z.infer<typeof ProduceQueue>;

export const BarracksQueues = z
  .object({ queues: z.array(ProduceQueue.extend({ capacity: int().describe('max batches (barracks level)') })) })
  .meta({ id: 'BarracksQueues' });
export type BarracksQueues = z.infer<typeof BarracksQueues>;

export const WallsQueues = z
  .object({
    queues: z.array(ProduceQueue),
    capacity: int().describe('max batches (walls level)'),
    wallSpace: z.object({ used: int(), max: int() }),
  })
  .meta({ id: 'WallsQueues' });
export type WallsQueues = z.infer<typeof WallsQueues>;

/** Troops answer BarracksQueues, fortifications WallsQueues. */
export const ProductionQueues = z.union([WallsQueues, BarracksQueues]).meta({ id: 'ProductionQueues' });
export type ProductionQueues = z.infer<typeof ProductionQueues>;
