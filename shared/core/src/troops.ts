// Troop count helpers and march maths (orig spitfire::CalcTroopSpeed).

import { BALANCE, scaled } from '#/balance.ts';
import {
  BuildingType,
  FORT_ID_BY_KEY,
  FORT_KEY_LIST,
  type FortKey,
  TechType,
  TROOP_ID_BY_KEY,
  TROOP_KEY_LIST,
  TROOP_KEYS,
  type TroopKey,
} from '#/constants.ts';
import { troopConfig } from '#/data/index.ts';
import { buildingLevel, researchLevel } from '#/economy.ts';
import { GameError } from '#/errors.ts';
import { msg } from '#/messages/index.ts';
import type { BuildingState, FortCounts, ResearchState, TroopCounts } from '#/types.ts';

/** Battle/legacy order: index = troop id - 2. */
export function troopsToArray(t: TroopCounts): number[] {
  return TROOP_KEY_LIST.map((k) => Math.max(0, Math.floor(t[k] ?? 0)));
}
export function arrayToTroops(a: number[]): TroopCounts {
  const out: TroopCounts = {};
  TROOP_KEY_LIST.forEach((k, i) => {
    if ((a[i] ?? 0) > 0) out[k] = a[i];
  });
  return out;
}
/** [trap, abatis, arrowTower, rollingLogs, rockfall] */
export function fortsToArray(f: FortCounts): number[] {
  return FORT_KEY_LIST.map((k) => Math.max(0, Math.floor(f[k] ?? 0)));
}
export function arrayToForts(a: number[]): FortCounts {
  const out: FortCounts = {};
  FORT_KEY_LIST.forEach((k, i) => {
    if ((a[i] ?? 0) > 0) out[k] = a[i];
  });
  return out;
}

export function totalTroops(t: TroopCounts): number {
  return TROOP_KEY_LIST.reduce((s, k) => s + (t[k] ?? 0), 0);
}

export function addTroops(a: TroopCounts, b: TroopCounts, mult = 1): TroopCounts {
  const out: TroopCounts = { ...a };
  for (const k of TROOP_KEY_LIST) {
    const v = (a[k] ?? 0) + (b[k] ?? 0) * mult;
    if (v > 0) out[k] = v;
    else delete out[k];
  }
  return out;
}
export function addForts(a: FortCounts, b: FortCounts, mult = 1): FortCounts {
  const out: FortCounts = { ...a };
  for (const k of FORT_KEY_LIST) {
    const v = (a[k] ?? 0) + (b[k] ?? 0) * mult;
    if (v > 0) out[k] = v;
    else delete out[k];
  }
  return out;
}

/** true when `have` contains at least `need` of every type */
export function hasTroops(have: TroopCounts, need: TroopCounts): boolean {
  return TROOP_KEY_LIST.every((k) => (have[k] ?? 0) >= (need[k] ?? 0));
}

/** Validate a client-supplied troop object: known keys, non-negative integers, total > 0. */
export function sanitizeTroops(input: Record<string, unknown>, allowEmpty = false): TroopCounts {
  const out: TroopCounts = {};
  for (const [k, v] of Object.entries(input ?? {})) {
    if (!(TROOP_KEY_LIST as string[]).includes(k)) throw new GameError(msg('common.unknownTroopType', { key: k }), -99);
    const n = Number(v ?? 0);
    if (!Number.isInteger(n) || n < 0) throw new GameError(msg('common.invalidTroopCount'), -99);
    if (n > 0) out[k as TroopKey] = n;
  }
  if (!allowEmpty && totalTroops(out) <= 0) throw new GameError(msg('common.noTroopsSelected'), -99);
  return out;
}

export const troopKey = (troopId: number): TroopKey | undefined => (TROOP_KEYS as Record<number, TroopKey>)[troopId];
export const fortKeyOf = (troopId: number): FortKey | undefined => FORT_KEY_LIST[troopId - 14];

// ---------------------------------------------------------------------------------------------
// March
// ---------------------------------------------------------------------------------------------

/** Base march speeds (tiles per 1000 minutes) — the battle speed table. */
export const MARCH_SPEED: Record<TroopKey, number> = {
  peasants: 180,
  militia: 200,
  scouter: 3000,
  pikemen: 300,
  swordsmen: 275,
  archer: 250,
  carriage: 150,
  lightCavalry: 1000,
  heavyCavalry: 750,
  ballista: 100,
  batteringRam: 120,
  catapult: 80,
};
const MECH_OR_MOUNTED: TroopKey[] = ['carriage', 'lightCavalry', 'heavyCavalry', 'ballista', 'batteringRam', 'catapult'];

export function tileXY(tileId: number, mapSize: number = BALANCE.mapSize): { x: number; y: number } {
  return { x: tileId % mapSize, y: Math.floor(tileId / mapSize) };
}
export function tileId(x: number, y: number, mapSize: number = BALANCE.mapSize): number {
  const m = (v: number) => ((v % mapSize) + mapSize) % mapSize;
  return m(y) * mapSize + m(x);
}
export function tileDistance(a: number, b: number, mapSize: number = BALANCE.mapSize): number {
  const p = tileXY(a, mapSize);
  const q = tileXY(b, mapSize);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Slowest speed of an army in tiles/minute*1000 after Compass / Horseback Riding (capped by Academy). */
export function armySpeed(troops: TroopCounts, research: ResearchState, buildings: BuildingState[]): number {
  const academy = buildingLevel(buildings, BuildingType.ACADEMY);
  const compass = Math.min(academy, researchLevel(research, TechType.COMPASS));
  const hbr = Math.min(academy, researchLevel(research, TechType.HORSEBACK_RIDING));
  let slowest = Infinity;
  for (const k of TROOP_KEY_LIST) {
    if ((troops[k] ?? 0) <= 0) continue;
    const base = MARCH_SPEED[k];
    const s = MECH_OR_MOUNTED.includes(k) ? base * (1 + BALANCE.horsebackSpeedPerLevel * hbr) : base * (1 + BALANCE.compassSpeedPerLevel * compass);
    slowest = Math.min(slowest, s);
  }
  return Number.isFinite(slowest) ? slowest : 10_000;
}

/** One-way march duration in ms (scaled by game speed). Minimum 1 second. */
export function marchTimeMs(fromTile: number, toTile: number, troops: TroopCounts, research: ResearchState, buildings: BuildingState[]): number {
  const distance = tileDistance(fromTile, toTile);
  const speed = armySpeed(troops, research, buildings);
  const seconds = Math.floor((distance * 60_000) / speed);
  return scaled(Math.max(1, seconds) * 1000);
}

/** Total carry capacity of an army (troop load x Logistics). */
export function armyLoad(troops: TroopCounts, research: ResearchState): number {
  let load = 0;
  for (const k of TROOP_KEY_LIST) load += (troops[k] ?? 0) * (troopConfig(TROOP_ID_BY_KEY[k])?.load ?? 0);
  return Math.floor(load * (1 + BALANCE.logisticsLoadPerLevel * researchLevel(research, TechType.LOGISTICS)));
}

/** Max troops in one army: BALANCE.rallySpotTroopsPerLevel per Rally Spot level, +25% with a War Ensign. */
export function maxArmyTroops(buildings: BuildingState[], warEnsign = false): number {
  const base = buildingLevel(buildings, BuildingType.RALLY_SPOT) * BALANCE.rallySpotTroopsPerLevel;
  return Math.floor(base * (warEnsign ? 1 + BALANCE.warEnsignTroopBonus : 1));
}

/** Max simultaneous armies a city may have out (Rally Spot level). */
export function maxArmies(buildings: BuildingState[]): number {
  return buildingLevel(buildings, BuildingType.RALLY_SPOT) * BALANCE.rallySpotArmiesPerLevel;
}

/** Relief station multiplier sent to the client as transportStationParam (orig). */
export function reliefMultiplier(buildings: BuildingState[]): number {
  const l = buildingLevel(buildings, BuildingType.RELIEF_STATION);
  if (l <= 0) return 1;
  if (l <= 3) return 2;
  if (l === 4) return 3;
  if (l <= 7) return 4;
  if (l <= 9) return 5;
  return 6;
}

/**
 * "Experience" weight per unit, by troop / fortification id (orig Utils::TROOP_EXPS). The original
 * has no values for fortifications; they get ~1.35 × their resource cost, the same ratio as troops.
 */
const UNIT_EXP: Record<number, number> = {
  2: 225,
  3: 305,
  4: 695,
  5: 900,
  6: 1350,
  7: 1350,
  8: 2975,
  9: 2850,
  10: 8750,
  11: 10000,
  12: 13750,
  13: 29000,
  14: 950,
  15: 1950,
  16: 5000,
  17: 8500,
  18: 11600,
};

export const unitExp = (troopId: number): number => UNIT_EXP[troopId] ?? 0;

/** Total experience weight of a set of troops and fortifications. */
export function unitsExp(troops: TroopCounts, forts: FortCounts = {}): number {
  let exp = 0;
  for (const k of TROOP_KEY_LIST) exp += (troops[k] ?? 0) * unitExp(TROOP_ID_BY_KEY[k]);
  for (const k of FORT_KEY_LIST) exp += (forts[k] ?? 0) * unitExp(FORT_ID_BY_KEY[k]);
  return exp;
}

/** Medicine: share of fallen troops that survive injured (BALANCE.medicinePerLevel per level, up to BALANCE.medicineMaxShare). */
export function medicineShare(research: ResearchState): number {
  return Math.min(BALANCE.medicineMaxShare, researchLevel(research, TechType.MEDICINE) * BALANCE.medicinePerLevel);
}

/** The part of `lost` that survives injured under the Medicine share. */
export function injuredOf(lost: TroopCounts, research: ResearchState): TroopCounts {
  const share = medicineShare(research);
  const out: TroopCounts = {};
  if (share <= 0) return out;
  for (const k of TROOP_KEY_LIST) {
    const n = Math.floor((lost[k] ?? 0) * share);
    if (n > 0) out[k] = n;
  }
  return out;
}

/** Honor to heal injured troops: their food upkeep x BALANCE.healHonorPerUpkeep (what killing them earns). */
export function healHonorCost(troops: Partial<Record<string, number>>): number {
  let honor = 0;
  for (const [key, n] of Object.entries(troops)) {
    if (!n) continue;
    honor += n * (troopConfig(TROOP_ID_BY_KEY[key as TroopKey])?.upkeep ?? 0) * BALANCE.healHonorPerUpkeep;
  }
  return Math.ceil(honor);
}

/** Proportionally shrink several troop groups so their per-type totals equal `after`. */
export function distributeLosses(groups: TroopCounts[], before: TroopCounts, after: TroopCounts): TroopCounts[] {
  return distributeLossesAmong(groups, (g) => g, before, after).map((r) => r.troops);
}

/**
 * `distributeLosses` over whatever holds the troops (a city, the armies stationed there): each holder with the troops
 * it has left, in the same order, so a caller never matches the results up by position.
 */
export function distributeLossesAmong<H>(
  holders: readonly H[],
  troopsOf: (h: H) => TroopCounts,
  before: TroopCounts,
  after: TroopCounts,
): { holder: H; troops: TroopCounts }[] {
  // each group beside the copy that takes its share of the losses
  const rows = holders.map((holder) => {
    const orig = troopsOf(holder);
    return { holder, orig, out: { ...orig } };
  });
  for (const k of TROOP_KEY_LIST) {
    const b = before[k] ?? 0;
    if (b <= 0) continue;
    const target = after[k] ?? 0;
    let assigned = 0;
    for (const { out: g } of rows) {
      const v = Math.floor(((g[k] ?? 0) * target) / b);
      g[k] = v;
      assigned += v;
    }
    // hand out the rounding remainder to the largest groups
    let rest = target - assigned;
    const order = [...rows].sort((x, y) => (y.orig[k] ?? 0) - (x.orig[k] ?? 0));
    for (const r of order) {
      if (rest <= 0) break;
      if ((r.out[k] ?? 0) < (r.orig[k] ?? 0)) {
        r.out[k] = (r.out[k] ?? 0) + 1;
        rest--;
      }
    }
  }
  return rows.map(({ holder, out }) => ({ holder, troops: Object.fromEntries(Object.entries(out).filter(([, v]) => (v ?? 0) > 0)) }));
}
