// (marchlands) Lord statistics. Game operations add counters with ctx.stat() as they go; a committed
// operation's counters join an in-memory buffer of this process, which flushStats() writes to
// player_stats in one batched upsert every few minutes (and on shutdown). Nothing is recomputed and
// the hot path never touches the database; a crash can lose the last few minutes of counters.
//
// Counter keys are `group.detail`, e.g. trained.archer, killed.trap, produced.food, wins.npc
// (StatGroup and StatCounter, shared/core stats.ts, name them).

import { sql } from 'drizzle-orm';
import { type SettleFlows, StatCounter, StatGroup, type TroopCounts } from '@marchlands/core';
import type { Db } from '@marchlands/db';

export type StatCounters = Record<string, number>;

/** Add `add` (times `mult`) into `into`, skipping zeros. */
export function addCounters(into: StatCounters, add: StatCounters, mult = 1): StatCounters {
  for (const [k, v] of Object.entries(add)) if (v) into[k] = (into[k] ?? 0) + v * mult;
  return into;
}

/** `{ archer: 5 }` -> `{ 'trained.archer': 5 }`. */
export function prefixed(group: StatGroup, counts: Partial<Record<string, number>> | null | undefined, mult = 1): StatCounters {
  const out: StatCounters = {};
  for (const [k, v] of Object.entries(counts ?? {})) if (v) out[`${group}.${k}`] = v * mult;
  return out;
}

/** UTC day of a timestamp: the period counters are kept by. */
export const statDay = (now: number) => new Date(now).toISOString().slice(0, 10);

// ---- settled production (counted when the settled city is saved) ----

const settled = new WeakMap<object, StatCounters>();

/** Remember what settling a city produced and paid, until the city row is saved (saveCity). */
export function noteSettle(city: object, flows: SettleFlows, deserted: TroopCounts) {
  const c = settled.get(city) ?? {};
  addCounters(c, prefixed(StatGroup.PRODUCED, flows.produced));
  addCounters(c, prefixed(StatGroup.WASTED, flows.wasted));
  addCounters(c, prefixed(StatGroup.TAXED, flows.taxed));
  addCounters(c, { [StatCounter.UPKEEP_FOOD]: flows.upkeep, [StatCounter.SALARIES_GOLD]: flows.salaries });
  addCounters(c, prefixed(StatGroup.DESERTED, deserted));
  settled.set(city, c);
}

/** The settle counters of a city row being saved (then forgotten, so they count once). */
export function takeSettle(city: object): StatCounters | undefined {
  const c = settled.get(city);
  settled.delete(city);
  return c;
}

// ---- process buffer ----

const buffer = new Map<string, StatCounters>();

/** Merge a committed operation's counters (key `playerId|cityId`) into the buffer under `day`. */
export function bufferStats(pending: Map<string, StatCounters>, day: string) {
  for (const [key, counters] of pending) {
    const k = `${key}|${day}`;
    buffer.set(k, addCounters(buffer.get(k) ?? {}, counters));
  }
}

/**
 * Write the buffer to player_stats in one statement; on failure the counters go back in.
 * @internal exported for tests; the worker and API flush through startStatsFlusher
 */
export async function flushStats(db: Db): Promise<number> {
  if (!buffer.size) return 0;
  const rows = [...buffer.entries()].map(([k, counters]) => {
    const [playerId, cityId, period] = k.split('|');
    const rounded: StatCounters = {};
    for (const [key, v] of Object.entries(counters)) {
      const n = Math.round(v);
      if (n) rounded[key] = n;
    }
    return { player_id: Number(playerId), city_id: Number(cityId), period, counters: rounded };
  });
  buffer.clear();
  try {
    await db.execute(sql`
      insert into player_stats (player_id, city_id, period, counters)
      select x.player_id, x.city_id, x.period, x.counters
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as x(player_id int, city_id int, period text, counters jsonb)
      where exists (select 1 from players p where p.id = x.player_id)
      on conflict (player_id, city_id, period) do update set counters = stats_add(player_stats.counters, excluded.counters)`);
  } catch (err) {
    for (const r of rows) {
      const k = `${r.player_id}|${r.city_id}|${r.period}`;
      buffer.set(k, addCounters(buffer.get(k) ?? {}, r.counters));
    }
    throw err;
  }
  return rows.length;
}

/** Flush the buffer every `ms`; the returned function stops the timer and flushes what is left. */
export function startStatsFlusher(db: Db, ms: number, onError: (err: unknown) => void = () => {}): () => Promise<void> {
  const timer = setInterval(() => void flushStats(db).catch(onError), ms);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await flushStats(db).catch(onError);
  };
}

/** Fold daily rows older than `keepDays` into one row per month (period 'YYYY-MM'); returns the months written. */
export async function compactStats(db: Db, now: number, keepDays = 60): Promise<number> {
  const before = statDay(now - keepDays * 86_400_000);
  const r = await db.execute<{ n: number }>(sql`
    with old as (
      delete from player_stats where length(period) = 10 and period < ${before}
      returning player_id, city_id, left(period, 7) as month, counters
    ), months as (
      select player_id, city_id, month, jsonb_object_agg(k, v) as counters
      from (
        select o.player_id, o.city_id, o.month, e.key as k, sum(e.value::numeric) as v
        from old o, jsonb_each_text(o.counters) e
        group by 1, 2, 3, 4
      ) sums
      group by 1, 2, 3
    ), ins as (
      insert into player_stats (player_id, city_id, period, counters)
      select player_id, city_id, month, counters from months
      on conflict (player_id, city_id, period) do update set counters = stats_add(player_stats.counters, excluded.counters)
      returning 1
    )
    select count(*)::int as n from ins`);
  return r.rows[0]?.n ?? 0;
}
