// Historic cities (docs/features/historical-cities.md): where they stand on the map, their garrisons, research and
// defending hero, and the troops that change with the day. Numbers live in BALANCE.historic.

import { BALANCE } from '#/balance.ts';
import { TechType } from '#/constants.ts';
import { pick, seededRng } from '#/rng.ts';
import type { FortCounts, ResearchState, TroopCounts } from '#/types.ts';

export const HISTORIC_LEVELS = [12, 14, 16, 18] as const;
export type HistoricLevel = (typeof HISTORIC_LEVELS)[number];

/** The troops that change each day: one of each pair, and one of the three siege engines. */
export interface HistoricDay {
  foot: 'pikemen' | 'swordsmen';
  horse: 'lightCavalry' | 'heavyCavalry';
  siege: 'batteringRam' | 'ballista' | 'catapult';
}

/**
 * The historic city's level at a map position, or null (docs/reference/historic-cities.md). Atlantis (18) at (0, 0);
 * each state's capital (16) in its middle; level 14s every 66 tiles from 33 across the whole map, three to a state
 * each way, but none in a state's middle place, by its capital; and level 12s every 18 tiles from 9, also across the
 * whole map (44 × 44 = 1,936), which puts one in each of those middle places.
 */
export function historicLevelAt(x: number, y: number, mapSize: number = BALANCE.mapSize): HistoricLevel | null {
  if (x === 0 && y === 0) return 18;
  const cell = mapSize / BALANCE.stateGrid;
  if (x % cell === cell / 2 && y % cell === cell / 2) return 16;
  const on14 = (v: number) => v >= 33 && (v - 33) % 66 === 0;
  // every third place of the level 14 grid is a state's middle one: a level 12 stands there instead
  const middle = (v: number) => ((v - 33) / 66) % 3 === 1;
  if (on14(x) && on14(y) && !(middle(x) && middle(y))) return 14;
  const on12 = (v: number) => v >= 9 && (v - 9) % 18 === 0;
  return on12(x) && on12(y) ? 12 : null;
}

/** Every historic city's position and level on a map. */
export function historicCities(mapSize: number = BALANCE.mapSize): { x: number; y: number; level: HistoricLevel }[] {
  const out: { x: number; y: number; level: HistoricLevel }[] = [];
  for (let y = 0; y < mapSize; y++)
    for (let x = 0; x < mapSize; x++) {
      const level = historicLevelAt(x, y, mapSize);
      if (level) out.push({ x, y, level });
    }
  return out;
}

/** The garrison a historic city keeps on a given day (a day is a UTC day, `Math.floor(ms / DAY)`), seeded by the tile. */
export function historicDay(tileId: number, day: number): HistoricDay {
  const rng = seededRng(`historic-day:${tileId}:${day}`);
  return {
    foot: pick(rng, ['pikemen', 'swordsmen'] as const),
    horse: pick(rng, ['lightCavalry', 'heavyCavalry'] as const),
    siege: pick(rng, ['batteringRam', 'ballista', 'catapult'] as const),
  };
}

/** A historic city's full garrison and fortifications on a day. */
export function historicGarrison(level: HistoricLevel, day: HistoricDay): { troops: TroopCounts; forts: FortCounts } {
  const [warriors, foot, archers, horse, siege] = BALANCE.historic.troops[level];
  return { troops: { militia: warriors, [day.foot]: foot, archer: archers, [day.horse]: horse, [day.siege]: siege }, forts: { ...BALANCE.historic.forts } };
}

/** A historic city's research: every research at BALANCE.historic.researchLevel (or `level`) but Archery, at 0. */
export function historicResearch(level: number = BALANCE.historic.researchLevel): ResearchState {
  const r: ResearchState = {};
  for (const id of Object.values(TechType)) r[id] = { level: id === TechType.ARCHERY ? 0 : level };
  return r;
}

/** The defending hero's Attack and Intelligence. */
export const historicHeroStats = (level: HistoricLevel) => BALANCE.historic.hero[level];

/** The most troops one army may hold when sent from a held historic city: a quarter more a level step above 10. */
export const historicRallyBonus = (level: HistoricLevel) => ((level - 10) / 2) * BALANCE.historic.rallyBonusPerStep;
