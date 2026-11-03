// (marchlands) Reading lord statistics: the player_stats rows (written in batches by stats.ts),
// summed for all time and the last 7 days, for the lord and per city, and the headline numbers day by
// day over the last TREND_DAYS days (core trends.ts).

import { eq, sql } from 'drizzle-orm';

import { TREND_COUNTERS, TREND_KEYS, trendDays, type TrendKey, trendOf } from '@marchlands/core';
import { pgArray, worldState } from '@marchlands/db';

import type { Ctx } from '#/context.ts';
import { type StatCounters, statDay } from '#/stats.ts';

/** A trend line of nothing for each headline number. */
const noTrend = (days: number): Record<TrendKey, number[]> =>
  Object.fromEntries(TREND_KEYS.map((k) => [k, Array.from({ length: days }, () => 0)])) as Record<TrendKey, number[]>;

/**
 * The headline numbers day by day over `days` (UTC, oldest first), for the lord and per city: only the counters the
 * trends add up (`TREND_COUNTERS`), from the daily rows (months are folded long before).
 */
async function trends(ctx: Ctx, playerId: number, days: string[]) {
  const patterns = TREND_KEYS.flatMap((k) => TREND_COUNTERS[k].map((c) => (c.endsWith('.') ? `${c}%` : c)));
  const rows = await ctx.tx.execute<{ city_id: number; period: string; key: string; v: string }>(sql`
    select ps.city_id, ps.period, e.key, sum(e.value::numeric)::text as v
    from player_stats ps, jsonb_each_text(ps.counters) e
    where ps.player_id = ${playerId} and ps.period >= ${days[0] ?? ''} and e.key like any(${pgArray(patterns)}::text[])
    group by 1, 2, 3`);
  const lord = noTrend(days.length);
  const perCity = new Map<number, Record<TrendKey, number[]>>();
  for (const r of rows.rows) {
    const key = trendOf(r.key);
    const day = days.indexOf(r.period);
    if (!key || day < 0) continue;
    const v = Number(r.v);
    lord[key][day] = (lord[key][day] ?? 0) + v;
    const cityId = Number(r.city_id);
    if (!cityId) continue;
    const city = perCity.get(cityId) ?? noTrend(days.length);
    city[key][day] = (city[key][day] ?? 0) + v;
    perCity.set(cityId, city);
  }
  return { lord, perCity };
}

export async function lordStatistics(ctx: Ctx, playerId: number) {
  const since7 = statDay(ctx.now - 6 * 86_400_000);
  const rows = await ctx.tx.execute<{ city_id: number; recent: boolean; key: string; v: string }>(sql`
    select ps.city_id, ps.period >= ${since7} as recent, e.key, sum(e.value::numeric)::text as v
    from player_stats ps, jsonb_each_text(ps.counters) e
    where ps.player_id = ${playerId}
    group by 1, 2, 3`);

  const allTime: StatCounters = {};
  const last7Days: StatCounters = {};
  const perCity = new Map<number, { allTime: StatCounters; last7Days: StatCounters }>();
  const add = (c: StatCounters, k: string, v: number) => (c[k] = (c[k] ?? 0) + v);
  for (const r of rows.rows) {
    const v = Number(r.v);
    const cityId = Number(r.city_id);
    add(allTime, r.key, v);
    if (r.recent) add(last7Days, r.key, v);
    if (!cityId) continue;
    const c = perCity.get(cityId) ?? { allTime: {}, last7Days: {} };
    add(c.allTime, r.key, v);
    if (r.recent) add(c.last7Days, r.key, v);
    perCity.set(cityId, c);
  }

  const days = trendDays(ctx.now);
  const trend = await trends(ctx, playerId, days);

  const owned = await ctx.tx.execute<{ id: number; name: string; player_id: number }>(sql`
    select id, name, player_id from cities where player_id = ${playerId} or id = any(${pgArray([...perCity.keys()])}::int[]) order by id`);
  const cities = owned.rows.map((c) => ({
    cityId: Number(c.id),
    name: Number(c.player_id) === playerId ? c.name : null,
    owned: Number(c.player_id) === playerId,
    ...(perCity.get(Number(c.id)) ?? { allTime: {}, last7Days: {} }),
    trend: trend.perCity.get(Number(c.id)) ?? noTrend(days.length),
  }));
  // cities that no longer exist
  for (const [cityId, c] of perCity)
    if (!cities.some((x) => x.cityId === cityId))
      cities.push({ cityId, name: null, owned: false, ...c, trend: trend.perCity.get(cityId) ?? noTrend(days.length) });
  const [started] = await ctx.tx.select().from(worldState).where(eq(worldState.key, 'statsStartedAt'));
  const since = started ? Number((started.value as { at: number }).at) : null;
  return { allTime, last7Days, cities, since, days, trend: trend.lord };
}
