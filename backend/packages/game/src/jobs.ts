// Periodic maintenance run by the worker.

import { and, eq, lt, sql } from 'drizzle-orm';
import { BALANCE } from '@marchlands/core';
import { players, type Db } from '@marchlands/db';
import { runGame } from '#/context.ts';
import { getPlayer, savePlayer } from '#/repo.ts';
import { checkBeginner } from '#/engine/player.ts';
import { merchantSweep } from '#/engine/market.ts';
import { refreshRankings } from '#/engine/rankings.ts';
import { refreshZoneStats } from '#/engine/world.ts';
import { compactStats } from '#/stats.ts';

export async function rankingsJob(db: Db) {
  await runGame(db, (ctx) => refreshRankings(ctx));
}

export async function zonesJob(db: Db) {
  await refreshZoneStats(db);
}

/** Beginner protection lapses after 7 days even without a Town Hall 5. */
export async function beginnerJob(db: Db) {
  const cutoff = Date.now() - BALANCE.beginnerProtectionMs; // real time, like checkBeginner
  const due = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.beginner, true), lt(players.createdAt, cutoff)))
    .limit(500);
  for (const { id } of due) {
    await runGame(db, async (ctx) => {
      const p = await getPlayer(ctx, id, { lock: true });
      await checkBeginner(ctx, p);
      await savePlayer(ctx, p);
    });
  }
}

/** The computer merchant fills resting market orders its price has crossed. */
export async function merchantJob(db: Db) {
  await runGame(db, (ctx) => merchantSweep(ctx));
}

/** (marchlands) Fold lord statistics older than 60 days into one row per month (stats.ts). */
export async function statsJob(db: Db) {
  await compactStats(db, Date.now());
}

/** Drop delivered pushes and old chat/reports. */
export async function cleanupJob(db: Db) {
  const now = Date.now();
  await db.execute(sql`delete from push_messages where created_at < ${now - 10 * 60_000}`);
  await db.execute(sql`delete from chat_messages where sent_at < ${now - 7 * 86_400_000}`);
  await db.execute(sql`delete from reports where event_time < ${now - 30 * 86_400_000}`);
  await db.execute(sql`delete from alliance_events where created_at < ${now - 30 * 86_400_000}`);
}
