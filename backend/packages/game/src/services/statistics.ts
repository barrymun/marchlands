// (marchlands) Reading lord statistics: the player_stats rows (written in batches by stats.ts),
// summed for all time and the last 7 days, for the lord and per city.

import { eq, sql } from 'drizzle-orm';

import { pgArray, worldState } from '@marchlands/db';

import type { Ctx } from '#/context.ts';
import { type StatCounters, statDay } from '#/stats.ts';

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

  const owned = await ctx.tx.execute<{ id: number; name: string; player_id: number }>(sql`
    select id, name, player_id from cities where player_id = ${playerId} or id = any(${pgArray([...perCity.keys()])}::int[]) order by id`);
  const cities = owned.rows.map((c) => ({
    cityId: Number(c.id),
    name: Number(c.player_id) === playerId ? c.name : null,
    owned: Number(c.player_id) === playerId,
    ...(perCity.get(Number(c.id)) ?? { allTime: {}, last7Days: {} }),
  }));
  // cities that no longer exist
  for (const [cityId, c] of perCity) if (!cities.some((x) => x.cityId === cityId)) cities.push({ cityId, name: null, owned: false, ...c });
  const [started] = await ctx.tx.select().from(worldState).where(eq(worldState.key, 'statsStartedAt'));
  const since = started ? Number((started.value as { at: number }).at) : null;
  return { allTime, last7Days, cities, since };
}
