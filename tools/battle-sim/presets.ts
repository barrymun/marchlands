// Named armies from docs/battle-sims. Each is 125,000 troops (Rally Spot 10 with a Imperial Banner).

import type { TroopCounts } from '@marchlands/core';

const layers = { peasants: 1500, militia: 1750, carriage: 3500 };

export const PRESETS: Record<string, TroopCounts> = {
  /** the layered archer wave farmed with until 2026-10-09 */
  'archers-old': { archer: 116500, peasants: 1000, militia: 1000, pikemen: 1000, swordsmen: 1000, scouter: 1000, carriage: 3500 },
  /** the best army found for level 10 barbarian cities */
  'archers-best': { archer: 118250, ...layers },
  militia: { militia: 121500, carriage: 3500 },
  swordsmen: { swordsmen: 121500, carriage: 3500 },
  pikemen: { pikemen: 121500, carriage: 3500 },
  'light-cavalry': { lightCavalry: 118250, ...layers },
  'heavy-cavalry': { heavyCavalry: 118250, ...layers },
  ballista: { ballista: 118250, ...layers },
  catapult: { catapult: 118250, ...layers },
};
