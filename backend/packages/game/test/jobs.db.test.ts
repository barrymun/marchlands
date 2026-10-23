import { and, eq, inArray, sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';

import { BALANCE, CandlePeriod, heroGearBonus, heroGearStat, MarketSide, merchantBase, msg, setGameSpeed, TechType } from '@marchlands/core';
import {
  allianceEvents,
  alliances,
  chatMessages,
  type Db,
  heroes,
  mails,
  marketCandles,
  players,
  playerStats,
  pushMessages,
  reports,
  tiles,
  worldState,
} from '@marchlands/db';

import { type ZoneStats } from '#/engine/world.ts';
import { beginnerJob, cleanupJob, heroGearJob, innNamesJob, market, merchantJob, rankingsJob, statsJob, zonesJob } from '#/index.ts';
import { getPlayer, savePlayer } from '#/repo.ts';
import { statDay } from '#/stats.ts';
import { createTestAlliance } from '#test/support/alliance.ts';
import { addHero, createTestPlayer, setCityStats, setResearch, type TestPlayer } from '#test/support/factories.ts';
import type { TestGame } from '#test/support/game.ts';
import { patchHero } from '#test/support/heroes.ts';
import { createTrader, Res, withMerchantCurve } from '#test/support/market.ts';
import { arrange, inTestTx } from '#test/support/tx.ts';

const DAY = 86_400_000;

afterEach(() => setGameSpeed(1));

/** Set stored player fields (prestige, honor …) the way services do. */
async function setPlayer(g: TestGame, p: TestPlayer, fields: { prestige?: number; honor?: number }) {
  const row = await getPlayer(g, p.id);
  Object.assign(row, fields);
  await savePlayer(g, row);
}

const playerRow = async (db: Db, id: number) => (await db.select().from(players).where(eq(players.id, id)))[0];

describe(rankingsJob.name, () => {
  it("refreshes each player's population and prestige and honor ranks, and the alliances' totals", () =>
    inTestTx(async (db) => {
      const { a, b, al } = await arrange(db, async (g) => {
        const al = await createTestAlliance(g);
        const a = al.host;
        const b = await createTestPlayer(g);
        await setPlayer(g, a, { prestige: 100, honor: 50 });
        await setPlayer(g, b, { prestige: 200, honor: 0 });
        await setCityStats(g, b, { population: 321 });
        return { a, b, al };
      });

      await rankingsJob(db);
      expect(await playerRow(db, a.id)).toMatchObject({ prestigeRank: 2, honorRank: 1 });
      expect(await playerRow(db, b.id)).toMatchObject({ prestigeRank: 1, honorRank: 2, population: 321 });
      const [row] = await db.select().from(alliances).where(eq(alliances.id, al.id));
      expect(row).toMatchObject({ prestige: 100, honor: 50, memberCount: 1, cityCount: 1, prestigeRank: 1 });
    }));
});

describe(zonesJob.name, () => {
  it("stores every state's castle and open-flat counts for the map", () =>
    inTestTx(async (db) => {
      await arrange(db, (g) => createTestPlayer(g));
      await db.delete(worldState).where(eq(worldState.key, 'zones'));
      await zonesJob(db);
      const [row] = await db.select().from(worldState).where(eq(worldState.key, 'zones'));
      const zones = row!.value as ZoneStats[];
      expect(zones).toHaveLength(BALANCE.stateGrid ** 2);
      const { castles } = (await db.execute<{ castles: number }>(sql`select count(*)::int as castles from ${tiles} where city_id is not null`)).rows[0]!;
      expect(zones.reduce((s, z) => s + z.playerCount, 0)).toBe(castles);
      expect(castles).toBeGreaterThan(0);
    }));
});

describe(beginnerJob.name, () => {
  it('ends beginner protection of players older than its length, with a mail; younger ones keep it', () =>
    inTestTx(async (db) => {
      const now = Date.now();
      const old = await arrange(db, (g) => createTestPlayer(g), now - BALANCE.beginnerProtectionMs - DAY);
      const young = await arrange(db, (g) => createTestPlayer(g), now - BALANCE.beginnerProtectionMs + DAY);

      await beginnerJob(db);
      expect(await playerRow(db, old.id)).toMatchObject({ beginner: false });
      expect(await playerRow(db, young.id)).toMatchObject({ beginner: true });
      const sent = await db
        .select()
        .from(mails)
        .where(inArray(mails.playerId, [old.id, young.id]));
      expect(sent.filter((m) => m.system?.title.code === 'player.mail.protectionExpired.title').map((m) => m.playerId)).toEqual([old.id]);
    }));

  it('protection lasts real time, whatever the game speed', () =>
    inTestTx(async (db) => {
      setGameSpeed(2);
      const now = Date.now();
      const young = await arrange(db, (g) => createTestPlayer(g), now - BALANCE.beginnerProtectionMs / 2 - DAY);
      const old = await arrange(db, (g) => createTestPlayer(g), now - BALANCE.beginnerProtectionMs - DAY);
      await beginnerJob(db);
      expect(await playerRow(db, young.id)).toMatchObject({ beginner: true });
      expect(await playerRow(db, old.id)).toMatchObject({ beginner: false });
    }));
});

describe(merchantJob.name, () => {
  it('lets the merchant fill a resting order its price has crossed', () =>
    withMerchantCurve(() =>
      inTestTx(async (db) => {
        const bid = Math.round(merchantBase('wood') * 1.03 * 1000) / 1000;
        const b = await arrange(db, async (g) => {
          const b = await createTrader(g);
          await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.BUY, amount: 1000, price: bid });
          // b's own sale pushes the merchant's price below the bid
          await market.placeOrder(g, b.id, b.cityId, { resType: Res.WOOD, side: MarketSide.SELL, amount: 50_000, type: 'market' });
          return b;
        });
        const orders = () => arrange(db, (g) => market.myOrders(g, b.id));
        expect(await orders()).toHaveLength(1);

        await merchantJob(db);
        expect(await orders()).toEqual([]);
      }),
    ));
});

describe(statsJob.name, () => {
  it('folds daily statistics older than 60 days into months', () =>
    inTestTx(async (db) => {
      const p = await arrange(db, (g) => createTestPlayer(g));
      await db.delete(playerStats).where(eq(playerStats.playerId, p.id));
      const now = Date.now();
      const oldDay = statDay(now - 70 * DAY);
      await db.insert(playerStats).values([
        { playerId: p.id, cityId: 0, period: oldDay, counters: { 'wins.npc': 1 } },
        { playerId: p.id, cityId: 0, period: statDay(now), counters: { 'wins.npc': 2 } },
      ]);
      await statsJob(db);
      const rows = await db.select().from(playerStats).where(eq(playerStats.playerId, p.id));
      expect(rows.map((r) => r.period).sort()).toEqual([oldDay.slice(0, 7), statDay(now)].sort());
    }));
});

describe(cleanupJob.name, () => {
  it('drops pushes older than 10 minutes, chat older than 7 days, reports and alliance events older than 30 days, and old price candles', () =>
    inTestTx(async (db) => {
      const now = Date.now();
      const { p, al } = await arrange(db, async (g) => {
        const al = await createTestAlliance(g);
        return { p: al.host, al };
      });
      const MIN = 60_000;
      const push = (createdAt: number) => ({ playerIds: [p.id], cmd: 'test.cleanup', data: { createdAt }, createdAt });
      await db.insert(pushMessages).values([push(now - 11 * MIN), push(now - 9 * MIN)]);
      const chat = (sentAt: number) => ({ channel: 'world', fromPlayerId: p.id, fromName: p.name, message: 'cleanup test', sentAt });
      await db.insert(chatMessages).values([chat(now - 8 * DAY), chat(now - 6 * DAY)]);
      const report = (eventTime: number) => ({
        playerId: p.id,
        title: msg('common.invalidData'),
        body: { kind: 'text' as const, text: msg('common.invalidData') },
        eventTime,
      });
      await db.insert(reports).values([report(now - 31 * DAY), report(now - 29 * DAY)]);
      const event = (createdAt: number) => ({ allianceId: al.id, message: msg('common.invalidData'), createdAt });
      await db.insert(allianceEvents).values([event(now - 31 * DAY), event(now - 29 * DAY)]);
      const keep = BALANCE.marketCandles.keepMs;
      const candle = (period: CandlePeriod, start: number) => ({
        resType: Res.FOOD,
        scope: 'world',
        period,
        start,
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
        gold: 1,
        trades: 1,
      });
      await db
        .insert(marketCandles)
        .values([
          candle(CandlePeriod.MINUTE, now - keep.minute - MIN),
          candle(CandlePeriod.MINUTE, now - keep.minute + MIN),
          candle(CandlePeriod.HOUR, now - keep.hour - MIN),
          candle(CandlePeriod.HOUR, now - keep.hour + MIN),
          candle(CandlePeriod.DAY, now - 3 * keep.hour),
        ]);

      await cleanupJob(db);
      const pushes = await db.select().from(pushMessages).where(eq(pushMessages.cmd, 'test.cleanup'));
      expect(pushes.map((r) => r.createdAt)).toEqual([now - 9 * MIN]);
      const chats = await db.select().from(chatMessages).where(eq(chatMessages.message, 'cleanup test'));
      expect(chats.map((r) => r.sentAt)).toEqual([now - 6 * DAY]);
      const kept = await db.select().from(reports).where(eq(reports.playerId, p.id));
      expect(kept.map((r) => r.eventTime)).toEqual([now - 29 * DAY]);
      const events = await db
        .select()
        .from(allianceEvents)
        .where(and(eq(allianceEvents.allianceId, al.id), sql`${allianceEvents.createdAt} < ${now - DAY}`));
      expect(events.map((r) => r.createdAt)).toEqual([now - 29 * DAY]);
      const candles = await db.select({ period: marketCandles.period, start: marketCandles.start }).from(marketCandles).orderBy(marketCandles.start);
      expect(candles).toEqual([
        { period: CandlePeriod.DAY, start: now - 3 * keep.hour },
        { period: CandlePeriod.HOUR, start: now - keep.hour + MIN },
        { period: CandlePeriod.MINUTE, start: now - keep.minute + MIN },
      ]);
    }));
});

describe(heroGearJob.name, () => {
  it('re-applies the current gear rules to heroes whose stored gear points are out of date, and only to them', () =>
    inTestTx(async (db) => {
      const id = await arrange(db, async (g) => {
        const p = await createTestPlayer(g);
        const id = await addHero(g, p);
        await patchHero(g, id, { level: 30 });
        await setResearch(g, p, TechType.HERO_ENHANCEMENT, 3);
        return id;
      });
      // gear points stored under older rules
      await db.update(heroes).set({ powerAdded: 999, managementAdded: 999, stratagemAdded: 999 }).where(eq(heroes.id, id));

      expect(await heroGearJob(db)).toBeGreaterThanOrEqual(1);
      const [h] = await db.select().from(heroes).where(eq(heroes.id, id));
      const stat = heroGearStat(h!);
      expect(h![`${stat}Added`]).toBe(heroGearBonus(30, { level: 3, stars: {} }));
      expect([h!.powerAdded, h!.managementAdded, h!.stratagemAdded].filter((n) => n > 0)).toHaveLength(1);
      expect(await heroGearJob(db)).toBe(0);
    }));
});

describe(innNamesJob.name, () => {
  it("renames the Inn's heroes still under the old generator's names, keeping their stats, and leaves hired heroes be", () =>
    inTestTx(async (db) => {
      const { offer, hired } = await arrange(db, async (g) => {
        const p = await createTestPlayer(g);
        return { offer: await addHero(g, p), hired: await addHero(g, p) };
      });
      await db.update(heroes).set({ name: 'Aldric the Bold', inTavern: true, playerId: null }).where(eq(heroes.id, offer));
      await db.update(heroes).set({ name: 'Isolde the Fair' }).where(eq(heroes.id, hired));
      const [before] = await db.select().from(heroes).where(eq(heroes.id, offer));

      expect(await innNamesJob(db)).toBe(1);
      const [after] = await db.select().from(heroes).where(eq(heroes.id, offer));
      expect(after!.name).not.toMatch(/ the /);
      expect({ ...after, name: '', sex: 0 }).toEqual({ ...before, name: '', sex: 0 });
      const [kept] = await db.select().from(heroes).where(eq(heroes.id, hired));
      expect(kept!.name).toBe('Isolde the Fair');
      expect(await innNamesJob(db)).toBe(0);
    }));
});
