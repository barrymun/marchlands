// Game clock. Seeds the world on first boot, then:
//  - claims due timed events (FOR UPDATE SKIP LOCKED, so several workers can run side by side)
//    and processes each in its own transaction;
//  - runs periodic jobs (rankings, zone stats, beginner expiry, merchant sweep, cleanup).

import { sql } from 'drizzle-orm';
import { setGameSpeed } from '@marchlands/core';
import { connect, timedEvents } from '@marchlands/db';
import { beginnerJob, cleanupJob, dispatchEvent, merchantJob, rankingsJob, runGame, world, zonesJob, type EventRow } from '@marchlands/game';

const log = (level: string, msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), level, service: 'worker', msg, ...extra }));

const BATCH = Number(process.env.WORKER_BATCH ?? 50);
const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 250);
const MAX_ATTEMPTS = 5;

setGameSpeed(Number(process.env.GAME_SPEED ?? 1));
const { db, pool, close } = connect(process.env.DATABASE_URL, Number(process.env.DB_POOL_SIZE ?? 10));
let stopping = false;

/** Claim one due event and process it inside a single transaction. Returns false when idle. */
async function processOne(): Promise<boolean> {
  let claimed: EventRow | null = null;
  try {
    await runGame(
      db,
      async (ctx) => {
        const rows = await ctx.tx.execute<{
          id: number;
          type: string;
          due_at: number;
          player_id: number | null;
          city_id: number | null;
          payload: Record<string, unknown>;
        }>(sql`
          select id, type, due_at, player_id, city_id, payload from timed_events
          where due_at <= ${ctx.now} and attempts < ${MAX_ATTEMPTS}
          order by due_at limit 1 for update skip locked`);
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
    if (!claimed) throw err;
    const ev = claimed as EventRow;
    log('error', 'event failed', { id: ev.id, type: ev.type, error: String((err as Error).stack ?? err) });
    // the transaction rolled back, so the row still exists: back off and record the error
    await db.execute(sql`
      update timed_events set attempts = attempts + 1, last_error = ${String((err as Error).message).slice(0, 500)},
        due_at = ${Date.now()} + 5000 * power(2, attempts) where id = ${ev.id}`);
  }
  return claimed != null;
}

async function eventLoop() {
  while (!stopping) {
    let worked = 0;
    try {
      while (!stopping && worked < BATCH && (await processOne())) worked++;
    } catch (err) {
      log('error', 'event loop error', { error: String(err) });
    }
    if (worked === 0) await new Promise((r) => setTimeout(r, IDLE_MS));
  }
}

function every(name: string, ms: number, fn: () => Promise<void>) {
  const run = async () => {
    if (stopping) return;
    const t = Date.now();
    try {
      await fn();
    } catch (err) {
      log('error', `${name} failed`, { error: String((err as Error).stack ?? err) });
    }
    const took = Date.now() - t;
    if (took > 2000) log('info', `${name} took ${took}ms`);
    if (!stopping) setTimeout(run, ms);
  };
  setTimeout(run, 1000);
}

async function main() {
  const info = await world.ensureWorld(db, {
    source: process.env.WORLD_MAP === 'legacy' ? 'legacy' : 'generated',
    seed: process.env.WORLD_SEED ?? 'marchlands',
    log: (m) => log('info', m),
  });
  log('info', 'world ready', { ...info });
  const [{ n }] = (await db.select({ n: sql<number>`count(*)` }).from(timedEvents)) as { n: number }[];
  log('info', 'worker started', { pendingEvents: Number(n), gameSpeed: Number(process.env.GAME_SPEED ?? 1) });

  every('rankings', 60_000, () => rankingsJob(db));
  every('zones', 60_000, () => zonesJob(db));
  every('beginner', 60_000, () => beginnerJob(db));
  every('merchant', 10_000, () => merchantJob(db));
  every('cleanup', 10 * 60_000, () => cleanupJob(db));
  await eventLoop();
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log('info', `received ${signal}, shutting down`);
  setTimeout(() => process.exit(0), 5000).unref();
  await close().catch(() => {});
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
pool.on('error', (err) => log('error', 'pg pool error', { error: String(err) }));

main().catch((err) => {
  log('fatal', 'worker crashed', { error: String((err as Error).stack ?? err) });
  process.exit(1);
});
