// Transaction context for game operations. Every command runs inside one Postgres
// transaction; server pushes and timed events produced by it are written in the same
// transaction (outbox pattern) so they become visible exactly when the state commits.

import { sql } from 'drizzle-orm';
import { defaultRng, GameError, type Rng } from '@evony/core';
import type { PushCmd, PushData } from '@evony/contracts';
import { pgArray, pushMessages, timedEvents, type Db, type Tx } from '@evony/db';

export const PUSH_CHANNEL = 'evony_push';

/** A push queued for the outbox (frame = `{ cmd, data }`, see PushMessage in @evony/contracts). */
export interface QueuedPush {
  /** recipients; empty = everyone online */
  playerIds: number[];
  cmd: PushCmd;
  data: PushData<PushCmd>;
}

export interface ScheduledEvent {
  type: string;
  dueAt: number;
  playerId?: number | null;
  cityId?: number | null;
  /** unique key while pending; scheduling the same key again moves the event */
  refKey?: string | null;
  payload?: Record<string, unknown>;
}

export interface Ctx {
  tx: Tx;
  now: number;
  rng: Rng;
  /** queue a push to players (delivered after commit) */
  push<K extends PushCmd>(playerIds: number | number[], cmd: K, data: PushData<K>): void;
  /** broadcast to every connected player */
  broadcast<K extends PushCmd>(cmd: K, data: PushData<K>): void;
  /** (re)schedule a timed event */
  schedule(ev: ScheduledEvent): void;
  /** cancel a pending timed event by ref key */
  unschedule(refKey: string): void;
  /** run fn once the transaction committed successfully */
  afterCommit(fn: () => void | Promise<void>): void;
}

interface CtxInternals extends Ctx {
  _pushes: QueuedPush[];
  _events: Map<string, ScheduledEvent>;
  _unscheduled: Set<string>;
  _anonymous: ScheduledEvent[];
  _after: (() => void | Promise<void>)[];
}

function createCtx(tx: Tx, now: number, rng: Rng): CtxInternals {
  const ctx: CtxInternals = {
    tx,
    now,
    rng,
    _pushes: [],
    _events: new Map(),
    _unscheduled: new Set(),
    _anonymous: [],
    _after: [],
    push(ids, cmd, data) {
      const list = (Array.isArray(ids) ? ids : [ids]).filter((x) => x > 0);
      if (list.length) ctx._pushes.push({ playerIds: [...new Set(list)], cmd, data });
    },
    broadcast(cmd, data) {
      ctx._pushes.push({ playerIds: [], cmd, data });
    },
    schedule(ev) {
      if (ev.refKey) {
        ctx._events.set(ev.refKey, ev);
        ctx._unscheduled.delete(ev.refKey);
      } else ctx._anonymous.push(ev);
    },
    unschedule(refKey) {
      ctx._events.delete(refKey);
      ctx._unscheduled.add(refKey);
    },
    afterCommit(fn) {
      ctx._after.push(fn);
    },
  };
  return ctx;
}

async function flush(ctx: CtxInternals) {
  const { tx, now } = ctx;
  if (ctx._unscheduled.size) {
    await tx.execute(sql`delete from timed_events where ref_key = any(${pgArray([...ctx._unscheduled])}::text[])`);
  }
  const keyed = [...ctx._events.values()];
  for (const ev of [...keyed, ...ctx._anonymous]) {
    const row = {
      type: ev.type,
      dueAt: Math.floor(ev.dueAt),
      playerId: ev.playerId ?? null,
      cityId: ev.cityId ?? null,
      refKey: ev.refKey ?? null,
      payload: ev.payload ?? {},
      createdAt: now,
    };
    if (row.refKey) {
      await tx
        .insert(timedEvents)
        .values(row)
        .onConflictDoUpdate({
          target: timedEvents.refKey,
          set: { dueAt: row.dueAt, payload: row.payload, type: row.type, attempts: 0, lastError: null },
        });
    } else await tx.insert(timedEvents).values(row);
  }
  if (ctx._pushes.length) {
    const rows = await tx
      .insert(pushMessages)
      .values(ctx._pushes.map((p) => ({ playerIds: p.playerIds, cmd: p.cmd, data: p.data, createdAt: now })))
      .returning({ id: pushMessages.id });
    for (const r of rows) await tx.execute(sql`select pg_notify(${PUSH_CHANNEL}, ${String(r.id)})`);
  }
}

const RETRYABLE = new Set(['40001', '40P01']); // serialization failure, deadlock

/** A Postgres error the whole transaction should be retried for (serialization failure, deadlock). */
export function isRetryable(err: unknown): boolean {
  const code = (err as { code?: string; cause?: { code?: string } }).code ?? (err as { cause?: { code?: string } }).cause?.code;
  return !(err instanceof GameError) && !!code && RETRYABLE.has(code);
}

/**
 * Run `fn` in a savepoint of the current transaction: if it throws, its writes and the pushes and
 * events it queued are discarded while the outer transaction carries on.
 */
export async function savepoint<T>(ctx: Ctx, fn: (ctx: Ctx) => Promise<T>): Promise<T> {
  const parent = ctx as CtxInternals;
  return parent.tx.transaction(async (tx) => {
    const child = createCtx(tx, parent.now, parent.rng);
    const r = await fn(child);
    parent._pushes.push(...child._pushes);
    for (const key of child._unscheduled) parent.unschedule(key);
    for (const ev of child._events.values()) parent.schedule(ev);
    parent._anonymous.push(...child._anonymous);
    parent._after.push(...child._after);
    return r;
  });
}

export interface RunOptions {
  now?: number;
  rng?: Rng;
  retries?: number;
}

/** Run a game operation in a transaction, flushing its pushes/events on success. */
export async function runGame<T>(db: Db, fn: (ctx: Ctx) => Promise<T>, opts: RunOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  for (let attempt = 0; ; attempt++) {
    let internals: CtxInternals | undefined;
    try {
      const result = await db.transaction(async (tx) => {
        internals = createCtx(tx, opts.now ?? Date.now(), opts.rng ?? defaultRng);
        const r = await fn(internals);
        await flush(internals);
        return r;
      });
      for (const f of internals?._after ?? []) await f();
      return result;
    } catch (err) {
      if (isRetryable(err) && attempt < retries) continue;
      throw err;
    }
  }
}
