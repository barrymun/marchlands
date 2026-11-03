import { HISTORIC_LEVELS, type HistoricLevel } from '@marchlands/core';
import type { Counters } from '@/components/stats-panel/types';

/** The barbarian city levels a player can beat, 1 to 10. */
const BARBARIAN_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * The levels the player has won at, lowest first: barbarian cities 1 to 10, then historic cities (`historic` is set),
 * which count in the same `npcWins.<level>` counters.
 */
export function winsByLevel(c: Counters): { level: number; wins: number; historic: HistoricLevel | null }[] {
  return [
    ...BARBARIAN_LEVELS.map((level) => ({ level, wins: c[`npcWins.${level}`] ?? 0, historic: null })),
    ...HISTORIC_LEVELS.map((level) => ({ level, wins: c[`npcWins.${level}`] ?? 0, historic: level })),
  ].filter((x) => x.wins > 0);
}
