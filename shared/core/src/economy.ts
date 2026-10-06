// City economy: static stats (storage, production, population) and lazy settlement of
// resources/population over elapsed time. Port of PlayerCity::CalculateStats /
// CalculateResources / RecalculateCityStats, with the gaps the original left as TODO filled in
// (tech, mayor and valley production bonuses, troop food upkeep, starvation).

import { BALANCE, scaled } from './balance.ts';
import { BuildingType, RESOURCE_KEYS, TechType, TileType, TROOP_ID_BY_KEY, TROOP_KEY_LIST, type ResourceKey } from './constants.ts';
import { troopConfig } from './data/index.ts';
import type { BuffState, BuildingState, CityMisc, ResearchState, ResourceSet, TroopCounts } from './types.ts';

export type BasicResource = Exclude<ResourceKey, 'gold'>;
export const BASIC_RESOURCES: readonly BasicResource[] = ['food', 'wood', 'stone', 'iron'];

/** Field building that produces each basic resource. */
export const FIELD_FOR_RESOURCE: Record<BasicResource, number> = {
  food: BuildingType.FARM,
  wood: BuildingType.SAWMILL,
  stone: BuildingType.QUARRY,
  iron: BuildingType.IRONMINE,
};
export const RESOURCE_FOR_FIELD: Record<number, BasicResource> = { 7: 'food', 4: 'wood', 5: 'stone', 6: 'iron' };

/** Research that boosts each basic resource. */
export const TECH_FOR_RESOURCE: Record<BasicResource, number> = {
  food: TechType.AGRICULTURE,
  wood: TechType.LUMBERING,
  stone: TechType.MASONRY,
  iron: TechType.MINING,
};

/** Valley types that boost each resource (Evony Age 1). */
export const VALLEY_RESOURCE: Record<number, BasicResource[]> = {
  [TileType.FOREST]: ['wood'],
  [TileType.DESERT]: ['stone'],
  [TileType.HILL]: ['iron'],
  [TileType.SWAMP]: ['food'],
  [TileType.GRASS]: ['food'],
  [TileType.LAKE]: ['food'],
  [TileType.FLAT]: [],
};

/** Production bonus (fraction) of an occupied valley for its resource. */
/** Gold to raise an unowned valley from `level` to `level + 1` (null when it is already at the top). */
export function valleyUpgradeCost(level: number): number | null {
  const { baseGold, maxLevel } = BALANCE.valleyUpgrade;
  if (level >= maxLevel) return null;
  return baseGold * Math.pow(2, Math.max(0, level - 1));
}

export function valleyBonus(type: number, level: number): number {
  const table = type === TileType.GRASS ? BALANCE.valleyBonus.grass : type === TileType.LAKE ? BALANCE.valleyBonus.lake : BALANCE.valleyBonus.other;
  if (!VALLEY_RESOURCE[type]?.length) return 0;
  return table[Math.min(10, Math.max(0, level))] ?? 0;
}

/** The parts of a city row the economy needs. */
export interface EconomyCity {
  gold: number;
  food: number;
  wood: number;
  stone: number;
  iron: number;
  resourcesAt: number;
  population: number;
  loyalty: number;
  grievance: number;
  taxRate: number;
  buildings: BuildingState[];
  troops: TroopCounts;
  workRates: ResourceSet;
  misc: CityMisc;
}

export interface MayorStats {
  power: number;
  management: number;
  stratagem: number;
}

/** Everything outside the city row that affects its economy. */
export interface EconomyContext {
  research: ResearchState;
  mayor: MayorStats | null;
  /** levels of every hero living in the city (salaries) */
  heroLevels: number[];
  /** valleys occupied by this city */
  valleys: { type: number; level: number }[];
  /** active player buffs */
  buffs: BuffState[];
  /** troops of this city currently away (marching/stationed): still eat */
  awayTroops: TroopCounts;
}

export interface BonusParts {
  tech: number;
  mayor: number;
  valley: number;
  buff: number;
}

export interface CityStats {
  maxPopulation: number;
  storage: Record<BasicResource, number>;
  /** workers each field set can employ at 100% */
  workers: Record<BasicResource, number>;
  /** workers actually requested given the work rates */
  workersNeeded: number;
  idlePopulation: number;
  /** 0..1 */
  efficiency: number;
  /** per-hour production before efficiency (fields only, after work rate) */
  fieldProduction: Record<BasicResource, number>;
  /** fractional bonus per resource (tech + mayor + valleys + buffs) */
  bonus: Record<BasicResource, number>;
  /** the bonus split by source (fractions; they sum to `bonus`) */
  bonusParts: Record<BasicResource, BonusParts>;
  /** net per-hour change of each resource (food includes upkeep, gold includes salaries) */
  rates: ResourceSet;
  taxIncome: number;
  heroSalary: number;
  upkeep: number;
}

const academyLevel = (buildings: BuildingState[]) => buildingLevel(buildings, BuildingType.ACADEMY);

/** Highest completed level among buildings of `typeId` (0 when absent). */
export function buildingLevel(buildings: BuildingState[], typeId: number): number {
  let max = 0;
  for (const b of buildings) if (b.typeId === typeId && b.level > max) max = b.level;
  return max;
}

export function buildingCount(buildings: BuildingState[], typeId: number): number {
  let n = 0;
  for (const b of buildings) if (b.typeId === typeId) n++;
  return n;
}

export function researchLevel(research: ResearchState, techId: number): number {
  return research[techId]?.level ?? 0;
}

/** Tech level usable in a city: capped by its Academy level (orig GetEffectiveTechLevel). */
export function effectiveTechLevel(research: ResearchState, buildings: BuildingState[], techId: number): number {
  return Math.min(academyLevel(buildings), researchLevel(research, techId));
}

export function hasBuff(buffs: BuffState[], id: string, now: number): boolean {
  return buffs.some((b) => b.id === id && b.endTime > now);
}

/** Food eaten per hour by a set of troops. */
export function troopUpkeep(troops: TroopCounts): number {
  let total = 0;
  for (const key of TROOP_KEY_LIST) {
    const n = troops[key] ?? 0;
    if (n > 0) total += n * (troopConfig(TROOP_ID_BY_KEY[key])?.upkeep ?? 0);
  }
  return total;
}

export function computeCityStats(city: EconomyCity, ctx: EconomyContext, now: number): CityStats {
  const F = BALANCE.fieldFactor;
  let maxPopulation = BALANCE.basePopulation;
  const base: number = BALANCE.baseStorage;
  const storage: Record<BasicResource, number> = { food: base, wood: base, stone: base, iron: base };
  const workers = { food: 0, wood: 0, stone: 0, iron: 0 };
  const rawProduction = { food: 0, wood: 0, stone: 0, iron: 0 };

  for (const b of city.buildings) {
    if (b.level <= 0) continue;
    if (b.typeId === BuildingType.COTTAGE) maxPopulation += BALANCE.cottagePopulation[b.level] ?? 0;
    const res = RESOURCE_FOR_FIELD[b.typeId];
    if (res) {
      const f = F[b.level] ?? 0;
      storage[res] += BALANCE.fieldStoragePerF * f;
      rawProduction[res] += BALANCE.fieldProductionPerF * f;
      workers[res] += BALANCE.fieldWorkersPerF * f;
    }
  }

  const stockpile = effectiveTechLevel(ctx.research, city.buildings, TechType.STOCKPILE);
  for (const r of BASIC_RESOURCES) storage[r] = Math.floor(storage[r] * (1 + stockpile * BALANCE.stockpileStorageBonusPerLevel));

  const fieldProduction = { food: 0, wood: 0, stone: 0, iron: 0 };
  let workersNeeded = 0;
  for (const r of BASIC_RESOURCES) {
    const rate = (city.workRates[r] ?? 100) / 100;
    fieldProduction[r] = rawProduction[r] * rate;
    workersNeeded += workers[r] * rate;
  }
  workersNeeded = Math.floor(workersNeeded);
  const population = Math.floor(city.population);
  const efficiency = workersNeeded <= 0 || population >= workersNeeded ? 1 : population / workersNeeded;
  const idlePopulation = Math.max(0, population - workersNeeded);

  const mayorBonus = ctx.mayor ? ctx.mayor.management * BALANCE.mayorManagementProductionFactor : 0;
  const parts = (): BonusParts => ({ tech: 0, mayor: mayorBonus, valley: 0, buff: 0 });
  const bonusParts = { food: parts(), wood: parts(), stone: parts(), iron: parts() };
  for (const r of BASIC_RESOURCES) {
    bonusParts[r].tech = effectiveTechLevel(ctx.research, city.buildings, TECH_FOR_RESOURCE[r]) * BALANCE.resourceTechBonusPerLevel;
  }
  for (const v of ctx.valleys) for (const r of VALLEY_RESOURCE[v.type] ?? []) bonusParts[r].valley += valleyBonus(v.type, v.level);
  const resBuffs: Record<BasicResource, string> = {
    food: 'FoodProductionBuff',
    wood: 'WoodProductionBuff',
    stone: 'StoneProductionBuff',
    iron: 'IronProductionBuff',
  };
  for (const r of BASIC_RESOURCES) if (hasBuff(ctx.buffs, resBuffs[r], now)) bonusParts[r].buff = BALANCE.resourceBuffBonus;
  const bonus = { food: 0, wood: 0, stone: 0, iron: 0 };
  for (const r of BASIC_RESOURCES) {
    const b = bonusParts[r];
    bonus[r] = b.tech + b.mayor + b.valley + b.buff;
  }

  let upkeep = troopUpkeep(city.troops) + troopUpkeep(ctx.awayTroops);
  if (hasBuff(ctx.buffs, 'UpkeepReduceBuff', now)) upkeep *= 0.5;
  const heroSalary = ctx.heroLevels.reduce((s, l) => s + l * BALANCE.heroSalaryPerLevel, 0);
  let taxIncome = (population * city.taxRate) / 100;
  if (hasBuff(ctx.buffs, 'GoldProductionBuff', now)) taxIncome *= 1 + BALANCE.resourceBuffBonus;

  const rates = { gold: taxIncome - heroSalary, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const r of BASIC_RESOURCES) {
    rates[r] = fieldProduction[r] * efficiency * (1 + bonus[r]) + BALANCE.baseProductionPerHour;
  }
  rates.food -= upkeep;

  return {
    maxPopulation,
    storage,
    workers,
    workersNeeded,
    idlePopulation,
    efficiency,
    fieldProduction,
    bonus,
    bonusParts,
    rates,
    taxIncome,
    heroSalary,
    upkeep,
  };
}

export interface SettleResult {
  /** troops that deserted because food ran out */
  deserted: TroopCounts;
  /** population/loyalty ticks applied */
  ticks: number;
}

const MAX_TICKS_DETAILED = 5000;

/**
 * Advance a city's resources, population and loyalty from `city.resourcesAt` to `now`,
 * mutating `city` in place. Population/loyalty drift every `BALANCE.cityTickMs` (scaled
 * by game speed); resources integrate piecewise between drift ticks.
 */
export function settleCity(city: EconomyCity, ctx: EconomyContext, now: number): SettleResult {
  const result: SettleResult = { deserted: {}, ticks: 0 };
  if (now <= city.resourcesAt) return result;
  const tickMs = Math.max(1000, scaled(BALANCE.cityTickMs));
  let t = city.resourcesAt;
  let lastTick = city.misc.lastTickAt ?? t;
  if (lastTick > t) lastTick = t;
  // never step back before `t` (a stale tick, e.g. after the game speed shrank the interval, would
  // otherwise rewind the clock and integrate the same time twice): keep the phase, drop old ticks
  if (lastTick + tickMs < t) lastTick = t - ((t - lastTick) % tickMs);
  let stats = computeCityStats(city, ctx, t);

  while (t < now) {
    const nextTick = lastTick + tickMs;
    const segEnd = result.ticks >= MAX_TICKS_DETAILED ? now : Math.min(nextTick, now);
    integrate(city, stats, segEnd - t, result);
    t = segEnd;
    if (t === nextTick) {
      populationTick(city, stats);
      lastTick = nextTick;
      result.ticks++;
      stats = computeCityStats(city, ctx, t);
    } else if (segEnd === now && result.ticks >= MAX_TICKS_DETAILED) {
      lastTick = now;
    }
  }
  city.resourcesAt = now;
  city.misc = { ...city.misc, lastTickAt: lastTick };
  return result;
}

function integrate(city: EconomyCity, stats: CityStats, dtMs: number, result: SettleResult) {
  if (dtMs <= 0) return;
  const hours = scaledHours(dtMs);
  for (const r of BASIC_RESOURCES) {
    const delta = stats.rates[r] * hours;
    const cur = city[r];
    if (delta >= 0) {
      // production never pushes a stock above storage, but never removes an over-cap stock either
      if (cur < stats.storage[r]) city[r] = Math.min(stats.storage[r], cur + delta);
    } else {
      const next = cur + delta;
      if (next < 0 && r === 'food') {
        starve(city, -next / Math.max(1, stats.upkeep), result);
        city[r] = 0;
      } else city[r] = Math.max(0, next);
    }
  }
  city.gold = Math.max(0, city.gold + stats.rates.gold * hours);
}

/** Game-speed aware conversion: production scales with GAME_SPEED like every timer. */
function scaledHours(dtMs: number): number {
  const speedMs = scaled(3_600_000);
  return dtMs / Math.max(1, speedMs);
}

/** Troops desert 10% per hour of unpaid upkeep (Evony behaviour; the original never ate food). */
function starve(city: EconomyCity, starvingHours: number, result: SettleResult) {
  const keep = Math.pow(0.9, starvingHours);
  for (const key of TROOP_KEY_LIST) {
    const n = city.troops[key] ?? 0;
    if (n <= 0) continue;
    const left = Math.floor(n * keep);
    if (left < n) {
      city.troops = { ...city.troops, [key]: left };
      result.deserted[key] = (result.deserted[key] ?? 0) + (n - left);
    }
  }
}

/** Population and loyalty drift (orig RecalculateCityStats). */
export function populationTick(city: EconomyCity, stats: CityStats) {
  const maxPop = stats.maxPopulation;
  const target = Math.floor((maxPop * Math.min(100, city.loyalty + city.grievance)) / 100);
  const step = Math.floor(maxPop * BALANCE.populationStep);
  const pop = city.population;
  if (pop > target) city.population = Math.max(target, pop - step);
  else if (pop < target) city.population = Math.min(target, maxPop, pop + step);

  const targetLoyalty = 100 - Math.min(100, city.taxRate + city.grievance);
  if (city.loyalty < targetLoyalty) city.loyalty = Math.min(targetLoyalty, city.loyalty + 1);
  else if (city.loyalty > targetLoyalty) city.loyalty = Math.max(targetLoyalty, city.loyalty - 1);
}

/** -1 shrinking, 0 stable, 1 growing (resource bean `populationDirection`). */
export function populationDirection(city: EconomyCity, stats: CityStats): -1 | 0 | 1 {
  const target = Math.floor((stats.maxPopulation * Math.min(100, city.loyalty + city.grievance)) / 100);
  return city.population > target ? -1 : city.population < target ? 1 : 0;
}

export function cityResources(city: EconomyCity): ResourceSet {
  return { gold: city.gold, food: city.food, wood: city.wood, stone: city.stone, iron: city.iron };
}

/** Resources a warehouse shields from plunder (per resource). */
export function protectedResources(buildings: BuildingState[], storePercent: ResourceSet): ResourceSet {
  const level = buildingLevel(buildings, BuildingType.WAREHOUSE);
  const cap = BALANCE.warehouseProtectPerLevel[level] ?? 0;
  const out = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const r of RESOURCE_KEYS) out[r] = r === 'gold' ? 0 : (cap * (storePercent[r] ?? 0)) / 100;
  return out;
}
