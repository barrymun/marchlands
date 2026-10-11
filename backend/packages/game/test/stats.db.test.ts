import { describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { playerStats, type Db } from '@marchlands/db';
import { bufferStats, compactStats, flushStats, statDay, type StatCounters } from '../src/index.ts';
import { createTestPlayer } from './support/factories.ts';
import { T0 } from './support/game.ts';
import { arrange, inTestTx } from './support/tx.ts';

/** A player with no statistics yet (what making it buffered is flushed and cleared). */
async function freshPlayer(db: Db) {
  const p = await arrange(db, (g) => createTestPlayer(g), T0);
  await flushStats(db);
  await db.delete(playerStats).where(eq(playerStats.playerId, p.id));
  return p;
}

const rowsOf = async (db: Db, ...playerIds: number[]) =>
  (await db.select().from(playerStats).where(inArray(playerStats.playerId, playerIds))).sort(
    (a, b) => a.playerId - b.playerId || a.cityId - b.cityId || a.period.localeCompare(b.period),
  );

const put = (db: Db, playerId: number, cityId: number, period: string, counters: StatCounters) =>
  db.insert(playerStats).values({ playerId, cityId, period, counters });

describe(flushStats.name, () => {
  it('inserts new rows and adds to existing ones', () =>
    inTestTx(async (db) => {
      const p = await freshPlayer(db);
      const day = statDay(T0);
      await put(db, p.id, 0, day, { 'wins.npc': 1, 'wins.pvp': 2 });
      bufferStats(new Map([[`${p.id}|0`, { 'wins.npc': 2, 'trained.archer': 4 }]]), day);
      bufferStats(new Map([[`${p.id}|${p.cityId}`, { 'produced.food': 99.6 }]]), day);
      expect(await flushStats(db)).toBe(2);
      expect(await rowsOf(db, p.id)).toEqual([
        { playerId: p.id, cityId: 0, period: day, counters: { 'wins.npc': 3, 'wins.pvp': 2, 'trained.archer': 4 } },
        { playerId: p.id, cityId: p.cityId, period: day, counters: { 'produced.food': 100 } },
      ]);
    }));

  it('drops the counters of a player that no longer exists', () =>
    inTestTx(async (db) => {
      const p = await freshPlayer(db);
      const gone = 2_000_000_000;
      bufferStats(
        new Map([
          [`${gone}|0`, { 'wins.npc': 1 }],
          [`${p.id}|0`, { 'wins.npc': 1 }],
        ]),
        statDay(T0),
      );
      await flushStats(db);
      expect(await rowsOf(db, gone)).toEqual([]);
      expect(await rowsOf(db, p.id)).toHaveLength(1);
      expect(await flushStats(db)).toBe(0); // and does not keep them
    }));
});

describe(compactStats.name, () => {
  it('folds daily rows older than keepDays into one row per month, summing them, and keeps the recent days', () =>
    inTestTx(async (db) => {
      const p = await freshPlayer(db);
      const now = Date.UTC(2026, 3, 15, 12); // 2026-04-15: 60 days before is 2026-02-14
      await put(db, p.id, 0, '2026-01-10', { 'wins.npc': 1, 'trained.archer': 2 });
      await put(db, p.id, 0, '2026-01-31', { 'wins.npc': 3 });
      await put(db, p.id, 0, '2026-02-13', { 'wins.npc': 5 });
      await put(db, p.id, 0, '2026-02-14', { 'wins.npc': 7 }); // the 60th day: kept
      await put(db, p.id, 0, '2026-04-15', { 'wins.npc': 11 });
      await put(db, p.id, p.cityId, '2026-01-10', { 'produced.food': 100 });
      await put(db, p.id, 0, '2025-12', { 'wins.npc': 1000 }); // an earlier compacted month: left alone

      expect(await compactStats(db, now)).toBe(3);
      expect(await rowsOf(db, p.id)).toEqual([
        { playerId: p.id, cityId: 0, period: '2025-12', counters: { 'wins.npc': 1000 } },
        { playerId: p.id, cityId: 0, period: '2026-01', counters: { 'wins.npc': 4, 'trained.archer': 2 } },
        { playerId: p.id, cityId: 0, period: '2026-02', counters: { 'wins.npc': 5 } },
        { playerId: p.id, cityId: 0, period: '2026-02-14', counters: { 'wins.npc': 7 } },
        { playerId: p.id, cityId: 0, period: '2026-04-15', counters: { 'wins.npc': 11 } },
        { playerId: p.id, cityId: p.cityId, period: '2026-01', counters: { 'produced.food': 100 } },
      ]);
      expect(await compactStats(db, now)).toBe(0); // nothing left to fold
    }));

  it('adds into a month already compacted, and keeps players apart', () =>
    inTestTx(async (db) => {
      const a = await freshPlayer(db);
      const b = await freshPlayer(db);
      const now = Date.UTC(2026, 5, 1);
      await put(db, a.id, 0, '2026-01', { 'wins.npc': 10 });
      await put(db, a.id, 0, '2026-01-05', { 'wins.npc': 1, 'wins.pvp': 1 });
      await put(db, b.id, 0, '2026-01-05', { 'wins.npc': 2 });
      expect(await compactStats(db, now)).toBe(2);
      expect(await rowsOf(db, a.id, b.id)).toEqual([
        { playerId: a.id, cityId: 0, period: '2026-01', counters: { 'wins.npc': 11, 'wins.pvp': 1 } },
        { playerId: b.id, cityId: 0, period: '2026-01', counters: { 'wins.npc': 2 } },
      ]);
    }));

  it('keepDays sets how many days stay daily', () =>
    inTestTx(async (db) => {
      const p = await freshPlayer(db);
      const now = Date.UTC(2026, 0, 31);
      await put(db, p.id, 0, '2026-01-20', { 'wins.npc': 1 });
      await put(db, p.id, 0, '2026-01-21', { 'wins.npc': 2 });
      expect(await compactStats(db, now, 10)).toBe(1);
      expect((await rowsOf(db, p.id)).map((r) => [r.period, r.counters])).toEqual([
        ['2026-01', { 'wins.npc': 1 }],
        ['2026-01-21', { 'wins.npc': 2 }],
      ]);
    }));
});
