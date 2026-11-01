// Periodic maintenance run by the worker.

import { and, asc, eq, isNotNull, lt, sql } from 'drizzle-orm';

import { autoDraftsDue, BALANCE, BASIC_RESOURCES, CandlePeriod, draftsUsed, heroName, stateOf } from '@marchlands/core';
import { cities, type Db, heroes, players } from '@marchlands/db';

import { runGame } from '#/context.ts';
import { draft, pickDraftTarget, seatLevelOf } from '#/engine/draft.ts';
import { resyncHeroGear, takenHeroNames } from '#/engine/heroes.ts';
import { merchantSweep } from '#/engine/market.ts';
import { npcTradeTick } from '#/engine/npc-economy.ts';
import { checkBeginner } from '#/engine/player.ts';
import { refreshRankings } from '#/engine/rankings.ts';
import { tendSeat } from '#/engine/unrest.ts';
import { refreshZoneStats } from '#/engine/world.ts';
import { getCity, getPlayer, getTile, savePlayer } from '#/repo.ts';
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

/**
 * (marchlands) Held historic cities that draft by themselves make the drafts due by now (one at the start of each part
 * of the UTC day, engine/draft.ts), one each a run, aimed at the strongest barbarian city in their area.
 */
export async function draftJob(db: Db) {
  const seats = await db
    .select({ id: cities.id })
    .from(cities)
    .where(and(isNotNull(cities.historicLevel), eq(cities.draftAuto, true)));
  for (const { id } of seats) {
    await runGame(db, async (ctx) => {
      const city = await getCity(ctx, id, { lock: true });
      const level = seatLevelOf(city);
      if (!level || !city.draftAuto || draftsUsed(city, ctx.now) >= Math.min(autoDraftsDue(ctx.now), BALANCE.historic.draftsPerDay)) return;
      const target = await pickDraftTarget(ctx, city, level);
      if (!target) return;
      await draft(ctx, city, await getTile(ctx, target.tile.id, { lock: true }), { auto: true, scouted: target.scouted });
    });
  }
}

/** (marchlands) Every held historic city's minute: unrest, rising up, and its alliance's share of the tribute (engine/unrest.ts). */
export async function seatsJob(db: Db) {
  const seats = await db.select({ id: cities.id }).from(cities).where(isNotNull(cities.historicLevel));
  for (const { id } of seats) await runGame(db, (ctx) => tendSeat(ctx, id));
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
  // (marchlands) trades older than BALANCE.marketTrades.keepMs, a resource at a time so the delete walks
  // market_trades_res_time_idx
  for (const resType of BASIC_RESOURCES.keys())
    await db.execute(sql`delete from market_trades where res_type = ${resType} and created_at < ${now - BALANCE.marketTrades.keepMs}`);
  // (marchlands) wave plans whose landing second is long past (their waves go with them)
  await db.execute(sql`delete from war_plans where land_at < ${now - BALANCE.warPlans.keepMs}`);
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

/**
 * (marchlands) Give the heroes still waiting in an Inn under a name from the old generator ("Aldric the Bold") a name
 * and sex from the new one, for their city's state (heroName), keeping their stats; run at worker start-up. New names
 * never have an epithet, so each hero is renamed once. Returns how many.
 */
export async function innNamesJob(db: Db): Promise<number> {
  return runGame(db, async (ctx) => {
    const offers = await ctx.tx
      .select({ id: heroes.id, cityId: heroes.cityId, playerId: cities.playerId, tileId: cities.tileId })
      .from(heroes)
      .innerJoin(cities, eq(cities.id, heroes.cityId))
      .where(and(eq(heroes.inTavern, true), sql`${heroes.name} ~ '^[A-Za-z]+ the [A-Za-z]+$'`))
      .orderBy(asc(heroes.id));
    for (const h of offers) {
      const taken = await takenHeroNames(ctx, h.playerId, h.cityId);
      const { name, sex } = heroName(ctx.rng, stateOf(h.tileId), { travellers: true, taken });
      await ctx.tx.update(heroes).set({ name, sex }).where(eq(heroes.id, h.id));
    }
    return offers.length;
  });
}
