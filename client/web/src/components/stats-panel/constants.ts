import { param, type SearchSchema } from '@/lib/search-state';

/** The periods the statistics are counted over. */
export const StatsPeriod = { ALL_TIME: 'allTime', LAST_7_DAYS: 'last7Days' } as const;
export type StatsPeriod = (typeof StatsPeriod)[keyof typeof StatsPeriod];

/** The city picker's value for every city (a Select item can't have an empty value). */
export const ALL_CITIES = 'all';

/** The page's place in the address (lib/search-state.ts): the city (none for all of them) and the period. */
export const STATS_SEARCH = {
  city: param.id(),
  period: param.oneOf(Object.values(StatsPeriod), StatsPeriod.ALL_TIME),
} satisfies SearchSchema;

/** A counter's group for a unit type (`trained.archer`), and `DIED`, worked out from the fallen and the injured (`unitCount`). */
export const UnitGroup = {
  TRAINED: 'trained',
  KILLED: 'killed',
  DIED: 'died',
  INJURED: 'injured',
  HEALED: 'healed',
  DESERTED: 'deserted',
  DISBANDED: 'disbanded',
} as const;
export type UnitGroup = (typeof UnitGroup)[keyof typeof UnitGroup];
