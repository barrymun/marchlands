// processOne against the real database. It commits through runGame, so each test gives it the open test
// transaction as its database (AGENTS.md, Backend tests): runGame's transaction becomes a savepoint and the whole
// test is rolled back at the end, like the API tests (backend/services/api/test/support/api.ts).
//
// The failure path runs a second statement on `db` after runGame failed. In production that is the pool, and the
// game transaction has been rolled back, so the update sees the event row as it was before the claim. With the test
// transaction as `db`, the failed game transaction is a savepoint rolled back to the same point (the claim's delete
// and the handler's writes undone, an aborted transaction made usable again), and the update runs in the test
// transaction: it sees the same row and leaves the same result.

import { eq, sql } from 'drizzle-orm';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { BuffId, msg } from '@marchlands/core';
import { type Db, pushMessages, timedEvents } from '@marchlands/db';
import { testDb } from '@marchlands/db/test/support/db.ts';
import { type Ctx, runGame } from '@marchlands/game';
import { createTestPlayer, type TestPlayer } from '@marchlands/game/test/support/factories.ts';
import type { TestGame } from '@marchlands/game/test/support/game.ts';
import { getPlayer, savePlayer, setBuff } from '@marchlands/game/testing';

import { type Log, MAX_ATTEMPTS, processOne } from '#/worker.ts';

// thrown to roll the test's transaction back, then caught here
const ROLLBACK = new Error('rollback');

/** Run `fn` with the test transaction as the worker's database, rolled back afterwards. */
async function workerTest(fn: (db: Db, log: Mock<Log>) => Promise<void>) {
  try {
    await testDb().transaction(async (tx) => {
      const db = tx as unknown as Db;
      // every test starts from the seeded world, which has no timed events
      expect(await db.select().from(timedEvents)).toEqual([]);
      await fn(db, vi.fn<Log>());
      throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
}

/** A timed event row as the game would have queued it (attempts and last_error as given). */
async function addEvent(db: Db, ev: { type: string; dueAt: number; playerId?: number; refKey?: string; payload?: Record<string, unknown>; attempts?: number }) {
  const [row] = await db
    .insert(timedEvents)
    .values({ payload: {}, ...ev, createdAt: Date.now() })
    .returning();
  return row;
}

const eventRow = async (db: Db, id: number) => (await db.select().from(timedEvents).where(eq(timedEvents.id, id)))[0];

/** A player with an Attack buff ending at `endTime`; setBuff queues its buff.expire event (ref key buff:<id>:AttackBuff). */
async function playerWithBuff(db: Db, endTime: number): Promise<TestPlayer> {
  return runGame(
    db,
    async (ctx: Ctx) => {
      const p = await createTestPlayer(ctx as TestGame);
      const row = await getPlayer(ctx, p.id, { lock: true });
      setBuff(ctx, row, BuffId.ATTACK, msg('buff.truceCooldown'), endTime);
      await savePlayer(ctx, row);
      return p;
    },
    { now: endTime - 60_000 },
  );
}

const buffKey = (p: TestPlayer) => `buff:${p.id}:${BuffId.ATTACK}`;

describe(processOne.name, () => {
  it('is idle when no event is due, and leaves events in the future alone', () =>
    workerTest(async (db, log) => {
      expect(await processOne(db, { log })).toBe(false);

      const later = await addEvent(db, { type: 'unknown.type', dueAt: Date.now() + 60_000 });
      expect(await processOne(db, { log })).toBe(false);
      expect(await eventRow(db, later.id)).toEqual(later);
      expect(log).not.toHaveBeenCalled();
    }));

  it('processes a due event in a game transaction: the handler runs, the row is gone and its pushes are queued', () =>
    workerTest(async (db, log) => {
      const p = await playerWithBuff(db, Date.now() - 1000);
      const [ev] = await db
        .select()
        .from(timedEvents)
        .where(eq(timedEvents.refKey, buffKey(p)));
      expect(ev).toMatchObject({ type: 'buff.expire', playerId: p.id, payload: { buffId: BuffId.ATTACK } });
      const pushesBefore = (await db.select().from(pushMessages)).length;

      expect(await processOne(db, { log })).toBe(true);

      expect(await eventRow(db, ev.id)).toBeUndefined();
      const player = await runGame(db, (ctx) => getPlayer(ctx, p.id));
      expect(player.buffs.map((b) => b.id)).not.toContain(BuffId.ATTACK);
      // the buff update and the player info were flushed to the outbox with the state
      expect((await db.select().from(pushMessages)).length).toBeGreaterThan(pushesBefore);
      expect(log).not.toHaveBeenCalled();
      // nothing else was due
      expect(await processOne(db, { log })).toBe(false);
    }));

  it('takes the event that fell due first', () =>
    workerTest(async (db, log) => {
      const now = Date.now();
      // buff.expire with an unknown buff id is a no-op: the event is consumed and nothing else changes
      const second = await addEvent(db, { type: 'buff.expire', dueAt: now - 1000, payload: { buffId: 'none' } });
      const first = await addEvent(db, { type: 'buff.expire', dueAt: now - 2000, payload: { buffId: 'none' } });

      expect(await processOne(db, { log })).toBe(true);
      expect(await eventRow(db, first.id)).toBeUndefined();
      expect(await eventRow(db, second.id)).toEqual(second);

      expect(await processOne(db, { log })).toBe(true);
      expect(await eventRow(db, second.id)).toBeUndefined();
      expect(await processOne(db, { log })).toBe(false);
    }));

  it('deletes the event before running it, so a handler can schedule the same ref key again', () =>
    workerTest(async (db, log) => {
      // the buff runs for another hour, but its event fell due early (and had failed before): the handler re-schedules it
      const endTime = Date.now() + 3_600_000;
      const p = await playerWithBuff(db, endTime);
      await db.execute(sql`update timed_events set due_at = ${Date.now() - 1000}, attempts = 2, last_error = 'earlier' where ref_key = ${buffKey(p)}`);

      expect(await processOne(db, { log })).toBe(true);

      const rows = await db
        .select()
        .from(timedEvents)
        .where(eq(timedEvents.refKey, buffKey(p)));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: 'buff.expire', dueAt: endTime, attempts: 0, lastError: null });
      expect(log).not.toHaveBeenCalled();
    }));

  it('backs a failing event off: the claim is undone, the error recorded and the event due again 5 s later', () =>
    workerTest(async (db, log) => {
      const ev = await addEvent(db, { type: 'unknown.type', dueAt: Date.now() - 1000 });

      const before = Date.now();
      expect(await processOne(db, { log })).toBe(true);
      const after = Date.now();

      const row = await eventRow(db, ev.id);
      expect(row).toMatchObject({ type: 'unknown.type', attempts: 1, lastError: 'unknown timed event type unknown.type' });
      expect(row.dueAt).toBeGreaterThanOrEqual(before + 5000);
      expect(row.dueAt).toBeLessThanOrEqual(after + 5000);
      expect(log).toHaveBeenCalledWith('error', 'event failed', expect.objectContaining({ id: ev.id, type: 'unknown.type' }));

      // not due again yet
      expect(await processOne(db, { log })).toBe(false);
    }));

  it('doubles the back-off with each attempt and gives up after MAX_ATTEMPTS', () =>
    workerTest(async (db, log) => {
      const ev = await addEvent(db, { type: 'unknown.type', dueAt: Date.now() - 1000 });
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const before = Date.now();
        expect(await processOne(db, { log })).toBe(true);
        const row = await eventRow(db, ev.id);
        expect(row.attempts).toBe(attempt);
        // the delay uses the attempts before this one: 5 s, 10 s, 20 s …
        expect(row.dueAt - before).toBeGreaterThanOrEqual(5000 * 2 ** (attempt - 1));
        expect(row.dueAt - before).toBeLessThan(5000 * 2 ** (attempt - 1) + 1000);
        // make it due again
        await db
          .update(timedEvents)
          .set({ dueAt: Date.now() - 1000 })
          .where(eq(timedEvents.id, ev.id));
      }
      expect(log).toHaveBeenCalledTimes(MAX_ATTEMPTS);

      // exhausted: never claimed again, and kept (with its last error) for someone to look at
      expect(await processOne(db, { log })).toBe(false);
      expect(await eventRow(db, ev.id)).toMatchObject({ attempts: MAX_ATTEMPTS, lastError: 'unknown timed event type unknown.type' });
    }));

  it('skips an exhausted event and takes the next one that is due', () =>
    workerTest(async (db, log) => {
      const now = Date.now();
      const exhausted = await addEvent(db, { type: 'buff.expire', dueAt: now - 2000, attempts: MAX_ATTEMPTS, payload: { buffId: 'none' } });
      const next = await addEvent(db, { type: 'buff.expire', dueAt: now - 1000, attempts: MAX_ATTEMPTS - 1, payload: { buffId: 'none' } });

      expect(await processOne(db, { log })).toBe(true);
      expect(await eventRow(db, next.id)).toBeUndefined();
      expect(await eventRow(db, exhausted.id)).toEqual(exhausted);
    }));

  it('backs off an event whose handler hit a database error, and the connection carries on', () =>
    workerTest(async (db, log) => {
      // a shipment id that is not a number: the handler's query fails in Postgres and aborts the game transaction
      const ev = await addEvent(db, { type: 'shipment', dueAt: Date.now() - 1000, payload: { shipmentId: 'x' } });

      expect(await processOne(db, { log })).toBe(true);

      const row = await eventRow(db, ev.id);
      expect(row.attempts).toBe(1);
      expect(row.lastError).toMatch(/^Failed query: select .* from "market_shipments"/);
      expect(row.lastError!.length).toBeLessThanOrEqual(500);
      expect(log).toHaveBeenCalledWith('error', 'event failed', expect.objectContaining({ id: ev.id, type: 'shipment' }));
      expect(await processOne(db, { log })).toBe(false);
    }));
});
