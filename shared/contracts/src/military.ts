// Heroes, armies, map and valleys (backend/services/api/src/routes/military.ts).

import { z } from 'zod';
import { TileType } from '@marchlands/core';
import { zCityParams, zId, zIdValue, zResources, zTroops } from './common.ts';
import { ArmyBean, HeroBean } from './beans.ts';
import { TileRow } from './rows.ts';

// ---- requests ----

export const HeroParams = z.object({ heroId: zId });
export const TavernHireParams = zCityParams.extend({ heroId: zId });
export const HeroPointsBody = z.object({ power: z.number().int(), management: z.number().int(), stratagem: z.number().int() });
export const UseHeroItemBody = z.object({
  itemId: z.string(),
  payWith: z
    .enum(['gold'])
    .optional()
    .describe("'gold': buy the item with the hero's city gold even if one is owned (one not owned is always bought with gold)"),
});
export const RenameHeroBody = z.object({ name: z.string() });
export const HeroOrderBody = z.object({ heroIds: z.array(zId).max(100).describe("the city's heroes in the new order (first = top)") });
export const LockHeroBody = z.object({ locked: z.boolean().describe('a locked hero cannot be dismissed') });
export const HeroGearStatBody = z.object({ stat: z.enum(['power', 'management', 'stratagem']).describe("attribute the lord's gear boosts on this hero") });
export const GearPieceParams = z.object({ pieceId: z.string().describe('gear piece id (weapon, shield, …)') });
/** (marchlands) A lord's hero gear: piece level (Hero Enhancement research) and stars per piece. */
export const LordGear = z
  .object({
    level: z.number().int().describe("Hero Enhancement level = every piece's level"),
    stars: z.record(z.string(), z.number().int()).describe('piece id -> stars'),
  })
  .meta({ id: 'LordGear' });
export type LordGear = z.infer<typeof LordGear>;

export const ArmyParams = z.object({ armyId: zId });
export const SendArmyBody = z.object({
  targetTileId: zId,
  mission: z.number().int().min(1).max(5),
  troops: zTroops,
  resources: zResources.optional(),
  heroId: z.number().int().nullish(),
  restTime: z.number().int().min(0).optional().describe('seconds to camp before returning (0 = until recalled)'),
});
export const MarchEstimateBody = z.object({ targetTileId: zId, troops: zTroops });

export const TileParams = z.object({ tileId: zId });
export const MapQuery = z.object({ x1: z.coerce.number().int(), y1: z.coerce.number().int(), x2: z.coerce.number().int(), y2: z.coerce.number().int() });
export const MapSearchQuery = z.object({
  x: z.coerce.number().int(),
  y: z.coerce.number().int(),
  radius: z.coerce.number().int().default(10),
  type: z.coerce.number().int(),
});

// ---- heroes ----

export const CityHeroList = z
  .object({ heroes: z.array(HeroBean).describe('hired heroes and captives held'), slots: z.number().int().describe('Feasting Hall capacity') })
  .meta({ id: 'CityHeroList' });
export type CityHeroList = z.infer<typeof CityHeroList>;

export const TavernOffers = z
  .object({
    posCount: z.number().int().describe('free hero slots'),
    heros: z.array(HeroBean),
    refreshCost: z.number().int().describe('gold to re-roll the offers'),
  })
  .meta({ id: 'TavernOffers' });
export type TavernOffers = z.infer<typeof TavernOffers>;

// ---- armies ----

export const VisibleArmies = z
  .object({
    self: z.array(ArmyBean),
    friend: z.array(ArmyBean).describe('other lords stationed at or reinforcing/transporting to me'),
    enemy: z.array(ArmyBean).describe('hostile armies heading for me (troops need a Beacon Tower)'),
  })
  .meta({ id: 'VisibleArmies' });
export type VisibleArmies = z.infer<typeof VisibleArmies>;

export const StationedArmyList = z.array(ArmyBean).meta({ id: 'StationedArmyList' });
export type StationedArmyList = z.infer<typeof StationedArmyList>;

export const TroopParams = z
  .object({
    marchSkillParam: z.number().describe('Compass march speed bonus, a share'),
    loadSkillParam: z.number().describe('Logistics load bonus, a share'),
    driveSkillParam: z.number().describe('Horseback Riding march speed bonus, a share'),
    transportStationParam: z.number().int().describe('Relief Station speed multiplier between own cities'),
    maxArmies: z.number().int(),
    maxTroops: z.number().int().describe('troops one army may hold (Rally Spot level x 10,000, +25% with a War Ensign)'),
  })
  .meta({ id: 'TroopParams' });
export type TroopParams = z.infer<typeof TroopParams>;

export const MarchEstimate = z
  .object({ marchTime: z.number().int().describe('milliseconds'), load: z.number().int().describe('carry capacity') })
  .meta({ id: 'MarchEstimate' });
export type MarchEstimate = z.infer<typeof MarchEstimate>;

// ---- map ----

const MapPermissions = z.object({ canLoot: z.boolean(), canOccupy: z.boolean(), canScout: z.boolean(), canSend: z.boolean(), canTrans: z.boolean() });
const relation = z.number().int().describe('Relation: 0 alliance, 1 ally, 2 neutral, 3 enemy, 4 none, 5 self');

/** A player castle or barbarian (NPC) city on the map. Player fields are absent for NPC cities. */
export const MapCastle = z
  .object({
    id: z.number().int().describe('tile id'),
    x: z.number().int(),
    y: z.number().int(),
    name: z.string().optional().describe("the city's name; absent for a barbarian city (named by the client from its tile type)"),
    npc: z.boolean(),
    level: z.number().int(),
    cityId: z.number().int().optional(),
    playerId: z.number().int().optional(),
    userName: z.string().optional(),
    prestige: z.number().int().optional(),
    honor: z.number().int().optional(),
    flag: z.string().optional(),
    allianceName: z.string().optional(),
    playerLogoUrl: z.string().optional(),
    relation: relation.optional(),
    state: z.number().int().optional().describe('player status'),
    furlough: z.boolean().optional().describe('beginner protection'),
    zoneId: z.number().int().describe('zone (state) id; the client names it'),
  })
  .extend(MapPermissions.shape)
  .meta({ id: 'MapCastle' });
export type MapCastle = z.infer<typeof MapCastle>;

export const MapHeldValley = TileRow.pick({ id: true, type: true, level: true })
  .extend({
    x: z.number().int(),
    y: z.number().int(),
    cityId: z.number().int(),
    cityName: z.string(),
    playerId: z.number().int(),
    userName: z.string(),
    allianceName: z.string().describe("'' when not in an alliance"),
    relation,
  })
  .meta({ id: 'MapHeldValley' });
export type MapHeldValley = z.infer<typeof MapHeldValley>;

export const MapView = z
  .object({
    x1: z.number().int(),
    y1: z.number().int(),
    x2: z.number().int(),
    y2: z.number().int(),
    mapStr: z.string().describe('two hex chars per tile (type, level), row-major'),
    castles: z.array(MapCastle),
    valleys: z.array(MapHeldValley).describe("valleys in view that a city holds (the viewer's included)"),
  })
  .meta({ id: 'MapView' });
export type MapView = z.infer<typeof MapView>;

export const MapTileOwner = z
  .object({ cityId: z.number().int(), cityName: z.string(), playerId: z.number().int(), userName: z.string() })
  .meta({ id: 'MapTileOwner' });
export type MapTileOwner = z.infer<typeof MapTileOwner>;

/** Valley, flat or barbarian city tile. */
export const MapFieldTileInfo = TileRow.pick({ id: true, type: true, level: true })
  .extend({
    x: z.number().int(),
    y: z.number().int(),
    zoneId: z.number().int().describe('zone (state) id; the client names it'),
    npc: z.boolean(),
    owner: MapTileOwner.nullable().describe('controlling city of an occupied valley / captured NPC city'),
    relation,
    upgradeCost: z.number().nullable().describe('gold to raise this unowned valley one level (null: not upgradable)'),
  })
  .extend(MapPermissions.shape)
  .meta({ id: 'MapFieldTileInfo' });
export type MapFieldTileInfo = z.infer<typeof MapFieldTileInfo>;

/** Player castle tile. */
export const MapFieldCastleInfo = MapCastle.extend({ type: z.literal(TileType.CASTLE) }).meta({ id: 'MapFieldCastleInfo' });
export type MapFieldCastleInfo = z.infer<typeof MapFieldCastleInfo>;

export const MapFieldInfo = z.union([MapFieldTileInfo, MapFieldCastleInfo]).meta({ id: 'MapFieldInfo' });
export type MapFieldInfo = z.infer<typeof MapFieldInfo>;

export const MapSearchResult = z
  .array(TileRow.pick({ id: true, type: true, level: true, ownerCityId: true, cityId: true }).extend({ x: z.number().int(), y: z.number().int() }))
  .meta({ id: 'MapSearchResult' });
export type MapSearchResult = z.infer<typeof MapSearchResult>;

export const ValleyUpgradeBody = z.object({ cityId: zIdValue.describe('city that pays the gold') });
export const ValleyUpgradeResult = z
  .object({ tileId: z.number().int(), level: z.number().int(), gold: z.number().describe('gold paid'), nextCost: z.number().nullable() })
  .meta({ id: 'ValleyUpgradeResult' });
export type ValleyUpgradeResult = z.infer<typeof ValleyUpgradeResult>;
