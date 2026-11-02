// City economy: static stats (storage, production, population) and lazy settlement of
// resources/population over elapsed time. Port of PlayerCity::CalculateStats /
// CalculateResources / RecalculateCityStats, with the gaps the original left as TODO filled in
// (tech, mayor and valley production bonuses, troop food upkeep, starvation).

import { BALANCE, getGameSpeed, scaled } from '#/balance.ts';
import {
  BASIC_RESOURCES,
  type BasicResource,
  BuffId,
  BuildingType,
  RESOURCE_KEYS,
  TechType,
  TileType,
  TROOP_ID_BY_KEY,
  TROOP_KEY_LIST,
  VALLEY_TYPES,
} from '#/constants.ts';
import { troopConfig } from '#/data/index.ts';
import { mayorProductionBonus } from '#/heroes.ts';
import { merchantBase } from '#/merchant.ts';
import type { BuffState, BuildingState, CityMisc, ResearchState, ResourceSet, TroopCounts } from '#/types.ts';

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

/** The resource a valley type boosts for the city holding it; null for flat land, which boosts none, or a tile that isn't a valley. */
export function valleyResource(type: number): BasicResource | null {
  return VALLEY_RESOURCE[type]?.[0] ?? null;
}

/** Whether a tile's level can be raised for gold (while nobody holds it): a valley, flat land included, or a barbarian city. */
export function canUpgradeTile(type: number): boolean {
  return VALLEY_TYPES.includes(type) || type === TileType.NPC;
}

/** Gold to raise an unowned valley from `level` to `level + 1` (null when it is already at the top). */
export function valleyUpgradeCost(level: number): number | null {
  const { baseGold, maxLevel } = BALANCE.valleyUpgrade;
  if (level >= maxLevel) return null;
  return baseGold * Math.pow(2, Math.max(0, level - 1));
}

/** Production bonus (fraction) of an occupied valley for its resource. */
export function valleyBonus(type: number, level: number): number {
  const table = type === TileType.GRASS ? BALANCE.valleyBonus.grass : type === TileType.LAKE ? BALANCE.valleyBonus.lake : BALANCE.valleyBonus.other;
  if (!valleyResource(type)) return 0;
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
  taxRate: number;
  buildings: BuildingState[];
  troops: TroopCounts;
  /** a rate the city never set counts as 100% */
  workRates: Partial<ResourceSet>;
  misc: CityMisc;
  /** (marchlands) a held historic city: its level, for its tribute */
  historicLevel?: number | null;
  /** (marchlands) a state's capital held by a player: the gold a real hour its state's barbarian cities pay (core stateTribute) */
  stateTribute?: number;
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
  /** (marchlands) a held historic city: how many seats its holder holds (its upkeep rises with each), and whether the holder's alliance shares its tribute */
  seats?: { held: number; shared: boolean };
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
  /** gold per hour: the base tax on population plus what the tax rate converts */
  taxIncome: number;
  /** (marchlands) gold per hour the tax rate converts from field output (part of taxIncome) */
  taxConverted: number;
  /** gold per hour the Gold Production item adds to the base tax (part of taxIncome) */
  taxBuff: number;
  /** (marchlands) gold per hour a held historic city's tribute brings (BALANCE.historic.tribute, per real hour) */
  tribute: number;
  /** (marchlands) gold per hour a state's capital gets from its state's barbarian cities (core stateTribute, per real hour) */
  stateTribute: number;
  /** (marchlands) gold per hour of the tributes its holder's alliance gets (BALANCE.historic.allianceShare; not in tribute or stateTribute) */
  tributeShared: number;
  /** (marchlands) gold and food per hour a held historic city's upkeep costs (BALANCE.historic.upkeep, per real hour) */
  seatUpkeep: { gold: number; food: number };
  /** (marchlands) field output per hour the tax rate takes and sells to the merchant */
  taxed: Record<BasicResource, number>;
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

export function hasBuff(buffs: BuffState[], id: BuffId, now: number): boolean {
  return buffs.some((b) => b.id === id && b.endTime > now);
}

/** (marchlands) Share of the normal cost a lord pays to train troops (fortifications pay in full): lower while a Quartermaster item's buff runs. */
export function troopCostShare(buffs: BuffState[], now: number): number {
  return hasBuff(buffs, BuffId.TRAIN_COST_REDUCE, now) ? 1 - BALANCE.trainCostReduction : 1;
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

/**
 * A resource field's factor F at a level: BALANCE.fieldFactor up to level 10; (marchlands) past it, only a captured
 * historic city's fields go (docs/features/historical-cities.md), carrying level 10's on in proportion (55 × level / 10).
 */
export function fieldFactorAt(level: number): number {
  const top = BALANCE.fieldFactor.length - 1;
  return level <= top ? (BALANCE.fieldFactor[level] ?? 0) : ((BALANCE.fieldFactor[top] ?? 0) * level) / top;
}

export function computeCityStats(city: EconomyCity, ctx: EconomyContext, now: number): CityStats {
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
      const f = fieldFactorAt(b.level);
      storage[res] += BALANCE.fieldStoragePerF * f;
      rawProduction[res] += BALANCE.fieldProductionPerF * f;
      workers[res] += BALANCE.fieldWorkersPerF * f;
    }
  }

  const stockpile = effectiveTechLevel(ctx.research, city.buildings, TechType.STOCKPILE);
  for (const r of BASIC_RESOURCES) storage[r] = Math.floor(storage[r] * (1 + stockpile * BALANCE.stockpileStorageBonusPerLevel) * BALANCE.storageMultiplier);

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

  const mayorBonus = ctx.mayor ? mayorProductionBonus(ctx.mayor.management) : 0;
  const parts = (): BonusParts => ({ tech: 0, mayor: mayorBonus, valley: 0, buff: 0 });
  const bonusParts = { food: parts(), wood: parts(), stone: parts(), iron: parts() };
  for (const r of BASIC_RESOURCES) {
    bonusParts[r].tech = effectiveTechLevel(ctx.research, city.buildings, TECH_FOR_RESOURCE[r]) * BALANCE.resourceTechBonusPerLevel;
  }
  for (const v of ctx.valleys) for (const r of VALLEY_RESOURCE[v.type] ?? []) bonusParts[r].valley += valleyBonus(v.type, v.level);
  const resBuffs: Record<BasicResource, BuffId> = {
    food: BuffId.FOOD_PRODUCTION,
    wood: BuffId.WOOD_PRODUCTION,
    stone: BuffId.STONE_PRODUCTION,
    iron: BuffId.IRON_PRODUCTION,
  };
  for (const r of BASIC_RESOURCES) if (hasBuff(ctx.buffs, resBuffs[r], now)) bonusParts[r].buff = BALANCE.resourceBuffBonus;
  const bonus = { food: 0, wood: 0, stone: 0, iron: 0 };
  for (const r of BASIC_RESOURCES) {
    const b = bonusParts[r];
    bonus[r] = b.tech + b.mayor + b.valley + b.buff;
  }

  let upkeep = troopUpkeep(city.troops) + troopUpkeep(ctx.awayTroops);
  if (hasBuff(ctx.buffs, BuffId.UPKEEP_REDUCE, now)) upkeep *= 1 - BALANCE.upkeepBuffReduction;
  // rates are per game hour; with upkeepPerRealHour troops eat their upkeep per real hour instead,
  // i.e. 1/GAME_SPEED of it per game hour, so a faster game does not make them hungrier
  if (BALANCE.upkeepPerRealHour) upkeep /= getGameSpeed();
  let heroSalary = BALANCE.heroSalaries ? ctx.heroLevels.reduce((s, l) => s + l * BALANCE.heroSalaryPerLevel, 0) : 0;
  // like upkeep: paid per real hour, not per game hour, when salaryPerRealHour is on
  if (BALANCE.salaryPerRealHour) heroSalary /= getGameSpeed();
  // (marchlands) the people pay a fixed base tax; the tax rate instead sells that share of the city's
  // field output to the merchant as it is produced (orig: tax = population x rate, costing loyalty)
  const taxBuff = hasBuff(ctx.buffs, BuffId.GOLD_PRODUCTION, now) ? population * BALANCE.baseTaxShare * BALANCE.resourceBuffBonus : 0;
  const baseTax = population * BALANCE.baseTaxShare + taxBuff;
  const share = Math.min(100, Math.max(0, city.taxRate)) / 100;
  const taxed = { food: 0, wood: 0, stone: 0, iron: 0 };
  let taxConverted = 0;

  const rates = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const r of BASIC_RESOURCES) {
    const gross = fieldProduction[r] * efficiency * (1 + bonus[r]) + BALANCE.baseProductionPerHour;
    taxed[r] = gross * share;
    taxConverted += taxed[r] * merchantBase(r);
    rates[r] = gross - taxed[r];
  }
  rates.food -= upkeep;
  const taxIncome = baseTax + taxConverted;
  // (marchlands) a held historic city's tribute, paid per real hour like salaries
  const seat = city.historicLevel as 12 | 14 | 16 | 18 | null | undefined;
  const level = seat && seat in BALANCE.historic.tribute ? seat : null;
  const fullTribute = level ? BALANCE.historic.tribute[level] / getGameSpeed() : 0;
  // (marchlands) and a capital's, from its state's barbarian cities
  const fullStateTribute = (city.stateTribute ?? 0) / getGameSpeed();
  // (marchlands) the holder's alliance takes its share of both; holding costs gold and food, more with each seat held
  const kept = ctx.seats?.shared ? 1 - BALANCE.historic.allianceShare : 1;
  const tribute = fullTribute * kept;
  const stateTribute = fullStateTribute * kept;
  const tributeShared = fullTribute + fullStateTribute - tribute - stateTribute;
  const { upkeep: u } = BALANCE.historic;
  const rise = 1 + u.risePerSeat * Math.max(0, (ctx.seats?.held ?? 1) - 1);
  const seatUpkeep = level ? { gold: (u.gold[level] * rise) / getGameSpeed(), food: (u.food[level] * rise) / getGameSpeed() } : { gold: 0, food: 0 };
  rates.food -= seatUpkeep.food;
  rates.gold = taxIncome + tribute + stateTribute - heroSalary - seatUpkeep.gold;

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
    taxConverted,
    taxBuff,
    tribute,
    stateTribute,
    tributeShared,
    seatUpkeep,
    taxed,
    heroSalary,
    upkeep,
  };
}

export interface SettleResult {
  /** troops that deserted because food ran out */
  deserted: TroopCounts;
  /** population/loyalty ticks applied */
  ticks: number;
  /** (marchlands) what the settled span produced and paid, for lord statistics */
  flows: SettleFlows;
}

export interface SettleFlows {
  /** gross output (fields, base, bonuses; gold: tax income), including what storage could not hold */
  produced: ResourceSet;
  /** output lost because storage was full */
  wasted: Record<BasicResource, number>;
  /** output the tax rate sold for gold (counted in `produced`, not stored) */
  taxed: Record<BasicResource, number>;
  /** food troops ate */
  upkeep: number;
  /** gold paid to heroes */
  salaries: number;
  /** (marchlands) gold and food a held historic city's upkeep took */
  seatUpkeep: { gold: number; food: number };
}

const emptyFlows = (): SettleFlows => ({
  produced: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 },
  wasted: { food: 0, wood: 0, stone: 0, iron: 0 },
  taxed: { food: 0, wood: 0, stone: 0, iron: 0 },
  upkeep: 0,
  salaries: 0,
  seatUpkeep: { gold: 0, food: 0 },
});

const MAX_TICKS_DETAILED = 5000;

/**
 * Advance a city's resources and population from `city.resourcesAt` to `now`, mutating `city` in
 * place. Population drifts every `BALANCE.cityTickMs` (scaled by game speed); resources integrate
 * piecewise between drift ticks. (marchlands) lords' cities have no loyalty.
 */
export function settleCity(city: EconomyCity, ctx: EconomyContext, now: number): SettleResult {
  const result: SettleResult = { deserted: {}, ticks: 0, flows: emptyFlows() };
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
  const f = result.flows;
  for (const r of BASIC_RESOURCES) {
    const delta = stats.rates[r] * hours;
    const eat = r === 'food' ? stats.upkeep * hours : 0;
    // (marchlands) a held historic city's food upkeep: counted apart from what troops eat
    const seatFood = r === 'food' ? stats.seatUpkeep.food * hours : 0;
    f.seatUpkeep.food += seatFood;
    const cur = city[r];
    f.produced[r] += delta + eat + seatFood + stats.taxed[r] * hours;
    f.taxed[r] += stats.taxed[r] * hours;
    if (delta >= 0) {
      // production never pushes a stock above storage, but never removes an over-cap stock either
      if (cur < stats.storage[r]) city[r] = Math.min(stats.storage[r], cur + delta);
      f.wasted[r] += delta - (city[r] - cur);
      f.upkeep += eat;
    } else {
      const next = cur + delta;
      if (next < 0 && r === 'food') {
        if (BALANCE.starvationDesertion) starve(city, -next / Math.max(1, stats.upkeep), result);
        city[r] = 0;
        f.upkeep += cur + delta + eat; // they ate what there was
      } else {
        city[r] = Math.max(0, next);
        f.upkeep += eat;
      }
    }
  }
  const gold = city.gold + stats.rates.gold * hours;
  f.produced.gold += (stats.taxIncome + stats.tribute + stats.stateTribute) * hours;
  f.salaries += gold < 0 ? Math.max(0, city.gold + (stats.taxIncome + stats.tribute + stats.stateTribute) * hours) : stats.heroSalary * hours;
  f.seatUpkeep.gold += stats.seatUpkeep.gold * hours;
  city.gold = Math.max(0, gold);
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

/**
 * Population drift (orig RecalculateCityStats): a step towards the maximum population each tick.
 * (marchlands) the original aimed at max x (loyalty + grievance) / 100; lords' cities have no loyalty.
 */
export function populationTick(city: EconomyCity, stats: CityStats) {
  const target = stats.maxPopulation;
  const step = Math.floor(target * BALANCE.populationStep);
  const pop = city.population;
  if (pop > target) city.population = Math.max(target, pop - step);
  else if (pop < target) city.population = Math.min(target, pop + step);
}

/** -1 shrinking, 0 stable, 1 growing (resource bean `populationDirection`). */
export function populationDirection(city: EconomyCity, stats: CityStats): -1 | 0 | 1 {
  const target = stats.maxPopulation;
  return city.population > target ? -1 : city.population < target ? 1 : 0;
}

export function cityResources(city: EconomyCity): ResourceSet {
  return { gold: city.gold, food: city.food, wood: city.wood, stone: city.stone, iron: city.iron };
}

/** Resources a warehouse shields from plunder (per resource). */
export function protectedResources(buildings: BuildingState[], storePercent: Partial<ResourceSet>): ResourceSet {
  const level = buildingLevel(buildings, BuildingType.WAREHOUSE);
  const cap = BALANCE.warehouseProtectPerLevel[level] ?? 0;
  const out = { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
  for (const r of RESOURCE_KEYS) out[r] = r === 'gold' ? 0 : (cap * (storePercent[r] ?? 0)) / 100;
  return out;
}

/** Techs being researched in a given city. */
export function researchesInCity(research: ResearchState, cityId: number): number[] {
  return Object.entries(research)
    .filter(([, r]) => r.cityId === cityId && r.endTime)
    .map(([id]) => Number(id));
}
