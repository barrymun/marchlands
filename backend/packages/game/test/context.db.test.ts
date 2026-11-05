import { eq, like } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { GameError, msg, seededRng, type TimedEventType } from '@marchlands/core';
import { type Db, playerStats, pushMessages, timedEvents, type Tx, worldState } from '@marchlands/db';

import { type RunOptions, savepoint } from '#/context.ts';
import { type Ctx, runGame } from '#/index.ts';
import { flushStats, statDay } from '#/stats.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game, T0 } from '#test/support/game.ts';
import { arrange, inTestTx } from '#test/support/tx.ts';

/** Events of this test's own, never dispatched: what's tested is how they're stored. */
const TEST_EVENT = { A: 'test.a', B: 'test.b', C: 'test.c', KEYED: 'test.keyed', ANON: 'test.anon' } as unknown as Record<
  'A' | 'B' | 'C' | 'KEYED' | 'ANON',
  TimedEventType
>;

const NOW = T0 + 12 * 3_600_000;

const run = <T>(db: Db, fn: (ctx: Ctx) => Promise<T>, opts: RunOptions = {}) => runGame(db, fn, { now: NOW, ...opts });

/** The timed events this file schedules (types `test.*`), in the order they were stored. */
const testEvents = (db: Db) => db.select().from(timedEvents).where(like(timedEvents.type, 'test.%')).orderBy(timedEvents.id);

const outbox = (db: Db) => db.select().from(pushMessages).where(eq(pushMessages.createdAt, NOW)).orderBy(pushMessages.id);

const items = (n: number) => ({ items: [{ id: 'x', count: n }] });

const pgError = (code: string) => Object.assign(new Error(`pg ${code}`), { code });

/** A marker row: shows whether an attempt's writes were kept. */
const mark = (ctx: Ctx, key: string) => ctx.tx.insert(worldState).values({ key, value: { at: ctx.now }, updatedAt: ctx.now });
const marked = async (db: Db | Tx, key: string) => (await db.select().from(worldState).where(eq(worldState.key, key))).length > 0;

describe(runGame.name, () => {
  it('runs the operation at the given time with the given random numbers, and returns its result', () =>
    inTestTx(async (db) => {
      const rng = seededRng('ctx');
      const seen = await run(db, async (ctx) => ({ now: ctx.now, rng: ctx.rng }), { rng });
      expect(seen).toEqual({ now: NOW, rng });

      const before = Date.now();
      const now = await runGame(db, async (ctx) => ctx.now);
      expect(now).toBeGreaterThanOrEqual(before);
      expect(now).toBeLessThanOrEqual(Date.now());
    }));

  it('writes the queued pushes to the outbox, recipients deduplicated and only real player ids', () =>
    inTestTx(async (db) => {
      await run(db, async (ctx) => {
        ctx.push([3, 3, 0, -1, 4], PushCmd.ITEM_UPDATE, items(1));
        ctx.push(5, PushCmd.ITEM_UPDATE, items(2));
        ctx.push(0, PushCmd.ITEM_UPDATE, items(3)); // nobody: dropped
        ctx.push([-2], PushCmd.ITEM_UPDATE, items(4)); // nobody: dropped
        ctx.broadcast(PushCmd.ITEM_UPDATE, items(5));
      });
      expect(await outbox(db)).toEqual([
        { id: expect.any(Number), playerIds: [3, 4], cmd: PushCmd.ITEM_UPDATE, data: items(1), createdAt: NOW },
        { id: expect.any(Number), playerIds: [5], cmd: PushCmd.ITEM_UPDATE, data: items(2), createdAt: NOW },
        { id: expect.any(Number), playerIds: [], cmd: PushCmd.ITEM_UPDATE, data: items(5), createdAt: NOW },
      ]);
    }));

  it('writes nothing to the outbox when nothing was queued', () =>
    inTestTx(async (db) => {
      await run(db, async () => undefined);
      expect(await outbox(db)).toEqual([]);
      expect(await testEvents(db)).toEqual([]);
    }));

  it('stores scheduled events: whole milliseconds, defaults for what was left out, keyed and anonymous', () =>
    inTestTx(async (db) => {
      await run(db, async (ctx) => {
        ctx.schedule({ type: TEST_EVENT.KEYED, dueAt: NOW + 1000.9, playerId: 7, cityId: 8, refKey: 'test:1', payload: { a: 1 } });
        ctx.schedule({ type: TEST_EVENT.ANON, dueAt: NOW + 5 });
        ctx.schedule({ type: TEST_EVENT.ANON, dueAt: NOW + 6 });
      });
      const base = { id: expect.any(Number), attempts: 0, lastError: null, createdAt: NOW };
      expect(await testEvents(db)).toEqual([
        { ...base, type: 'test.keyed', dueAt: NOW + 1000, playerId: 7, cityId: 8, refKey: 'test:1', payload: { a: 1 } },
        { ...base, type: 'test.anon', dueAt: NOW + 5, playerId: null, cityId: null, refKey: null, payload: {} },
        { ...base, type: 'test.anon', dueAt: NOW + 6, playerId: null, cityId: null, refKey: null, payload: {} },
      ]);
    }));

  it('scheduling a pending key again moves that event and resets its failed attempts', () =>
    inTestTx(async (db) => {
      await run(db, async (ctx) => ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 1000, playerId: 7, refKey: 'test:1', payload: { a: 1 } }));
      await db.update(timedEvents).set({ attempts: 3, lastError: 'boom' }).where(eq(timedEvents.refKey, 'test:1'));

      await run(db, async (ctx) => ctx.schedule({ type: TEST_EVENT.B, dueAt: NOW + 2000, refKey: 'test:1', payload: { b: 2 } }));
      expect(await testEvents(db)).toEqual([
        expect.objectContaining({ type: 'test.b', dueAt: NOW + 2000, refKey: 'test:1', payload: { b: 2 }, attempts: 0, lastError: null }),
      ]);
    }));

  it('a key scheduled twice in one operation is stored once, as last scheduled', () =>
    inTestTx(async (db) => {
      await run(db, async (ctx) => {
        ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 1000, refKey: 'test:1' });
        ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 3000, refKey: 'test:1', payload: { last: true } });
      });
      expect(await testEvents(db)).toEqual([expect.objectContaining({ dueAt: NOW + 3000, payload: { last: true } })]);
    }));

  it('unschedule deletes the pending event with that key, and cancels one queued earlier in the operation', () =>
    inTestTx(async (db) => {
      await run(db, async (ctx) => {
        ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 1000, refKey: 'test:1' });
        ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 1000, refKey: 'test:2' });
      });
      await run(db, async (ctx) => {
        ctx.unschedule('test:1');
        ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 1000, refKey: 'test:3' });
        ctx.unschedule('test:3');
        ctx.unschedule('test:missing');
      });
      expect((await testEvents(db)).map((e) => e.refKey)).toEqual(['test:2']);
    }));

  it('scheduling a key after unscheduling it in the same operation keeps the new event', () =>
    inTestTx(async (db) => {
      await run(db, async (ctx) => ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW + 1000, refKey: 'test:1' }));
      await run(db, async (ctx) => {
        ctx.unschedule('test:1');
        ctx.schedule({ type: TEST_EVENT.B, dueAt: NOW + 2000, refKey: 'test:1' });
      });
      expect(await testEvents(db)).toEqual([expect.objectContaining({ type: 'test.b', dueAt: NOW + 2000, refKey: 'test:1' })]);
    }));

  it('a failed operation leaves nothing behind: no writes, pushes or events', () =>
    inTestTx(async (db) => {
      const err = new Error('boom');
      await expect(
        run(db, async (ctx) => {
          await mark(ctx, 'ctx:failed');
          ctx.push(1, PushCmd.ITEM_UPDATE, items(1));
          ctx.schedule({ type: TEST_EVENT.A, dueAt: NOW, refKey: 'test:1' });
          throw err;
        }),
      ).rejects.toBe(err);
      expect(await marked(db, 'ctx:failed')).toBe(false);
      expect(await outbox(db)).toEqual([]);
      expect(await testEvents(db)).toEqual([]);
    }));

  describe('retries', () => {
    it.each(['40001', '40P01'])('runs the whole operation again after error %s, discarding the failed attempt', (code) =>
      inTestTx(async (db) => {
        let attempt = 0;
        const r = await run(db, async (ctx) => {
          attempt++;
          await mark(ctx, `ctx:attempt${attempt}`);
          ctx.push(1, PushCmd.ITEM_UPDATE, items(attempt));
          ctx.schedule({ type: TEST_EVENT.ANON, dueAt: NOW + attempt });
          if (attempt === 1) throw pgError(code);
          return 'done';
        });
        expect(r).toBe('done');
        expect(attempt).toBe(2);
        expect(await marked(db, 'ctx:attempt1')).toBe(false);
        expect(await marked(db, 'ctx:attempt2')).toBe(true);
        expect((await outbox(db)).map((p) => p.data)).toEqual([items(2)]);
        expect((await testEvents(db)).map((e) => e.dueAt)).toEqual([NOW + 2]);
      }),
    );

    it('recognises the code on the cause of a wrapped error', () =>
      inTestTx(async (db) => {
        let attempt = 0;
        await run(db, async () => {
          if (++attempt === 1) throw new Error('wrapped', { cause: pgError('40001') });
        });
        expect(attempt).toBe(2);
      }));

    it('gives up after `retries` more attempts (3 by default) and rethrows the last error', () =>
      inTestTx(async (db) => {
        let attempts = 0;
        const fail = async () => {
          throw pgError(`40001`);
        };
        await expect(run(db, () => (attempts++, fail()))).rejects.toMatchObject({ code: '40001' });
        expect(attempts).toBe(4);

        attempts = 0;
        await expect(run(db, () => (attempts++, fail()), { retries: 1 })).rejects.toMatchObject({ code: '40001' });
        expect(attempts).toBe(2);

        attempts = 0;
        await expect(run(db, () => (attempts++, fail()), { retries: 0 })).rejects.toMatchObject({ code: '40001' });
        expect(attempts).toBe(1);
      }));

    it('does not retry other errors, nor a game refusal', () =>
      inTestTx(async (db) => {
        for (const err of [new Error('boom'), pgError('23505'), new GameError(msg('common.invalidData'))]) {
          let attempts = 0;
          await expect(
            run(db, async () => {
              attempts++;
              throw err;
            }),
          ).rejects.toBe(err);
          expect(attempts).toBe(1);
        }
      }));
  });

  describe('afterCommit', () => {
    it('runs the callbacks in order once the operation is stored, awaiting each, before returning', () =>
      inTestTx(async (db) => {
        const log: string[] = [];
        const r = await run(db, async (ctx) => {
          ctx.push(1, PushCmd.ITEM_UPDATE, items(1));
          ctx.afterCommit(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
            log.push(`first: ${(await outbox(db)).length} push`);
          });
          ctx.afterCommit(() => void log.push('second'));
          log.push('operation');
          return 'result';
        });
        log.push(`returned ${r}`);
        expect(log).toEqual(['operation', 'first: 1 push', 'second', 'returned result']);
      }));

    it('does not run them when the operation fails', () =>
      inTestTx(async (db) => {
        let ran = 0;
        await expect(
          run(db, async (ctx) => {
            ctx.afterCommit(() => void ran++);
            throw new Error('boom');
          }),
        ).rejects.toThrow('boom');
        expect(ran).toBe(0);
      }));

    it('runs only those of the attempt that succeeded', () =>
      inTestTx(async (db) => {
        const ran: number[] = [];
        let attempt = 0;
        await run(db, async (ctx) => {
          const n = ++attempt;
          ctx.afterCommit(() => void ran.push(n));
          if (n === 1) throw pgError('40001');
        });
        expect(ran).toEqual([2]);
      }));

    it('never runs a committed operation again when a callback fails', () =>
      inTestTx(async (db) => {
        let runs = 0;
        let thrown = false;
        const err = pgError('40001');
        const result = run(db, async (ctx) => {
          runs++;
          ctx.afterCommit(() => {
            if (thrown) return;
            thrown = true;
            throw err;
          });
        });
        await expect(result).rejects.toBe(err);
        expect(runs).toBe(1);
      }));
  });

  describe('stats', () => {
    it("buffers a committed operation's counters under its UTC day, for flushStats to write", () =>
      inTestTx(async (db) => {
        await flushStats(db); // whatever earlier operations left in the buffer
        const p = await arrange(db, (g) => createTestPlayer(g), NOW);
        await flushStats(db);
        await db.delete(playerStats).where(eq(playerStats.playerId, p.id));

        await run(db, async (ctx) => {
          ctx.stat(p.id, 0, { 'wins.npc': 1 });
          ctx.stat(p.id, 0, { 'wins.npc': 2, 'trained.archer': 0 });
          ctx.stat(p.id, p.cityId, { 'trained.archer': 5 });
          ctx.stat(0, 0, { 'wins.npc': 100 }); // not a player: ignored
        });
        await expect(run(db, async (ctx) => (ctx.stat(p.id, 0, { 'wins.npc': 50 }), Promise.reject(new Error('boom'))))).rejects.toThrow('boom');
        let attempt = 0;
        await run(db, async (ctx) => {
          ctx.stat(p.id, 0, { 'wins.pvp': 1 });
          if (++attempt === 1) throw pgError('40001'); // the retried attempt's counters count once
        });

        expect(await flushStats(db)).toBe(2);
        const rows = await db.select().from(playerStats).where(eq(playerStats.playerId, p.id));
        expect(rows.sort((a, b) => a.cityId - b.cityId)).toEqual([
          { playerId: p.id, cityId: 0, period: statDay(NOW), counters: { 'wins.npc': 3, 'wins.pvp': 1 } },
          { playerId: p.id, cityId: p.cityId, period: statDay(NOW), counters: { 'trained.archer': 5 } },
        ]);
      }));
  });
});

describe(savepoint.name, () => {
  it('returns the result and hands what it queued to the outer operation, keeping its writes', () =>
    game(async (g) => {
      g.schedule({ type: TEST_EVENT.A, dueAt: g.now + 1, refKey: 'test:outer' });
      g.stat(1, 0, { 'wins.npc': 1 });
      const after = () => undefined;
      const r = await savepoint(g, async (ctx) => {
        expect(ctx.now).toBe(g.now);
        expect(ctx.rng).toBe(g.rng);
        await mark(ctx, 'ctx:inner');
        ctx.push(1, PushCmd.ITEM_UPDATE, items(1));
        ctx.schedule({ type: TEST_EVENT.B, dueAt: g.now + 2, refKey: 'test:inner' });
        ctx.schedule({ type: TEST_EVENT.C, dueAt: g.now + 3 });
        ctx.unschedule('test:outer');
        ctx.afterCommit(after);
        ctx.stat(1, 0, { 'wins.npc': 2 });
        ctx.stat(2, 0, { 'wins.pvp': 1 });
        return 42;
      });
      expect(r).toBe(42);
      expect(await marked(g.tx, 'ctx:inner')).toBe(true);
      expect(g.pushes()).toEqual([{ playerIds: [1], cmd: PushCmd.ITEM_UPDATE, data: items(1) }]);
      expect(g.events().map((e) => e.type)).toEqual(['test.b', 'test.c']);
      expect(g._unscheduled).toEqual(new Set(['test:outer']));
      expect(g._after).toEqual([after]);
      expect(Object.fromEntries(g._stats)).toEqual({ '1|0': { 'wins.npc': 3 }, '2|0': { 'wins.pvp': 1 } });
    }));

  it('when it throws, its writes and everything it queued are discarded and the outer operation carries on', () =>
    game(async (g) => {
      g.schedule({ type: TEST_EVENT.A, dueAt: g.now + 1, refKey: 'test:outer' });
      const err = new Error('boom');
      await expect(
        savepoint(g, async (ctx) => {
          await mark(ctx, 'ctx:inner');
          ctx.push(1, PushCmd.ITEM_UPDATE, items(1));
          ctx.schedule({ type: TEST_EVENT.B, dueAt: g.now + 2 });
          ctx.unschedule('test:outer');
          ctx.afterCommit(() => undefined);
          ctx.stat(1, 0, { 'wins.npc': 1 });
          throw err;
        }),
      ).rejects.toBe(err);
      expect(await marked(g.tx, 'ctx:inner')).toBe(false);
      expect(g.pushes()).toEqual([]);
      expect(g.events().map((e) => e.refKey)).toEqual(['test:outer']);
      expect(g._unscheduled.size).toBe(0);
      expect(g._after).toEqual([]);
      expect(g._stats.size).toBe(0);
      // the outer transaction is still usable
      await mark(g, 'ctx:outer');
      expect(await marked(g.tx, 'ctx:outer')).toBe(true);
    }));
});
