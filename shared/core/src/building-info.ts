// Player-facing building descriptions, as messages (area `buildingInfo`, worded by the client). Each effect mirrors
// the rule that uses the building (economy, construction, training, heroes, armies, market, alliance), with numbers
// from BALANCE, so the text follows the rules. "Unlocks" is derived from the requirement data.

import { BALANCE, getGameSpeed } from '#/balance.ts';
import { wallHitPoints } from '#/battle/simulator.ts';
import { type BasicResource, BuildingType, FortType, ResourceKey, UnlockKind } from '#/constants.ts';
import { isFortType, unlockedOuterSlots } from '#/construction.ts';
import { buildingConfig, BUILDINGS, RESEARCH, TROOPS } from '#/data/index.ts';
import { fieldFactorAt } from '#/economy.ts';
import { innHeroMaxLevel, innOffers } from '#/heroes.ts';
import { ItemId } from '#/item-ids.ts';
import { type Message, msg, ref, share } from '#/messages/index.ts';
import { reliefMultiplier } from '#/troops.ts';

const F = (l: number) => fieldFactorAt(l);
/** the item that lets armies hold more troops (BALANCE.imperialBannerTroopBonus) */
const IMPERIAL_BANNER = ItemId.IMPERIAL_BANNER;

interface BuildingText {
  summary: () => Message;
  /** what the building gives at `level` (level > 0) */
  effect?: (level: number) => Message;
}

const field = (resource: BasicResource): BuildingText => ({
  summary: () => msg('buildingInfo.summary.field', { resource: ref.resource(resource) }),
  effect: (l) =>
    msg('buildingInfo.effect.field', {
      resource: ref.resource(resource),
      amount: BALANCE.fieldProductionPerF * F(l) * getGameSpeed(),
      storage: BALANCE.fieldStoragePerF * F(l) * BALANCE.storageMultiplier,
      count: BALANCE.fieldWorkersPerF * F(l),
    }),
});

const prerequisite: BuildingText = { summary: () => msg('buildingInfo.summary.prerequisite') };

const TEXT: Record<number, BuildingText> = {
  [BuildingType.TOWN_HALL]: {
    summary: () =>
      msg('buildingInfo.summary.townHall', {
        count: BALANCE.outerSlotsPerTownHall,
        base: BALANCE.outerSlotsBase,
        level: BALANCE.beginnerTownHallLevel,
        building: ref.building(BuildingType.TOWN_HALL),
      }),
    effect: (l) => msg('buildingInfo.effect.townHall', { slots: unlockedOuterSlots(l), count: l }),
  },
  [BuildingType.WALLS]: {
    summary: () => msg('buildingInfo.summary.walls', { forts: Object.values(FortType).map((id) => ref.troop(id)), tower: ref.troop(FortType.ARCHER_TOWER) }),
    effect: (l) =>
      msg('buildingInfo.effect.walls', {
        space: BALANCE.wallSpace[l] ?? 0,
        count: l,
        hitPoints: wallHitPoints(l),
        percent: share((l * BALANCE.battle.wallTowerRangePct) / 100),
      }),
  },
  [BuildingType.COTTAGE]: {
    summary: () => msg('buildingInfo.summary.cottage'),
    effect: (l) => msg('buildingInfo.effect.cottage', { population: BALANCE.cottagePopulation[l] ?? 0 }),
  },
  [BuildingType.FARM]: field(ResourceKey.FOOD),
  [BuildingType.SAWMILL]: field(ResourceKey.WOOD),
  [BuildingType.QUARRY]: field(ResourceKey.STONE),
  [BuildingType.IRONMINE]: field(ResourceKey.IRON),
  [BuildingType.WAREHOUSE]: {
    summary: () => msg('buildingInfo.summary.warehouse'),
    effect: (l) => msg('buildingInfo.effect.warehouse', { amount: BALANCE.warehouseProtectPerLevel[l] ?? 0 }),
  },
  [BuildingType.BARRACKS]: {
    summary: () => msg('buildingInfo.summary.barracks'),
    effect: (l) => msg('buildingInfo.effect.barracks', { count: l }),
  },
  [BuildingType.ACADEMY]: {
    summary: () => msg('buildingInfo.summary.academy', { queues: BALANCE.researchQueues, building: ref.building(BuildingType.ACADEMY) }),
    effect: (l) => msg('buildingInfo.effect.academy', { level: l }),
  },
  [BuildingType.INN]: {
    summary: () => msg('buildingInfo.summary.inn', { gold: BALANCE.tavernRefreshGoldPerInnLevel }),
    effect: (l) => msg('buildingInfo.effect.inn', { count: innOffers(l), level: innHeroMaxLevel(l) }),
  },
  [BuildingType.FEASTING_HALL]: {
    summary: () => msg('buildingInfo.summary.feastingHall'),
    effect: (l) => msg('buildingInfo.effect.feastingHall', { count: l }),
  },
  [BuildingType.RALLY_SPOT]: {
    summary: () =>
      msg('buildingInfo.summary.rallySpot', {
        count: BALANCE.rallySpotArmiesPerLevel,
        troops: BALANCE.rallySpotTroopsPerLevel,
        item: ref.item(IMPERIAL_BANNER),
        percent: share(BALANCE.imperialBannerTroopBonus),
      }),
    effect: (l) => msg('buildingInfo.effect.rallySpot', { count: l * BALANCE.rallySpotArmiesPerLevel, troops: l * BALANCE.rallySpotTroopsPerLevel }),
  },
  [BuildingType.MARKETPLACE]: {
    summary: () => msg('buildingInfo.summary.marketplace', { count: BALANCE.marketMaxOrdersPerLevel }),
    effect: (l) => msg('buildingInfo.effect.marketplace', { count: l * BALANCE.marketMaxOrdersPerLevel }),
  },
  [BuildingType.RELIEF_STATION]: {
    summary: () => msg('buildingInfo.summary.reliefStation'),
    effect: (l) =>
      msg('buildingInfo.effect.reliefStation', {
        multiplier: reliefMultiplier([{ positionId: 0, typeId: BuildingType.RELIEF_STATION, level: l, status: 0, startTime: 0, endTime: 0 }]),
      }),
  },
  [BuildingType.BEACON_TOWER]: {
    summary: () => msg('buildingInfo.summary.beaconTower'),
    effect: (l) => (l >= 2 ? msg('buildingInfo.effect.beaconHeroes') : msg('buildingInfo.effect.beaconTroops')),
  },
  [BuildingType.EMBASSY]: { summary: () => msg('buildingInfo.summary.embassy') },
  [BuildingType.STABLE]: prerequisite,
  [BuildingType.FORGE]: prerequisite,
  [BuildingType.WORKSHOP]: prerequisite,
};

/** Something that needs a building or technology: a building type, troop or technology id and the level it needs. */
export interface Unlock {
  kind: UnlockKind;
  id: number;
  level: number;
}

export interface BuildingInfo {
  typeId: number;
  /** what the building does (null for an unknown type) */
  summary: Message | null;
  /** where it can be built and how many (null for an unknown type) */
  placement: Message | null;
  /** buildings, troops and technologies that require this building, with the level they need */
  unlocks: Unlock[];
}

const KIND_ORDER: Record<UnlockKind, number> = { [UnlockKind.BUILDING]: 0, [UnlockKind.TROOP]: 1, [UnlockKind.TECH]: 2 };

function unlocksOf(typeId: number): Unlock[] {
  const out = new Map<string, Unlock>();
  const add = (kind: UnlockKind, id: number, level: number) => {
    const key = `${kind}:${id}`;
    const prev = out.get(key);
    if (!prev || level < prev.level) out.set(key, { kind, id, level });
  };
  // fortifications share the building data but are troops: they are listed from TROOPS
  for (const b of BUILDINGS)
    for (const r of b.requires.buildings)
      if (r.id === typeId && b.typeId !== typeId && b.level === 1 && !isFortType(b.typeId)) add(UnlockKind.BUILDING, b.typeId, r.level);
  for (const t of TROOPS) for (const r of t.requires.buildings) if (r.id === typeId) add(UnlockKind.TROOP, t.troopId, r.level);
  for (const t of RESEARCH) for (const r of t.requires.buildings) if (r.id === typeId && t.level === 1) add(UnlockKind.TECH, t.techId, r.level);
  return [...out.values()].sort((a, b) => a.level - b.level || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.id - b.id);
}

const FIELDS: number[] = [BuildingType.FARM, BuildingType.SAWMILL, BuildingType.QUARRY, BuildingType.IRONMINE];

function placementOf(typeId: number): Message | null {
  if (typeId === BuildingType.TOWN_HALL || typeId === BuildingType.WALLS) return msg('buildingInfo.placement.unique');
  const cfg = buildingConfig(typeId, 1);
  if (!cfg || isFortType(typeId)) return null; // fortifications are built at the walls, not in slots
  const outside = FIELDS.includes(typeId);
  if (cfg.limit > 0)
    return outside ? msg('buildingInfo.placement.outsideLimited', { limit: cfg.limit }) : msg('buildingInfo.placement.insideLimited', { limit: cfg.limit });
  return outside ? msg('buildingInfo.placement.outside') : msg('buildingInfo.placement.inside');
}

export function buildingInfo(typeId: number): BuildingInfo {
  return {
    typeId,
    summary: TEXT[typeId]?.summary() ?? null,
    placement: placementOf(typeId),
    unlocks: unlocksOf(typeId),
  };
}

/** What a building gives at `level` (null when it has no measurable effect). */
export function buildingEffect(typeId: number, level: number): Message | null {
  if (level <= 0) return null;
  return TEXT[typeId]?.effect?.(level) ?? null;
}
