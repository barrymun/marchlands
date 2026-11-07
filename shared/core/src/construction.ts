// Buildings, research and troop/fort production rules (pure). Port of pcastle/ptech/ptroop/
// pfortifications logic with the original's validation gaps closed.

import { BALANCE, goldForCents, scaled } from '#/balance.ts';
import { BuildingType, FORT_KEYS, FortType, RequirementKind, TechType, TROOP_ID_BY_KEY, TROOP_KEYS, TroopType } from '#/constants.ts';
import {
  buildingConfig,
  type BuildingLevelConfig,
  buildingMaxLevel,
  ITEMS,
  type Requirements,
  researchConfig,
  researchMaxLevel,
  troopConfig,
  type TroopConfig,
} from '#/data/index.ts';
import { buildingCount, buildingLevel, type MayorStats, researchLevel } from '#/economy.ts';
import { GameError } from '#/errors.ts';
import { itemGoldPrice } from '#/items.ts';
import { msg, ref } from '#/messages/index.ts';
import { addResources, emptyResources, type Resources, scaleResources } from '#/resources.ts';
import { coinsForSpeedup, HOUR } from '#/time.ts';
import type { BuildingState, FortCounts, ItemCounts, RequirementCheck, ResearchState, TrainBatch } from '#/types.ts';

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
  return Math.min(OUTER_POSITIONS.max - OUTER_POSITIONS.min + 1, BALANCE.outerSlotsBase + BALANCE.outerSlotsPerTownHall * townHallLevel);
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

/** Legacy config references items by config row id; map to the item id string. */
function itemIdFromLegacy(legacyId: number): string | undefined {
  return ITEMS.find((i) => i.legacyId === legacyId)?.id;
}

export function checkRequirements(req: Requirements, buildings: BuildingState[], research: ResearchState, items: ItemCounts): RequirementCheck[] {
  const out: RequirementCheck[] = [];
  for (const b of req.buildings) {
    const cur = buildingLevel(buildings, b.id);
    out.push({ kind: RequirementKind.BUILDING, id: b.id, required: b.level, current: cur, ok: cur >= b.level });
  }
  for (const t of req.techs) {
    const cur = researchLevel(research, t.id);
    out.push({ kind: RequirementKind.TECH, id: t.id, required: t.level, current: cur, ok: cur >= t.level });
  }
  for (const i of req.items) {
    const id = itemIdFromLegacy(i.id) ?? String(i.id);
    const cur = items[id] ?? 0;
    out.push({ kind: RequirementKind.ITEM, id, required: i.level, current: cur, ok: cur >= i.level });
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

/** Construction/upgrade time to reach `targetLevel`: mayor management + Construction (orig §3.1); (marchlands) the mayor's cut is floored at BALANCE.heroTimeFloor.building. */
export function buildTimeMs(typeId: number, targetLevel: number, mayor: MayorStats | null, research: ResearchState): number {
  const cfg = buildingConfig(typeId, targetLevel);
  if (!cfg) throw new GameError(msg('building.invalidBuilding'), -99);
  const seconds = cfg.buildTime * heroFactor(mayor?.management, BALANCE.heroTimeFloor.building) * techFactor(researchLevel(research, TechType.CONSTRUCTION));
  return scaled(Math.floor(seconds) * 1000);
}

/** (marchlands) Resources a full demolition returns: BALANCE.demolishRefund of the cost of every level up to `level`. */
export function fullDemolishRefund(typeId: number, level: number): Resources {
  let total = emptyResources();
  for (let l = 1; l <= level; l++) total = addResources(total, buildingConfig(typeId, l)?.cost ?? {});
  return scaleResources(total, BALANCE.demolishRefund);
}

/** Research time: mayor stratagem only (orig §3.3); (marchlands) never below BALANCE.heroTimeFloor.research. */
export function researchTimeMs(techId: number, targetLevel: number, mayor: MayorStats | null): number {
  const cfg = researchConfig(techId, targetLevel);
  if (!cfg) throw new GameError(msg('building.invalidTech'), -99);
  return scaled(Math.floor(cfg.buildTime * heroFactor(mayor?.stratagem, BALANCE.heroTimeFloor.research)) * 1000);
}

/** Siege units: Metal Casting cuts their training time, Military Science every other troop's. */
export const SIEGE: readonly number[] = [TroopType.CATAPULT, TroopType.RAM, TroopType.TRANSPORTER, TroopType.BALLISTA];

/** Per-unit training seconds (displayed formula of the original, without its fall-through bug). */
export function troopUnitSeconds(troopId: number, mayor: MayorStats | null, research: ResearchState): number {
  const cfg = troopConfig(troopId);
  if (!cfg) throw new GameError(msg('common.invalidTroopType'), -99);
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
  if (!cfg) throw new GameError(msg('building.invalidBuilding'), -99);
  return { ...cfg.cost };
}

export function researchCost(techId: number, targetLevel: number): Resources {
  const cfg = researchConfig(techId, targetLevel);
  if (!cfg) throw new GameError(msg('building.invalidTech'), -99);
  return { ...cfg.cost };
}

/**
 * (marchlands) Most units of a troop type the city can pay for now: resources and idle population. Whole resources
 * only: trainCost rounds a discounted total up, so a fraction left in the city pays for nothing.
 */
export function maxTrainableCount(troopId: number, have: Partial<Resources>, idlePopulation: number, costShare = 1): number {
  const cfg = troopConfig(troopId);
  if (!cfg) return 0;
  let max = Infinity;
  for (const [k, cost] of Object.entries(cfg.cost) as [keyof Resources, number][])
    if (cost > 0) max = Math.min(max, Math.floor(Math.floor(have[k] ?? 0) / (cost * costShare)));
  if (cfg.population > 0) max = Math.min(max, Math.floor(idlePopulation / cfg.population));
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

/** Cost of `count` units; `costShare` < 1 while training is discounted (troopCostShare), rounded up. */
export function trainCost(troopId: number, count: number, costShare = 1): Resources {
  const cfg = troopConfig(troopId);
  if (!cfg) throw new GameError(msg('common.invalidTroopType'), -99);
  const cost = scaleResources(cfg.cost, count * costShare);
  if (costShare !== 1) for (const k of Object.keys(cost) as (keyof Resources)[]) cost[k] = Math.ceil(cost[k]);
  return cost;
}

/**
 * (marchlands) What disbanding `count` troops or fortifications of `unitId` returns: BALANCE.disbandRefund of their
 * training cost (rounded down), for as many units as `credit` covers. The credit is the player's refund credit for
 * that unit (PlayerMisc.refundCredit): finished training adds the share of the cost it paid (0.75 a unit while
 * discounted), and a refund uses up what it covers. So refunds never exceed BALANCE.disbandRefund of what training
 * cost, and units that cost less (a discount, healing, quest rewards) can't be turned into resources.
 */
export function disbandRefund(unitId: number, count: number, credit: number): { refund: Resources; creditUsed: number } {
  const creditUsed = Math.min(count, Math.max(0, credit));
  const refund = trainCost(unitId, creditUsed);
  // the epsilon keeps float error (50 x 0.9 = 44.99…) from costing a unit of resource
  for (const k of Object.keys(refund) as (keyof Resources)[]) refund[k] = Math.floor(refund[k] * BALANCE.disbandRefund + 1e-9);
  return { refund, creditUsed };
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
  if (!isValidPosition(positionId)) throw new GameError(msg('building.invalidPosition'), -99);
  const cfg = buildingConfig(typeId, 1);
  if (!cfg || cfg.inside === 3) throw new GameError(msg('building.cannotBuild'), -99);
  if (!canPlace(typeId, positionId)) throw new GameError(msg('building.cannotBuildHere', { building: ref.building(typeId) }), -99);
  if (findBuilding(buildings, positionId)) throw new GameError(msg('building.positionTaken'), -99);
  if (cfg.limit > 0 && buildingCount(buildings, typeId) >= cfg.limit)
    throw new GameError(msg('building.limitReached', { building: ref.building(typeId) }), -99);
  if (isOuterPosition(positionId)) {
    const th = buildingLevel(buildings, BuildingType.TOWN_HALL);
    if (positionId - 1000 > unlockedOuterSlots(th)) throw new GameError(msg('building.slotLocked'), -99);
  }
  if (isConstructing(buildings, maxConcurrent)) throw new GameError(msg('building.queuesBusy'), -48);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError(msg('building.requirementsNotMet'), -99);
  }
}

/**
 * Refuses an upgrade that can't start now; else the building and its next level's config. `historicLevel` is the city's
 * when it is a held historic city, whose fields go up to that level and no further (`buildingMaxLevel`).
 */
export function assertCanUpgrade(
  b: BuildingState | undefined,
  buildings: BuildingState[],
  research: ResearchState,
  items: ItemCounts,
  maxConcurrent = 1,
  historicLevel: number | null = null,
): { building: BuildingState; next: BuildingLevelConfig } {
  if (!b) throw new GameError(msg('building.notFound'), -99, 404);
  if (b.status !== 0) {
    throw new GameError(msg('building.statusChanged'), -45);
  }
  if (isConstructing(buildings, maxConcurrent)) throw new GameError(msg('building.queuesBusy'), -48);
  if (b.level >= buildingMaxLevel(b.typeId, historicLevel)) throw new GameError(msg('building.maxLevel', { building: ref.building(b.typeId) }), -99);
  const cfg = buildingConfig(b.typeId, b.level + 1);
  if (!cfg) throw new GameError(msg('building.requirementsNotMet'), -99);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError(msg('building.requirementsNotMet'), -99);
  }
  return { building: b, next: cfg };
}

export function assertCanResearch(techId: number, buildings: BuildingState[], research: ResearchState, items: ItemCounts) {
  const level = researchLevel(research, techId);
  if (level >= researchMaxLevel(techId)) throw new GameError(msg('building.invalidTech'), -99);
  const cfg = researchConfig(techId, level + 1);
  if (!cfg) throw new GameError(msg('building.invalidTech'), -99);
  if (buildingLevel(buildings, BuildingType.ACADEMY) < 1)
    throw new GameError(msg('building.academyNeeded', { building: ref.building(BuildingType.ACADEMY) }), -99);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError(msg('building.techRequirementsNotMet'), -99);
  }
}

/** Refuses training that can't start; else the troop's config. */
export function assertCanTrain(
  troopId: number,
  count: number,
  buildings: BuildingState[],
  research: ResearchState,
  items: ItemCounts,
  fort: boolean,
): TroopConfig {
  if (!Number.isInteger(count) || count < 1) throw new GameError(msg('common.invalidAmount'), -99);
  const cfg = troopConfig(troopId);
  if (!cfg || cfg.inside !== (fort ? 2 : 1)) throw new GameError(msg('common.invalidTroopType'), -99);
  if (!requirementsMet(checkRequirements(cfg.requires, buildings, research, items))) {
    throw new GameError(msg('building.troopRequirementsNotMet'), -99);
  }
  return cfg;
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
  /** (orig) price in cents; charged in gold (goldForCents) when the player has none of the item */
  cents: number;
  /** ms removed from the remaining time, given the total duration: game time for a fixed cut, a share of `totalMs` otherwise */
  reduce(totalMs: number, rng: () => number): number;
  /** cuts a share of the job's whole time (`cutShare`) rather than a fixed time */
  byShare: boolean;
}

/** The speed-up items (BALANCE.items.speedups). */
export const SPEEDUP_ITEMS: Record<string, SpeedupEffect> = Object.fromEntries(
  Object.entries(BALANCE.items.speedups).map(([id, s]): [string, SpeedupEffect] => {
    const { cutMs, cutHours, cutShare } = s;
    const reduce: SpeedupEffect['reduce'] =
      cutShare != null
        ? (t) => t * cutShare
        : cutHours
          ? (_t, rng) => (cutHours[0] + Math.floor(rng() * (cutHours[1] - cutHours[0] + 1))) * HOUR
          : () => cutMs ?? 0;
    return [id, { cents: s.cents, reduce, byShare: cutShare != null }];
  }),
);

/**
 * The real ms a speed-up item takes off a job whose whole time is `totalMs` (real ms, as stored): a share of it as it
 * is, a fixed cut (game time) scaled to real time by the game speed.
 */
export const speedupCut = (eff: SpeedupEffect, totalMs: number, rng: () => number) =>
  eff.byShare ? eff.reduce(totalMs, rng) : scaled(eff.reduce(totalMs, rng));

/**
 * A training batch after Napoleon's Diary / Archimedes' Note: BALANCE.items.batchSpeedupShare of its full
 * time ((marchlands) orig: of the time left), so four finish any batch. The head of the queue ends sooner
 * (never before `now`), its start moving back by the time saved, so its progress bar jumps forward; a
 * waiting batch gets shorter.
 */
export function speedUpTrainBatch(batch: TrainBatch, head: boolean, now: number): TrainBatch {
  const share = BALANCE.items.batchSpeedupShare;
  if (head) {
    // the head's start already sits back by any earlier cuts, so end - start is its full time
    const endTime = Math.max(now, batch.endTime - Math.floor((batch.endTime - batch.startTime) * share));
    return { ...batch, startTime: batch.startTime - (batch.endTime - endTime), endTime };
  }
  const fullTime = batch.fullTime ?? batch.costTime;
  return { ...batch, fullTime, costTime: Math.max(0, batch.costTime - Math.floor(fullTime * share)) };
}

/** Gold charged for a speed-up item the player has none of (its gold price). */
export function speedupItemGold(itemId: string): number {
  return itemGoldPrice(itemId) ?? goldForCents(SPEEDUP_ITEMS[itemId]?.cents ?? 0);
}

/** (marchlands) Gold to finish something with `timeLeftMs` remaining at once: the original's coins (coinsForSpeedup) in gold. */
export function goldForSpeedup(timeLeftMs: number): number {
  return goldForCents(coinsForSpeedup(timeLeftMs));
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
  const u = Math.max(1e-9, unitMs);
  const sorted = [...lanes].sort((a, b) => a.freeAt - b.freeAt);
  const [first, ...later] = sorted;
  if (count <= 0 || !first) return [];
  // the k earliest-free queues share the work; T is their common finish time
  let k = 1;
  let sum = first.freeAt;
  let finish = sum + count * u;
  for (const lane of later) {
    if (lane.freeAt >= finish) break;
    sum += lane.freeAt;
    k++;
    finish = (count * u + sum) / k;
  }
  const alloc = sorted.slice(0, k).map((l) => ({ positionId: l.positionId, freeAt: l.freeAt, count: Math.max(0, Math.floor((finish - l.freeAt) / u)) }));
  let left = count - alloc.reduce((s, a) => s + a.count, 0);
  // hand out the rounding remainder to whichever queue would finish earliest with one more unit
  while (left > 0) {
    const best = alloc.reduce((b, a) => (a.freeAt + (a.count + 1) * u < b.freeAt + (b.count + 1) * u ? a : b));
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
    // any key may come in (the troops are a client's or stored); only troop keys have an id
    const id = (TROOP_ID_BY_KEY as Partial<Record<string, number>>)[key];
    if (!id) throw new GameError(msg('common.invalidTroopType'), -99);
    const c = scaleResources(trainCost(id, n), BALANCE.healCostShare);
    cost = { gold: cost.gold + c.gold, food: cost.food + c.food, wood: cost.wood + c.wood, stone: cost.stone + c.stone, iron: cost.iron + c.iron };
  }
  return cost;
}
