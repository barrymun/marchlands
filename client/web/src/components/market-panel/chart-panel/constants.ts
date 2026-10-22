import { CandlePeriod, DAY, HOUR } from '@marchlands/core';

export const RANGE_IDS = ['hour', 'day', 'week', 'month'] as const;
export type RangeId = (typeof RANGE_IDS)[number];

/**
 * The chart's ranges: the length of its candles, how much time it opens on, and how many candles it loads (it can
 * be scrolled back through them all).
 */
export const RANGES: Record<RangeId, { period: CandlePeriod; span: number; limit: number }> = {
  hour: { period: CandlePeriod.MINUTE, span: HOUR, limit: 1440 },
  day: { period: CandlePeriod.HOUR, span: DAY, limit: 720 },
  week: { period: CandlePeriod.HOUR, span: 7 * DAY, limit: 720 },
  month: { period: CandlePeriod.DAY, span: 30 * DAY, limit: 365 },
};
