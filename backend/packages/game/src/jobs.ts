// Periodic maintenance run by the worker.

import { and, eq, isNotNull, lt, sql } from 'drizzle-orm';

import { BALANCE, CandlePeriod } from '@marchlands/core';
import { type Db, heroes, players } from '@marchlands/db';

import { runGame } from '#/context.ts';
import { resyncHeroGear } from '#/engine/heroes.ts';
import { merchantSweep } from '#/engine/market.ts';
import { npcTradeTick } from '#/engine/npc-economy.ts';
import { checkBeginner } from '#/engine/player.ts';
import { refreshRankings } from '#/engine/rankings.ts';
import { refreshZoneStats } from '#/engine/world.ts';
import { getPlayer, savePlayer } from '#/repo.ts';
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

/** (marchlands) The factions trade: one auction per resource (engine/npc-economy.ts). */
export async function npcTradeJob(db: Db) {
  await runGame(db, (ctx) => npcTradeTick(ctx));
}

/** (marchlands) Fold lord statistics older than 60 days into one row per month (stats.ts). */
export async function statsJob(db: Db) {
  await compactStats(db, Date.now());
}

/** Drop delivered pushes, old chat, reports and alliance events, and old minute and hour price candles. */
export async function cleanupJob(db: Db) {
  const now = Date.now();
  await db.execute(sql`delete from push_messages where created_at < ${now - 10 * 60_000}`);
  await db.execute(sql`delete from chat_messages where sent_at < ${now - 7 * 86_400_000}`);
  await db.execute(sql`delete from reports where event_time < ${now - 30 * 86_400_000}`);
  await db.execute(sql`delete from alliance_events where created_at < ${now - 30 * 86_400_000}`);
  const keep = BALANCE.marketCandles.keepMs;
  await db.execute(sql`delete from market_candles where period = ${CandlePeriod.MINUTE} and start < ${now - keep.minute}`);
  await db.execute(sql`delete from market_candles where period = ${CandlePeriod.HOUR} and start < ${now - keep.hour}`);
}

/**
 * (marchlands) Re-apply every lord's gear to their heroes, run at worker start-up. Heroes store their gear points, so
 * this is how a change to the gear rules (gear.ts, BALANCE.heroGear) reaches them. Saves only heroes that changed;
 * returns how many.
 */
export async function heroGearJob(db: Db): Promise<number> {
  const owners = await db
    .selectDistinct({ id: heroes.playerId })
    .from(heroes)
    .where(and(isNotNull(heroes.playerId), eq(heroes.inTavern, false)));
  let changed = 0;
  for (const { id } of owners) if (id != null) changed += await runGame(db, (ctx) => resyncHeroGear(ctx, id));
  return changed;
}
