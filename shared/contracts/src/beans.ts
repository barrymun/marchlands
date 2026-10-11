// Shared client-facing shapes ("beans" of the original protocol), built by
// backend/packages/game/src/dto.ts and reused across many endpoints and pushes.

import { z } from 'zod';
import { BUFF_IDS, BuildingStateSchema, HERO_BUFF_IDS, MessageSchema } from '@marchlands/core';
import { FortBean, Ms, ResourceAmounts, TroopBean } from './common.ts';
import { ArmyRow, HeroRow, PlayerRow, TileRow } from './rows.ts';

export const BuildingBean = BuildingStateSchema.extend({}).meta({ id: 'BuildingBean' });
export type BuildingBean = z.infer<typeof BuildingBean>;

export const HeroBean = HeroRow.pick({
  id: true,
  name: true,
  logoUrl: true,
  status: true,
  level: true,
  upgradeExp: true,
  loyalty: true,
  power: true,
  management: true,
  stratagem: true,
  powerAdded: true,
  managementAdded: true,
  stratagemAdded: true,
  powerBuffAdded: true,
  managementBuffAdded: true,
  stratagemBuffAdded: true,
  remainPoint: true,
  basePower: true,
  baseManagement: true,
  baseStratagem: true,
  cityId: true,
  locked: true,
})
  .extend({
    experience: z.number().int(),
    seized: z.boolean().describe('held captive by another lord'),
    gearStat: z.enum(['power', 'management', 'stratagem']).describe("(marchlands) attribute the lord's gear boosts on this hero"),
    buffs: z
      .array(
        z.object({
          id: z.enum(HERO_BUFF_IDS),
          desc: MessageSchema.describe('what the boost does (`buff.*`), worded by the client'),
          endTime: Ms,
          param: z.number().optional().describe('points added'),
        }),
      )
      .describe('active attribute boosts (24 real hours each, unaffected by GAME_SPEED)'),
  })
  .meta({ id: 'HeroBean' });
export type HeroBean = z.infer<typeof HeroBean>;

export const ResourceLine = z
  .object({
    amount: z.number().int(),
    max: z.number(),
    storePercent: z.number(),
    workRate: z.number(),
    workPeople: z.number(),
    increaseRate: z.number().describe('net change per game hour (food is after troop upkeep), 2 decimals'),
    bonus: z.number().describe('production bonus as a share (0.25 = +25%)'),
    breakdown: z
      .object({
        base: z.number().int().describe('flat output per hour, regardless of fields'),
        fields: z.number().int().describe('field output per hour after work rate and labour efficiency'),
        tech: z.number().int().describe('from Agriculture / Lumbering / Masonry / Mining'),
        mayor: z.number().int().describe("from the mayor's politics"),
        valley: z.number().int().describe('from occupied valleys'),
        buff: z.number().int().describe('from production items'),
        upkeep: z.number().describe('troop food upkeep per game hour (negative; 0 for other resources), 2 decimals'),
        tax: z.number().describe('(marchlands) output the tax rate sells to the merchant per game hour (negative), 2 decimals'),
        techBonus: z.number().describe('bonus share from research'),
        mayorBonus: z.number().describe("bonus share from the mayor's politics"),
        valleyBonus: z.number().describe('bonus share from occupied valleys'),
        buffBonus: z.number().describe('bonus share from production items'),
      })
      .meta({ id: 'ProductionSources', description: 'per-hour amounts by source; they sum to increaseRate (up to rounding)' }),
  })
  .meta({ id: 'ResourceLine' });
export type ResourceLine = z.infer<typeof ResourceLine>;

export const ResourceBean = z
  .object({
    gold: z.number().int(),
    goldRate: z.number().describe('net gold per game hour, 2 decimals'),
    food: ResourceLine,
    wood: ResourceLine,
    stone: ResourceLine,
    iron: ResourceLine,
    taxRate: z.number().int().describe('(marchlands) share of field output sold to the merchant as it is produced'),
    taxIncome: z.number().int().describe('gold per game hour: the base tax on population plus taxConverted'),
    taxConverted: z.number().int().describe('(marchlands) gold per game hour the tax rate earns from field output'),
    taxItemBonus: z.number().int().describe('gold per game hour the Gold Production item adds to the base tax (part of taxIncome)'),
    taxItemShare: z.number().describe('that item bonus, as a share of the base tax (0.25 = +25%)'),
    herosSalary: z.number(),
    troopCostFood: z.number().describe('troop food upkeep per game hour, 2 decimals'),
    curPopulation: z.number().int(),
    maxPopulation: z.number(),
    idlePopulation: z.number(),
    workPeople: z.number(),
    efficiency: z.number().describe('labour efficiency as a share (1: every field fully staffed)'),
    populationDirection: z.number().int(),
    updatedAt: Ms,
  })
  .meta({ id: 'ResourceBean' });
export type ResourceBean = z.infer<typeof ResourceBean>;

export const ValleyBean = TileRow.pick({ id: true, type: true, level: true, ownerCityId: true })
  .extend({ x: z.number().int(), y: z.number().int() })
  .meta({ id: 'ValleyBean' });
export type ValleyBean = z.infer<typeof ValleyBean>;

export const CityBean = z
  .object({
    id: z.number().int(),
    name: z.string(),
    logoUrl: z.string(),
    fieldId: z.number().int().describe('tile id'),
    x: z.number().int(),
    y: z.number().int(),
    zoneId: z.number().int().describe('zone (state) id; the client names it'),
    status: z.number().int(),
    allowAlliance: z.boolean(),
    goOutForBattle: z.boolean(),
    resource: ResourceBean,
    buildings: z.array(BuildingBean),
    troop: TroopBean,
    injuredTroop: TroopBean,
    fortification: FortBean,
    heros: z.array(HeroBean),
    fields: z.array(ValleyBean),
    createdAt: Ms,
  })
  .meta({ id: 'CityBean' });
export type CityBean = z.infer<typeof CityBean>;

export const PlayerInfo = PlayerRow.pick({ id: true, sex: true, flag: true, faceUrl: true, beginner: true, status: true, allianceId: true })
  .extend({
    userName: z.string(),
    prestige: z.number().int(),
    honor: z.number().int(),
    titleId: z.number().int().describe('nobility title (named by the client)'),
    ranking: z.number().int(),
    honorRank: z.number().int(),
    alliance: z.string(),
    levelId: z.number().int().describe('alliance rank'),
    castleCount: z.number().int(),
    population: z.number(),
    changedFace: z.boolean(),
    createrTime: Ms,
    lastLoginTime: Ms,
  })
  .meta({ id: 'PlayerInfo' });
export type PlayerInfo = z.infer<typeof PlayerInfo>;

export const ItemCount = z.object({ id: z.string(), count: z.number().int() }).meta({ id: 'ItemCount' });
export type ItemCount = z.infer<typeof ItemCount>;

export const BuffBean = z
  .object({
    id: z.enum(BUFF_IDS),
    desc: MessageSchema.describe('what the buff does (`buff.*`), worded by the client'),
    endTime: Ms,
    param: z.number().optional(),
    cityId: z.number().int().optional(),
    itemId: z.string().optional().describe('(marchlands) the item last used to set or extend it'),
  })
  .meta({ id: 'BuffBean' });
export type BuffBean = z.infer<typeof BuffBean>;

export const ArmyBean = ArmyRow.pick({
  playerId: true,
  cityId: true,
  heroId: true,
  startTime: true,
  reachTime: true,
  restTime: true,
  startPosName: true,
  targetPosName: true,
})
  .extend({
    armyId: z.number().int(),
    king: z.string(),
    hero: z.string(),
    heroLevel: z.number().int(),
    missionType: z.number().int(),
    direction: z.number().int(),
    startFieldId: z.number().int(),
    targetFieldId: z.number().int(),
    troop: TroopBean.nullable().describe('null when hidden (enemy army without Beacon Tower)'),
    resource: ResourceAmounts.nullable(),
  })
  .meta({ id: 'ArmyBean' });
export type ArmyBean = z.infer<typeof ArmyBean>;
