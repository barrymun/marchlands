// Siege plans for historic cities (siege.ts): Age 2 players' plans from docs/reference/historic-cities.md, Taking one,
// and our own. Troop keys: militia are warriors, peasants workers, scouter scouts, carriage transporters.

import type { TroopCounts } from '@marchlands/core';
import type { Plan } from './siege.ts';

/** One of each type as a thin layer, so traps and towers spread their hits (`n` of each). */
const layers = (n: number, ...keys: (keyof TroopCounts)[]): TroopCounts => Object.fromEntries(keys.map((k) => [k, n]));

/** Loyalty waves: archers with warriors as a shield (sources 11 and 13). */
const loyaltyWave: TroopCounts = { archer: 20_000, militia: 20_000 };

export const PLANS: Record<string, Plan> = {
  /** Source 11: trap waves, then a wave against each troop type in the order they fight, then loyalty waves. */
  'age2-staged': {
    name: 'Age 2, staged (source 11)',
    gap: 1,
    stages: [
      { name: 'traps', troops: { militia: 3_000 }, waves: 30 },
      { name: 'cavalry', troops: { pikemen: 90_000, militia: 10_000 }, waves: 2 },
      { name: 'pikemen', troops: { archer: 80_000, pikemen: 10_000, ...layers(1_000, 'peasants', 'militia', 'swordsmen') }, waves: 1 },
      { name: 'archers', troops: { archer: 95_000 }, waves: 3 },
      { name: 'break', troops: { archer: 95_000, ...layers(1_000, 'peasants', 'militia', 'scouter', 'swordsmen', 'pikemen') }, until: 'broken', max: 40 },
      { name: 'loyalty', troops: loyaltyWave, until: 'captured', max: 100 },
    ],
  },
  /** Source 13 for heroes of 300-350 attack: warriors and pikemen against the cavalry, then layered archers. */
  'age2-layered': {
    name: 'Age 2, layered archers (source 13)',
    gap: 1,
    stages: [
      { name: 'cavalry', troops: { militia: 76_000, pikemen: 24_000 }, waves: 5 },
      { name: 'archers', troops: { archer: 96_000, pikemen: 2_000, swordsmen: 2_000 }, waves: 2 },
      {
        name: 'break',
        troops: { archer: 95_000, ...layers(1_000, 'peasants', 'militia', 'scouter', 'swordsmen'), ...layers(500, 'lightCavalry', 'heavyCavalry') },
        until: 'broken',
        max: 40,
      },
      { name: 'loyalty', troops: loyaltyWave, until: 'captured', max: 100 },
    ],
  },
  /** Source 13 for heroes of 500+ attack: one ballista wave, archers to clean up, then loyalty waves. */
  'age2-ballista': {
    name: 'Age 2, ballistae (source 13)',
    gap: 1,
    stages: [
      { name: 'ballistae', troops: { ballista: 117_000, ...layers(1_000, 'peasants', 'militia', 'scouter', 'pikemen', 'swordsmen', 'archer') }, waves: 1 },
      { name: 'break', troops: { archer: 95_000 }, until: 'broken', max: 40 },
      { name: 'loyalty', troops: loyaltyWave, until: 'captured', max: 100 },
    ],
  },
  /** Source 9: many small warrior waves for the traps, then big archer waves, then small loyalty waves. */
  'age2-hnt': {
    name: 'Age 2, trap waves and big archer waves (source 9)',
    gap: 1,
    stages: [
      { name: 'traps', troops: { militia: 7_500 }, waves: 40 },
      { name: 'break', troops: { archer: 120_000, ...layers(1_000, 'peasants', 'militia', 'swordsmen', 'pikemen', 'scouter') }, until: 'broken', max: 40 },
      { name: 'loyalty', troops: { archer: 5_000, militia: 10_000 }, until: 'captured', max: 100 },
    ],
  },
  /** Our best army against level 10 barbarian cities (docs/battle-sims/npc-level-10.md), without its transporters. */
  'archers-best': {
    name: 'The level 10 farming army, wave after wave',
    gap: 1,
    stages: [
      { name: 'break', troops: { archer: 121_750, peasants: 1_500, militia: 1_750 }, until: 'broken', max: 150 },
      { name: 'loyalty', troops: loyaltyWave, until: 'captured', max: 100 },
    ],
  },
  /**
   * The whole siege in one wave plan, every wave landing a millisecond after the last (`--gap 0.001`): nothing refills,
   * so loyalty waves of archers alone lose almost nothing (docs/battle-sims/historic-cities.md, One landing second).
   */
  'one-second': {
    name: 'The farming army, then small archer waves, all in one landing second',
    gap: 0.001,
    stages: [
      { name: 'break', troops: { archer: 121_750, peasants: 1_500, militia: 1_750 }, until: 'broken', max: 150 },
      { name: 'loyalty', troops: { archer: 5_000 }, until: 'captured', max: 100 },
    ],
  },
  /**
   * `one-second` with the breaking waves' 3,250 warriors and workers swapped for 1,000 each of five foot types, which
   * spread the garrison's hits better: fewer breaking waves at level 18 (docs/battle-sims/historic-cities.md, Atlantis).
   */
  'one-second-layered': {
    name: 'Archers in five thin layers, then small archer waves, all in one landing second',
    gap: 0.001,
    stages: [
      { name: 'break', troops: { archer: 120_000, ...layers(1_000, 'peasants', 'militia', 'scouter', 'swordsmen', 'pikemen') }, until: 'broken', max: 150 },
      { name: 'loyalty', troops: { archer: 1_000 }, until: 'captured', max: 100 },
    ],
  },
  /**
   * Siege engines first: the city's own archers, ballistae and catapults have no Archery research, so attacking
   * catapults outrange its whole garrison; then archers in thin layers, every wave full so nothing small meets what's
   * left (docs/battle-sims/historic-cities.md, Atlantis in one landing second).
   */
  'one-second-catapults': {
    name: 'Catapults until the garrison breaks, then layered archers, all in one landing second',
    gap: 0.001,
    stages: [
      { name: 'catapults', troops: { catapult: 125_000 }, until: 'broken', max: 150 },
      { name: 'loyalty', troops: { archer: 120_000, ...layers(1_000, 'peasants', 'militia', 'scouter', 'swordsmen', 'pikemen') }, until: 'captured', max: 100 },
    ],
  },
  /** For a day with cataphracts, which ride down archers: pikemen first until they're gone (AeroAgg's table), then archers. */
  'pikes-archers': {
    name: 'Pikemen until the cataphracts are gone, then the farming army',
    gap: 1,
    stages: [
      { name: 'pikemen', troops: { pikemen: 125_000 }, until: 'cleared', target: 'heavyCavalry', max: 30 },
      { name: 'break', troops: { archer: 121_750, peasants: 1_500, militia: 1_750 }, until: 'broken', max: 150 },
      { name: 'loyalty', troops: loyaltyWave, until: 'captured', max: 100 },
    ],
  },
};
