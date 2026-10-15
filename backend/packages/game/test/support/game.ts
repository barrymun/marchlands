// Runs a test inside one game transaction that is always rolled back, so tests never leave anything behind
// and can run in any order. The context is the real one (services see no difference); the test can read
// what it queued (pushes, timed events), move time forward and run the timed events that fall due.

import type { PushCmd, PushData } from '@marchlands/contracts';
import { seededRng } from '@marchlands/core';
import { testDb } from '@marchlands/db/test/support/db.ts';

import { type CtxInternals, type QueuedPush, type ScheduledEvent } from '#/context.ts';
import { dispatchEvent, runGame } from '#/index.ts';

// Each test starts from the seeded world with no players: every test rolls back, so a test only ever sees the
// players and cities it made itself (rankings and map searches can rely on that).

/** Start of game time in tests: a fixed instant, so results do not depend on the clock. */
export const T0 = Date.UTC(2026, 0, 1);

export interface TestGame extends CtxInternals {
  /** pushes queued so far, or only those of one command (typed by it) */
  pushes(): QueuedPush[];
  pushes<K extends PushCmd>(cmd: K): (QueuedPush & { cmd: K; data: PushData<K> })[];
  /** timed events pending, soonest first */
  events(type?: string): ScheduledEvent[];
  /** move time forward by `ms` (does not run events: see runDue) */
  advance(ms: number): void;
  /** move time forward to each pending event that falls due by `until` (default now) and run it, in order */
  runDue(until?: number): Promise<number>;
}

const ROLLBACK = Symbol('rollback');

/** Run `fn` in a game transaction that is rolled back afterwards; returns what `fn` returned. */
export async function game<T>(fn: (g: TestGame) => Promise<T>, opts: { now?: number; seed?: string } = {}): Promise<T> {
  let result: T | undefined;
  try {
    await runGame(
      testDb(),
      async (ctx) => {
        result = await fn(asTestGame(ctx as CtxInternals));
        throw ROLLBACK;
      },
      { now: opts.now ?? T0, rng: seededRng(opts.seed ?? 'test'), retries: 0 },
    );
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result as T;
}

function pending(ctx: CtxInternals): ScheduledEvent[] {
  return [...ctx._events.values(), ...ctx._anonymous].sort((a, b) => a.dueAt - b.dueAt);
}

function asTestGame(ctx: CtxInternals): TestGame {
  const g = ctx as TestGame;
  g.pushes = ((cmd?: PushCmd) => ctx._pushes.filter((p) => cmd == null || p.cmd === cmd)) as TestGame['pushes'];
  g.events = (type) => pending(ctx).filter((e) => type == null || e.type === type);
  g.advance = (ms) => {
    ctx.now += ms;
  };
  g.runDue = async (until = ctx.now) => {
    let ran = 0;
    for (;;) {
      const next = pending(ctx).find((e) => e.dueAt <= until);
      if (!next) break;
      if (next.refKey) ctx._events.delete(next.refKey);
      else ctx._anonymous.splice(ctx._anonymous.indexOf(next), 1);
      ctx.now = Math.max(ctx.now, Math.floor(next.dueAt));
      await dispatchEvent(ctx, {
        id: 0,
        type: next.type,
        dueAt: next.dueAt,
        playerId: next.playerId ?? null,
        cityId: next.cityId ?? null,
        payload: next.payload ?? {},
      });
      if (++ran > 10_000) throw new Error('runDue: events keep scheduling themselves');
    }
    ctx.now = Math.max(ctx.now, until);
    return ran;
  };
  return g;
}
