// The worker's moving parts, given their dependencies so they can be tested (main.ts wires them up):
//  - processOne claims one due timed event (FOR UPDATE SKIP LOCKED, so several workers can run side by side), the
//    oldest first and, among those due at the same moment, the first scheduled (armies landing together fight in the
//    order they were sent), and processes it in its own transaction, backing it off when it fails;
//  - eventLoop drains due events in batches and idles when there are none;
//  - every runs a periodic job until the worker stops.

import { sql } from 'drizzle-orm';
import type { Db } from '@marchlands/db';
import { dispatchEvent, type EventRow, runGame } from '@marchlands/game';

export type Log = (level: string, msg: string, extra?: Record<string, unknown>) => void;

export const log: Log = (level, msg, extra = {}) => console.log(JSON.stringify({ time: new Date().toISOString(), level, service: 'worker', msg, ...extra }));

/** @internal exported for tests */
export const MAX_ATTEMPTS = 5;

/** Claim one due event and process it inside a single transaction. Returns false when idle. */
export async function processOne(db: Db, opts: { log: Log }): Promise<boolean> {
  let claimed: EventRow | null = null;
  try {
    await runGame(
      db,
      async (ctx) => {
        claimed = null; // a retried attempt starts over: forget what a failed one claimed
        const rows = await ctx.tx.execute<{
          id: number;
          type: EventRow['type'];
          due_at: number;
          player_id: number | null;
          city_id: number | null;
          payload: Record<string, unknown>;
        }>(sql`
          select id, type, due_at, player_id, city_id, payload from timed_events
          where due_at <= ${ctx.now} and attempts < ${MAX_ATTEMPTS}
          order by due_at, id limit 1 for update skip locked`);
        const r = rows.rows[0];
        if (!r) return;
        claimed = { id: Number(r.id), type: r.type, dueAt: Number(r.due_at), playerId: r.player_id, cityId: r.city_id, payload: r.payload };
        // delete first: handlers may legitimately re-schedule the same ref key
        await ctx.tx.execute(sql`delete from timed_events where id = ${claimed.id}`);
        await dispatchEvent(ctx, claimed);
      },
      { retries: 3 },
    );
  } catch (err) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- set inside the transaction's callback, which the rule can't follow
    if (!claimed) throw err;
    const ev = claimed as EventRow;
    opts.log('error', 'event failed', { id: ev.id, type: ev.type, error: String((err as Error).stack ?? err) });
    // the transaction rolled back, so the row still exists: back off and record the error
    await db.execute(sql`
      update timed_events set attempts = attempts + 1, last_error = ${String((err as Error).message).slice(0, 500)},
        due_at = ${Date.now()} + 5000 * power(2, attempts) where id = ${ev.id}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- as above
  return claimed != null;
}

export interface LoopOptions {
  /** events processed before the loop checks in again */
  batch: number;
  /** wait when no event was due */
  idleMs: number;
  /** true once the worker is shutting down */
  stopping: () => boolean;
  log: Log;
}

/** Process due events (`next` claims and runs one, false when idle) until the worker stops. */
export async function eventLoop(next: () => Promise<boolean>, opts: LoopOptions) {
  while (!opts.stopping()) {
    let worked = 0;
    try {
      while (!opts.stopping() && worked < opts.batch && (await next())) worked++;
    } catch (err) {
      opts.log('error', 'event loop error', { error: String(err) });
    }
    if (worked === 0) await new Promise((r) => setTimeout(r, opts.idleMs));
  }
}

/** Run `fn` every `ms` (counted from the end of the previous run, the first one second after start) until the worker stops. */
export function every(name: string, ms: number, fn: () => Promise<void>, opts: Pick<LoopOptions, 'stopping' | 'log'>) {
  const run = async () => {
    if (opts.stopping()) return;
    const t = Date.now();
    try {
      await fn();
    } catch (err) {
      opts.log('error', `${name} failed`, { error: String((err as Error).stack ?? err) });
    }
    const took = Date.now() - t;
    if (took > 2000) opts.log('info', `${name} took ${took}ms`);
    if (!opts.stopping()) setTimeout(() => void run(), ms);
  };
  setTimeout(() => void run(), 1000);
}
