// Buildings, research and troop/fort production rules (pure). Port of pcastle/ptech/ptroop/
// pfortifications logic with the original's validation gaps closed.

import { z } from 'zod';
import { BALANCE, scaled } from './balance.ts';
import { BuildingType, FORT_KEYS, FortType, TechType, TROOP_ID_BY_KEY, TROOP_KEYS, TroopType } from './constants.ts';
import { buildingConfig, buildingMaxLevel, itemConfig, ITEMS, researchConfig, researchMaxLevel, troopConfig, type Requirements } from './data/index.ts';
import { buildingCount, buildingLevel, researchLevel, type MayorStats } from './economy.ts';
import { GameError } from './errors.ts';
import { addResources, emptyResources, scaleResources, type Resources } from './resources.ts';
import type { BuildingState, FortCounts, ItemCounts, ResearchState, TrainBatch } from './types.ts';

// ---------------------------------------------------------------------------------------------
// Slots
// ---------------------------------------------------------------------------------------------

export const TOWN_HALL_POSITION = -1;
export const WALLS_POSITION = -2;
export const INNER_POSITIONS = { min: 0, max: 31 } as const;
export const OUTER_POSITIONS = { min: 1001, max: 1040 } as const;

export const FIELD_TYPES: readonly number[] = [BuildingType.FARM, BuildingType.SAWMILL, BuildingType.QUARRY, BuildingType.IRONMINE];

export function isOuterPosition(pos: number): boolean {
  return pos >= OUTER_POSITIONS.min && pos <= OUTER_POSITIONS.max;
}
export function isInnerPosition(pos: number): boolean {
  return pos >= INNER_POSITIONS.min && pos <= INNER_POSITIONS.max;
}
export function isValidPosition(pos: number): boolean {
  return pos === TOWN_HALL_POSITION || pos === WALLS_POSITION || isInnerPosition(pos) || isOuterPosition(pos);
}

/** Number of field slots unlocked outside the walls (10 + 3 per Town Hall level). */
export function unlockedOuterSlots(townHallLevel: number): number {
  return Math.min(40, BALANCE.outerSlotsBase + BALANCE.outerSlotsPerTownHall * townHallLevel);
}

/** Which building types may stand on a position. */
export function canPlace(typeId: number, pos: number): boolean {
  if (typeId === BuildingType.TOWN_HALL) return pos === TOWN_HALL_POSITION;
  if (typeId === BuildingType.WALLS) return pos === WALLS_POSITION;
  if (FIELD_TYPES.includes(typeId)) return isOuterPosition(pos);
  return isInnerPosition(pos);
}

export function findBuilding(buildings: BuildingState[], pos: number): BuildingState | undefined {
  return buildings.find((b) => b.positionId === pos);
}

/** true when no construction slot is free (orig: one at a time, -48; see BALANCE.buildQueues). */
export function isConstructing(buildings: BuildingState[], maxConcurrent = 1): boolean {
  return buildings.filter((b) => b.status !== 0).length >= maxConcurrent;
}

// ---------------------------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------------------------

export const RequirementCheckSchema = z.object({
  kind: z.enum(['building', 'tech', 'item']),
  id: z.union([z.number().int(), z.string()]).describe('building type / tech id, or item id string'),
  required: z.number().int().describe('level (or item count) required'),
  current: z.number().int(),
  ok: z.boolean(),
});
export type RequirementCheck = z.infer<typeof RequirementCheckSchema>;

/** Legacy config references items by config row id; map to the item id string. */
function itemIdFromLegacy(legacyId: number): string | undefined {
  return ITEMS.find((i) => i.legacyId === legacyId)?.id;
}

export function checkRequirements(req: Requirements, buildings: BuildingState[], research: ResearchState, items: ItemCounts): RequirementCheck[] {
  const out: RequirementCheck[] = [];
  for (const b of req.buildings) {
    const cur = buildingLevel(buildings, b.id);
    out.push({ kind: 'building', id: b.id, required: b.level, current: cur, ok: cur >= b.level });
  }
  for (const t of req.techs) {
    const cur = researchLevel(research, t.id);
    out.push({ kind: 'tech', id: t.id, required: t.level, current: cur, ok: cur >= t.level });
  }
  for (const i of req.items) {
    const id = itemIdFromLegacy(i.id) ?? String(i.id);
    const cur = items[id] ?? 0;
    out.push({ kind: 'item', id, required: i.level, current: cur, ok: cur >= i.level });
  }
  return out;
}

export const requirementsMet = (checks: RequirementCheck[]) => checks.every((c) => c.ok);

// ---------------------------------------------------------------------------------------------
// Timing (all return ms, already scaled by game speed)
// ---------------------------------------------------------------------------------------------

/** Time multiplier from a mayor attribute: ×heroTimeFactor per point, never below `floor` (BALANCE.heroTimeFloor). */
export const heroTimeMultiplier = (attr: number | undefined, floor: number | null = null) => Math.max(floor ?? 0, Math.pow(BALANCE.heroTimeFactor, attr ?? 0));
const heroFactor = heroTimeMultiplier;
const techFactor = (level: number) => Math.pow(BALANCE.techTimeFactor, level);

/** Construction/upgrade time to reach `targetLevel`: mayor management + Construction (orig §3.1); (evony-re) the mayor's cut is floored at BALANCE.heroTimeFloor.building. */
export function buildTimeMs(typeId: number, targetLevel: number, mayor: MayorStats | null, research: ResearchState): number {
  const cfg = buildingConfig(typeId, targetLevel);
  if (!cfg) throw new GameError('Invalid building.', -99);
  const seconds = cfg.buildTime * heroFactor(mayor?.management, BALANCE.heroTimeFloor.building) * techFactor(researchLevel(research, TechType.CONSTRUCTION));
  return scaled(Math.floor(seconds) * 1000);
}

/** (evony-re) Resources a full demolition returns: BALANCE.demolishRefund of the cost of every level up to `level`. */
export function fullDemolishRefund(typeId: number, level: number): Resources {
  let total = emptyResources();
  for (let l = 1; l <= level; l++) total = addResources(total, buildingConfig(typeId, l)?.cost ?? {});
  return scaleResources(total, BALANCE.demolishRefund);
}

/** Demolishing one level takes half the time it took to build it (orig §3.2). */
export function demolishTimeMs(typeId: number, currentLevel: number, mayor: MayorStats | null, research: ResearchState): number {
  const cfg = buildingConfig(typeId, currentLevel);
  if (!cfg) throw new GameError('Invalid building.', -99);
  const seconds =
    (cfg.buildTime / 2) * heroFactor(mayor?.management, BALANCE.heroTimeFloor.building) * techFactor(researchLevel(research, TechType.CONSTRUCTION));
  return scaled(Math.floor(seconds) * 1000);
}

/** Research time: mayor stratagem only (orig §3.3); (evony-re) never below BALANCE.heroTimeFloor.research. */
export function researchTimeMs(techId: number, targetLevel: number, mayor: MayorStats | null): number {
  const cfg = researchConfig(techId, targetLevel);
  if (!cfg) throw new GameError('Invalid technology.', -99);
  return scaled(Math.floor(cfg.buildTime * heroFactor(mayor?.stratagem, BALANCE.heroTimeFloor.research)) * 1000);
}

const SIEGE: readonly number[] = [TroopType.CATAPULT, TroopType.RAM, TroopType.TRANSPORTER, TroopType.BALLISTA];

/** Per-unit training seconds (displayed formula of the original, without its fall-through bug). */
export function troopUnitSeconds(troopId: number, mayor: MayorStats | null, research: ResearchState): number {
  const cfg = troopConfig(troopId);
  if (!cfg) throw new GameError('Invalid troop type.', -99);
  if (cfg.inside === 2) {
    return Math.floor(cfg.buildTime * heroFactor(mayor?.management) * techFactor(researchLevel(research, TechType.CONSTRUCTION)));
  }
  const tech = SIEGE.includes(troopId) ? TechType.METAL_CASTING : TechType.MILITARY_SCIENCE;
  return Math.floor(cfg.buildTime * heroFactor(mayor?.power) * techFactor(researchLevel(research, tech)));
}

export function trainBatchMs(troopId: number, count: number, mayor: MayorStats | null, research: ResearchState): number {
  return scaled(Math.max(BALANCE.minTrainUnitSeconds, troopUnitSeconds(troopId, mayor, research)) * count * 1000);
}

// ---------------------------------------------------------------------------------------------
// Validation helpers used by services
// ---------------------------------------------------------------------------------------------

export function buildCost(typeId: number, targetLevel: number): Resources {
  const cfg = buildingConfig(typeId, targetLevel);
  if (!cfg) throw new GameError('Invalid building.', -99);
  return { ...cfg.cost };
}

export function researchCost(techId: number, targetLevel: number): Resources {
  const cfg = researchConfig(techId, targetLevel);
  if (!cfg) throw new GameError('Invalid technology.', -99);
  return { ...cfg.cost };
}

/** (evony-re) Most units of a troop type the city can pay for now: resources and idle population. */
export function maxTrainableCount(troopId: number, have: Partial<Resources>, idlePopulation: number): number {
  const cfg = troopConfig(troopId);
  if (!cfg) return 0;
  let max = Infinity;
  for (const [k, cost] of Object.entries(cfg.cost) as [keyof Resources, number][]) if (cost > 0) max = Math.min(max, Math.floor((have[k] ?? 0) / cost));
  if (cfg.population > 0) max = Math.min(max, Math.floor(idlePopulation / cfg.population));
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

export function trainCost(troopId: number, count: number): Resources {
  const cfg = troopConfig(troopId);
  if (!cfg) throw new GameError('Invalid troop type.', -99);
  return scaleResources(cfg.cost, count);
}

export interface NewBuildingCheck {
  typeId: number;
  positionId: number;
  buildings: BuildingState[];
  research: ResearchState;
  items: ItemCounts;
  maxConcurrent?: number;
}

/** Throws a GameError when a new building may not be placed. Mirrors castle.newBuilding. */
export function assertCanConstruct({ typeId, positionId, buildings, research, items, maxConcurrent = 1 }: NewBuildingCheck): void {
  if (!isValidPosition(positionId)) throw new GameError('Position invalid.', -99);
  const cfg = buildingConfig(typeId, 1);
  if (!cfg || cfg.inside === 3) throw new GameError("Can't build building.", -99);
  if (!canPlace(typeId, positionId)) throw new GameError("Can't build building here.", -99);
  if (findBuilding(buildings, positionId)) throw new GameError("Can't build building.", -99);
  if (cfg.limit > 0 && buildingCount(buildings, typeId) >= cfg.limit) throw new GameError("Can't build building.", -99);
  if (isOuterPosition(positionId)) {
    const th = buildingLevel(buildings, BuildingType.TOWN_HALL);
    if (positionId - 1000 > unlockedOuterSlots(th)) throw new GameError('Out of bounds.', -99);
  }
  if (isConstructing(buildings, maxConcurrent)) throw new GameError('All construction queues are busy.', -48);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError('Building Prerequisites not met.', -99);
  }
}

export function assertCanUpgrade(b: BuildingState | undefined, buildings: BuildingState[], research: ResearchState, items: ItemCounts, maxConcurrent = 1) {
  if (!b) throw new GameError('Building not found.', -99, 404);
  if (b.status !== 0) {
    throw new GameError(
      'Invalid building status: Your network connection might have experienced delay or congestion. If this error message persists, please refresh or reload this page to login to the game again.',
      -45,
    );
  }
  if (isConstructing(buildings, maxConcurrent)) throw new GameError('All construction queues are busy.', -48);
  if (b.level >= buildingMaxLevel(b.typeId)) throw new GameError('Building is already at its maximum level.', -99);
  const cfg = buildingConfig(b.typeId, b.level + 1);
  if (!cfg) throw new GameError('Building Prerequisites not met.', -99);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError('Building Prerequisites not met.', -99);
  }
}

export function assertCanResearch(techId: number, buildings: BuildingState[], research: ResearchState, items: ItemCounts) {
  const level = researchLevel(research, techId);
  if (level >= researchMaxLevel(techId)) throw new GameError('Invalid technology.', -99);
  const cfg = researchConfig(techId, level + 1);
  if (!cfg) throw new GameError('Invalid technology.', -99);
  if (buildingLevel(buildings, BuildingType.ACADEMY) < 1) throw new GameError('You need an Academy to research.', -99);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError('Research Prerequisites not met.', -99);
  }
}

export function assertCanTrain(troopId: number, count: number, buildings: BuildingState[], research: ResearchState, items: ItemCounts, fort: boolean) {
  if (!Number.isInteger(count) || count < 1) throw new GameError('Invalid amount.', -99);
  const cfg = troopConfig(troopId);
  if (!cfg || cfg.inside !== (fort ? 2 : 1)) throw new GameError('Invalid troop type.', -99);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError('Prerequisites not met.', -99);
  }
}

/** Wall space used by fortifications (built and queued). */
export function usedWallSpace(forts: FortCounts, queue: TrainBatch[]): number {
  let used = 0;
  for (const [id, key] of Object.entries(FORT_KEYS)) used += (forts[key] ?? 0) * (BALANCE.fortSpace[Number(id)] ?? 1);
  for (const b of queue) used += b.count * (BALANCE.fortSpace[b.troopId] ?? 1);
  return used;
}

export function wallCapacity(buildings: BuildingState[]): number {
  return BALANCE.wallSpace[buildingLevel(buildings, BuildingType.WALLS)] ?? 0;
}

export const isFortType = (id: number) => id >= FortType.TRAP && id <= FortType.TREBUCHET;
export const isTroopType = (id: number) => id in TROOP_KEYS;

// ---------------------------------------------------------------------------------------------
// Prestige (orig GetPrestigeOfAction)
// ---------------------------------------------------------------------------------------------

const PRESTIGE_RESEARCH: Record<number, number> = { 1: 52, 2: 62, 3: 82, 4: 110, 5: 114, 7: 118, 8: 122, 9: 156 };
const PRESTIGE_BUILDING: Record<number, number> = {
  1: 4,
  2: 28,
  3: 21,
  4: 7,
  5: 9,
  6: 11,
  7: 5,
  20: 36,
  21: 26,
  22: 26,
  23: 32,
  24: 26,
  25: 30,
  26: 38,
  27: 35,
  28: 18,
  29: 25,
  30: 39,
  31: 112,
  32: 128,
};
const PRESTIGE_TRAIN: Record<number, number> = {
  2: 0.5,
  3: 0.5,
  4: 1,
  5: 2,
  6: 3,
  7: 4,
  8: 5,
  9: 6,
  10: 7,
  11: 8,
  12: 9,
  13: 10,
  14: 1,
  15: 2,
  16: 3,
  17: 4,
  18: 5,
};

export const PrestigeAction = { RESEARCH: 1, BUILDING: 2, TRAIN: 3 } as const;

export function prestigeOf(action: number, id: number, level: number, townHallLevel: number): number {
  const table = action === 1 ? PRESTIGE_RESEARCH : action === 2 ? PRESTIGE_BUILDING : PRESTIGE_TRAIN;
  const base = table[id] ?? (action === 1 && id >= 10 ? 52 : 0);
  return (base * Math.pow(2, level)) / Math.pow(2, Math.max(0, townHallLevel - 1));
}

// ---------------------------------------------------------------------------------------------
// Speed-up items (castle.speedUpBuildCommand / tech.speedUpResearch)
// ---------------------------------------------------------------------------------------------

export interface SpeedupEffect {
  /** cents charged when the player has none of the item */
  cents: number;
  /** ms removed from the remaining time, given the total duration */
  reduce(totalMs: number, rng: () => number): number;
}

const H = 3_600_000;
export const SPEEDUP_ITEMS: Record<string, SpeedupEffect> = {
  'consume.2.a': { cents: 5, reduce: () => 15 * 60_000 },
  'consume.2.b': { cents: 10, reduce: () => H },
  'consume.2.b.1': { cents: 20, reduce: () => 2.5 * H },
  'consume.2.c': { cents: 50, reduce: () => 8 * H },
  'consume.2.c.1': { cents: 80, reduce: (_t, rng) => (10 + Math.floor(rng() * 21)) * H },
  'consume.2.d': { cents: 120, reduce: (t) => t * 0.3 },
  'player.speedup.1': { cents: 175, reduce: (t) => t * 0.5 },
};

export function speedupItemCents(itemId: string): number {
  return SPEEDUP_ITEMS[itemId]?.cents ?? itemConfig(itemId)?.cost ?? 0;
}

// ---------------------------------------------------------------------------------------------
// Splitting a training order across barracks
// ---------------------------------------------------------------------------------------------

export interface SplitLane {
  /** barracks position */
  positionId: number;
  /** when this barracks' queue frees up (now if idle) */
  freeAt: number;
}

/**
 * Divide `count` units over parallel queues so they all finish as close together as possible
 * ("water filling"): queues that are busy for longer get fewer units. `unitMs` is the time per
 * unit (the same in every barracks). Returns only queues that get at least one unit.
 */
export function splitTraining(lanes: SplitLane[], count: number, unitMs: number): { positionId: number; count: number; finishAt: number }[] {
  if (count <= 0 || lanes.length === 0) return [];
  const u = Math.max(1e-9, unitMs);
  const sorted = [...lanes].sort((a, b) => a.freeAt - b.freeAt);
  // the k earliest-free queues share the work; T is their common finish time
  let k = 1;
  let sum = sorted[0].freeAt;
  let finish = sum + count * u;
  while (k < sorted.length && sorted[k].freeAt < finish) {
    sum += sorted[k].freeAt;
    k++;
    finish = (count * u + sum) / k;
  }
  const alloc = sorted.slice(0, k).map((l) => ({ positionId: l.positionId, freeAt: l.freeAt, count: Math.max(0, Math.floor((finish - l.freeAt) / u)) }));
  let left = count - alloc.reduce((s, a) => s + a.count, 0);
  // hand out the rounding remainder to whichever queue would finish earliest with one more unit
  while (left > 0) {
    let best = alloc[0];
    for (const a of alloc) if (a.freeAt + (a.count + 1) * u < best.freeAt + (best.count + 1) * u) best = a;
    best.count++;
    left--;
  }
  return alloc.filter((a) => a.count > 0).map((a) => ({ positionId: a.positionId, count: a.count, finishAt: a.freeAt + a.count * u }));
}

/** Experience the mayor of the researching city earns when a research level completes: prestige plus a share of its cost. */
export function researchHeroExp(techId: number, level: number, townHallLevel: number): number {
  const c = researchCost(techId, level);
  const spent = c.food + c.wood + c.stone + c.iron + c.gold;
  return prestigeOf(PrestigeAction.RESEARCH, techId, level, townHallLevel) + spent * BALANCE.heroExpPerResearch;
}

/** Experience the city's mayor earns when a building level completes: prestige plus a share of its cost. */
export function buildingHeroExp(typeId: number, level: number, townHallLevel: number): number {
  const c = buildCost(typeId, level);
  const spent = c.food + c.wood + c.stone + c.iron + c.gold;
  return prestigeOf(PrestigeAction.BUILDING, typeId, level, townHallLevel) + spent * BALANCE.heroExpPerBuild;
}

/** Resources to heal injured troops (army.cureInjuredTroop): BALANCE.healCostShare of their training cost. */
export function healCost(troops: Partial<Record<string, number>>): Resources {
  let cost: Resources = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const [key, n] of Object.entries(troops)) {
    if (!n) continue;
    const id = TROOP_ID_BY_KEY[key as keyof typeof TROOP_ID_BY_KEY];
    if (!id) throw new GameError('Invalid troop type.', -99);
    const c = scaleResources(trainCost(id, n), BALANCE.healCostShare);
    cost = { gold: cost.gold + c.gold, food: cost.food + c.food, wood: cost.wood + c.wood, stone: cost.stone + c.stone, iron: cost.iron + c.iron };
  }
  return cost;
}
