// Game clock. Seeds the world on first boot, then:
//  - claims due timed events (FOR UPDATE SKIP LOCKED, so several workers can run side by side)
//    and processes each in its own transaction;
//  - runs periodic jobs (rankings, zone stats, beginner expiry, merchant sweep, cleanup).
// The moving parts live in worker.ts; this file wires them to the environment, the database and the signals.

import { sql } from 'drizzle-orm';
import { setGameSpeed } from '@marchlands/core';
import { connect, timedEvents } from '@marchlands/db';
import { beginnerJob, cleanupJob, merchantJob, rankingsJob, startStatsFlusher, statsJob, world, zonesJob } from '@marchlands/game';
import { eventLoop, every as everyUntilStopped, log, processOne } from './worker.ts';

const BATCH = Number(process.env.WORKER_BATCH ?? 50);
const IDLE_MS = Number(process.env.WORKER_IDLE_MS ?? 250);

setGameSpeed(Number(process.env.GAME_SPEED ?? 1));
const { db, pool, close } = connect(process.env.DATABASE_URL, Number(process.env.DB_POOL_SIZE ?? 10));
let stopping = false;
const isStopping = () => stopping;
// lord statistics are buffered in memory and written in batches (game stats.ts)
const stopStats = startStatsFlusher(db, Number(process.env.STATS_FLUSH_MS ?? 5 * 60_000), (err) => log('error', 'stats flush failed', { error: String(err) }));

const every = (name: string, ms: number, fn: () => Promise<void>) => everyUntilStopped(name, ms, fn, { stopping: isStopping, log });

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
  every('stats', 60 * 60_000, () => statsJob(db));
  await eventLoop(() => processOne(db, { log }), { batch: BATCH, idleMs: IDLE_MS, stopping: isStopping, log });
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log('info', `received ${signal}, shutting down`);
  setTimeout(() => process.exit(0), 5000).unref();
  await stopStats();
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
