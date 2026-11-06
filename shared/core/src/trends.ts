// (marchlands) The statistics page's trend lines: a few headline numbers counted day by day (UTC), from the same
// counters as the totals (backend stats.ts). The API sends the last TREND_DAYS days of each.

import { StatCounter, StatGroup, statPrefix } from '#/stats.ts';

/** The headline numbers sent day by day. */
export const TrendKey = {
  ATTACKS_WON: 'attacksWon',
  DEFENSES_WON: 'defensesWon',
  HONOR: 'honor',
  ENEMIES: 'enemies',
  TRAINED: 'trained',
  CAPTURED: 'captured',
} as const;
export type TrendKey = (typeof TrendKey)[keyof typeof TrendKey];
export const TREND_KEYS = Object.values(TrendKey) as [TrendKey, ...TrendKey[]];

/** The counters each trend adds up: one ending in `.` takes every counter that starts with it, any other that counter alone. */
export const TREND_COUNTERS: Record<TrendKey, readonly string[]> = {
  attacksWon: [statPrefix(StatGroup.ATTACKS_WON)],
  defensesWon: [statPrefix(StatGroup.DEFENSES_WON)],
  honor: [StatCounter.HONOR],
  enemies: [statPrefix(StatGroup.KILLED)],
  trained: [statPrefix(StatGroup.TRAINED)],
  captured: [StatCounter.CAPTURED_CITY, StatCounter.CAPTURED_NPC],
};

/**
 * How many UTC days the trend lines cover, today included. Within the days the stats job keeps day by day before
 * folding them into months (compactStats, 60).
 */
export const TREND_DAYS = 30;

/** The trend a counter counts in, if any. */
export function trendOf(counter: string): TrendKey | null {
  for (const key of TREND_KEYS) {
    if (TREND_COUNTERS[key].some((c) => (c.endsWith('.') ? counter.startsWith(c) : counter === c))) return key;
  }
  return null;
}

/** The UTC days a trend covers, oldest first, ending on the day of `now` ('2026-11-03'). */
export function trendDays(now: number): string[] {
  return Array.from({ length: TREND_DAYS }, (_, i) => new Date(now - (TREND_DAYS - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}
