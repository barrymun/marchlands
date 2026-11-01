import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SettleFlows } from '@marchlands/core';
import type { Db } from '@marchlands/db';

import { startStatsFlusher } from '#/index.ts';
import { addCounters, bufferStats, flushStats, noteSettle, prefixed, type StatCounters, statDay, takeSettle } from '#/stats.ts';

interface Row {
  player_id: number;
  city_id: number;
  period: string;
  counters: StatCounters;
}

const dialect = new PgDialect();

/** A database that records the rows each flush writes (or fails with `fail`). */
function fakeDb(fail?: Error) {
  const flushes: Row[][] = [];
  const execute = vi.fn(async (q: SQL) => {
    if (fail) throw fail;
    flushes.push(JSON.parse(dialect.sqlToQuery(q).params[0] as string));
  });
  return { db: { execute } as unknown as Db, execute, flushes };
}

const sorted = (rows: Row[]) => [...rows].sort((a, b) => a.player_id - b.player_id || a.city_id - b.city_id || a.period.localeCompare(b.period));

const pending = (entries: Record<string, StatCounters>) => new Map(Object.entries(entries));

// the buffer belongs to the module: empty it around every test
const drain = () => flushStats(fakeDb().db);
beforeEach(drain);
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await drain();
});

describe(addCounters.name, () => {
  it('adds into the first set and returns it', () => {
    const into = { a: 1, b: 2 };
    expect(addCounters(into, { a: 2, c: 3 })).toBe(into);
    expect(into).toEqual({ a: 3, b: 2, c: 3 });
  });

  it('multiplies what it adds, and skips zeros', () => {
    expect(addCounters({ a: 1 }, { a: 2, b: 0 }, 3)).toEqual({ a: 7 });
    expect(addCounters({ a: 1 }, { a: 2 }, -1)).toEqual({ a: -1 });
  });
});

describe(prefixed.name, () => {
  it('prefixes each count with its group, skipping zeros and missing counts', () => {
    expect(prefixed('trained', { archer: 5, scout: 0, worker: undefined })).toEqual({ 'trained.archer': 5 });
    expect(prefixed('lost', { archer: 5 }, 2)).toEqual({ 'lost.archer': 10 });
  });

  it('is empty for no counts', () => {
    expect(prefixed('trained', null)).toEqual({});
    expect(prefixed('trained', undefined)).toEqual({});
    expect(prefixed('trained', {})).toEqual({});
  });
});

describe('statDay', () => {
  it('is the UTC day of the time', () => {
    expect(statDay(Date.UTC(2026, 0, 31, 0, 0, 0))).toBe('2026-01-31');
    expect(statDay(Date.UTC(2026, 0, 31, 23, 59, 59, 999))).toBe('2026-01-31');
    expect(statDay(Date.UTC(2026, 1, 1))).toBe('2026-02-01');
  });
});

describe(noteSettle.name, () => {
  const flows = (n: number): SettleFlows => ({
    produced: { gold: 10 * n, food: 20 * n, wood: 0, stone: 0, iron: 0 },
    wasted: { food: n, wood: 0, stone: 0, iron: 0 },
    taxed: { food: 0, wood: 2 * n, stone: 0, iron: 0 },
    upkeep: 3 * n,
    salaries: 4 * n,
    seatUpkeep: { gold: 0, food: 0 },
  });

  it('adds up what settling a city produced and paid until takeSettle takes it, once', () => {
    const city = {};
    noteSettle(city, flows(1), { archer: 2 });
    noteSettle(city, flows(2), {});
    expect(takeSettle(city)).toEqual({
      'produced.gold': 30,
      'produced.food': 60,
      'wasted.food': 3,
      'taxed.wood': 6,
      'upkeep.food': 9,
      'salaries.gold': 12,
      'deserted.archer': 2,
    });
    expect(takeSettle(city)).toBeUndefined();
  });

  it('keeps each city row apart', () => {
    const a = {};
    const b = {};
    noteSettle(a, flows(1), {});
    expect(takeSettle(b)).toBeUndefined();
    expect(takeSettle(a)).toMatchObject({ 'produced.gold': 10 });
  });
});

describe(flushStats.name, () => {
  it('does not touch the database when nothing is buffered', async () => {
    const { db, execute } = fakeDb();
    expect(await flushStats(db)).toBe(0);
    expect(execute).not.toHaveBeenCalled();
  });

  it('writes one row per player, city and day, summing what was buffered, in one statement', async () => {
    bufferStats(pending({ '1|0': { 'wins.npc': 1 }, '1|10': { 'trained.archer': 5 } }), '2026-01-01');
    bufferStats(pending({ '1|0': { 'wins.npc': 2, 'wins.pvp': 1 } }), '2026-01-01');
    bufferStats(pending({ '1|0': { 'wins.npc': 4 }, '2|0': { 'wins.npc': 8 } }), '2026-01-02');
    const { db, execute, flushes } = fakeDb();
    expect(await flushStats(db)).toBe(4);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(sorted(flushes[0]!)).toEqual([
      { player_id: 1, city_id: 0, period: '2026-01-01', counters: { 'wins.npc': 3, 'wins.pvp': 1 } },
      { player_id: 1, city_id: 0, period: '2026-01-02', counters: { 'wins.npc': 4 } },
      { player_id: 1, city_id: 10, period: '2026-01-01', counters: { 'trained.archer': 5 } },
      { player_id: 2, city_id: 0, period: '2026-01-02', counters: { 'wins.npc': 8 } },
    ]);
  });

  it('rounds the counters to whole numbers, dropping those that round to zero', async () => {
    bufferStats(pending({ '1|0': { 'produced.food': 10.4, 'produced.wood': 0.2, 'produced.gold': 2.5 } }), '2026-01-01');
    const { db, flushes } = fakeDb();
    await flushStats(db);
    expect(flushes[0]![0]!.counters).toEqual({ 'produced.food': 10, 'produced.gold': 3 });
  });

  it('empties the buffer once written', async () => {
    bufferStats(pending({ '1|0': { 'wins.npc': 1 } }), '2026-01-01');
    const { db, execute } = fakeDb();
    await flushStats(db);
    expect(await flushStats(db)).toBe(0);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('when the write fails, rethrows and puts the counters back, joining what was buffered meanwhile', async () => {
    bufferStats(pending({ '1|0': { 'wins.npc': 1 } }), '2026-01-01');
    const err = new Error('db down');
    const failing = fakeDb(err);
    const flush = flushStats(failing.db);
    bufferStats(pending({ '1|0': { 'wins.npc': 2 } }), '2026-01-01'); // while the write is under way
    await expect(flush).rejects.toBe(err);

    const { db, flushes } = fakeDb();
    expect(await flushStats(db)).toBe(1);
    expect(flushes[0]).toEqual([{ player_id: 1, city_id: 0, period: '2026-01-01', counters: { 'wins.npc': 3 } }]);
  });
});

describe(startStatsFlusher.name, () => {
  it('flushes every interval, and once more when stopped; then no more', async () => {
    vi.useFakeTimers();
    const { db, execute, flushes } = fakeDb();
    const stop = startStatsFlusher(db, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(execute).not.toHaveBeenCalled(); // nothing buffered yet

    bufferStats(pending({ '1|0': { 'wins.npc': 1 } }), '2026-01-01');
    await vi.advanceTimersByTimeAsync(999);
    expect(flushes).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(flushes).toHaveLength(1);

    bufferStats(pending({ '1|0': { 'wins.npc': 2 } }), '2026-01-01');
    await stop();
    expect(flushes).toHaveLength(2);
    expect(flushes[1]![0]!.counters).toEqual({ 'wins.npc': 2 });

    bufferStats(pending({ '1|0': { 'wins.npc': 3 } }), '2026-01-01');
    await vi.advanceTimersByTimeAsync(5000);
    expect(flushes).toHaveLength(2);
  });

  it('reports failed flushes to onError instead of throwing', async () => {
    vi.useFakeTimers();
    const err = new Error('db down');
    const onError = vi.fn();
    const stop = startStatsFlusher(fakeDb(err).db, 1000, onError);
    bufferStats(pending({ '1|0': { 'wins.npc': 1 } }), '2026-01-01');
    await vi.advanceTimersByTimeAsync(1000);
    expect(onError).toHaveBeenCalledWith(err);
    await expect(stop()).resolves.toBeUndefined();
    expect(onError).toHaveBeenCalledTimes(2);
  });

  it('does not keep the process alive', async () => {
    const timer = { unref: vi.fn() } as unknown as ReturnType<typeof setInterval>;
    vi.spyOn(globalThis, 'setInterval').mockReturnValueOnce(timer);
    const clear = vi.spyOn(globalThis, 'clearInterval').mockImplementationOnce(() => undefined);
    const stop = startStatsFlusher(fakeDb().db, 1000);
    expect(timer.unref).toHaveBeenCalled();
    await stop();
    expect(clear).toHaveBeenCalledWith(timer);
  });
});
