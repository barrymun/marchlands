import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { TREND_DAYS, TREND_KEYS, type TrendKey } from '@marchlands/core';
import { playerStats, worldState } from '@marchlands/db';

import { statistics } from '#/index.ts';
import { statDay } from '#/stats.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';

const DAY = 86_400_000;

/** A trend line of nothing for each headline number. */
const noTrend = () => Object.fromEntries(TREND_KEYS.map((k) => [k, Array.from({ length: TREND_DAYS }, () => 0)])) as Record<TrendKey, number[]>;

/** `noTrend` with the values given for a trend's last days, today last. */
function trendEnding(key: TrendKey, ...last: number[]) {
  const t = noTrend();
  t[key] = [...t[key].slice(0, TREND_DAYS - last.length), ...last];
  return t;
}

/** Write lord statistics as flushStats would have (city 0: the lord as a whole). */
async function stats(g: TestGame, playerId: number, cityId: number, period: string, counters: Record<string, number>) {
  await g.tx.insert(playerStats).values({ playerId, cityId, period, counters });
}

describe(statistics.lordStatistics.name, () => {
  it('is empty for a new player, listing their city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await statistics.lordStatistics(g, a.id)).toEqual({
        allTime: {},
        last7Days: {},
        cities: [{ cityId: a.cityId, name: `${a.name} City`, owned: true, allTime: {}, last7Days: {}, trend: noTrend() }],
        since: expect.any(Number),
        days: expect.any(Array),
        trend: noTrend(),
      });
    }));

  it('sums all time and the last 7 days (today and the 6 days before), for the lord and per city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await stats(g, a.id, 0, statDay(T0), { 'wins.npc': 1 });
      await stats(g, a.id, a.cityId, statDay(T0), { 'trained.archer': 10, 'produced.food': 500 });
      await stats(g, a.id, a.cityId, statDay(T0 - 6 * DAY), { 'trained.archer': 5 });
      await stats(g, a.id, a.cityId, statDay(T0 - 7 * DAY), { 'trained.archer': 100 });
      await stats(g, a.id, a.cityId, '2025-10', { 'trained.archer': 1000, 'produced.food': 7 }); // a compacted month
      const s = await statistics.lordStatistics(g, a.id);
      expect(s.allTime).toEqual({ 'wins.npc': 1, 'trained.archer': 1115, 'produced.food': 507 });
      expect(s.last7Days).toEqual({ 'wins.npc': 1, 'trained.archer': 15, 'produced.food': 500 });
      expect(s.cities).toEqual([
        {
          cityId: a.cityId,
          name: `${a.name} City`,
          owned: true,
          allTime: { 'trained.archer': 1115, 'produced.food': 507 },
          last7Days: { 'trained.archer': 15, 'produced.food': 500 },
          trend: trendEnding('trained', 100, 5, 0, 0, 0, 0, 0, 10),
        },
      ]);
    }));

  it("counts only the player's own rows", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await stats(g, a.id, a.cityId, statDay(T0), { 'trained.archer': 1 });
      await stats(g, b.id, b.cityId, statDay(T0), { 'trained.archer': 2 });
      const s = await statistics.lordStatistics(g, a.id);
      expect(s.allTime).toEqual({ 'trained.archer': 1 });
      expect(s.cities.map((c) => c.cityId)).toEqual([a.cityId]);
    }));

  it('lists a city now held by someone else without its name, and one that no longer exists last', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const gone = 2_000_000_000;
      await stats(g, a.id, gone, statDay(T0), { 'trained.archer': 3 });
      await stats(g, a.id, b.cityId, statDay(T0 - 30 * DAY), { 'trained.archer': 2 }); // a city a lost to b
      const s = await statistics.lordStatistics(g, a.id);
      expect(s.cities).toEqual([
        { cityId: a.cityId, name: `${a.name} City`, owned: true, allTime: {}, last7Days: {}, trend: noTrend() },
        { cityId: b.cityId, name: null, owned: false, allTime: { 'trained.archer': 2 }, last7Days: {}, trend: noTrend() },
        { cityId: gone, name: null, owned: false, allTime: { 'trained.archer': 3 }, last7Days: { 'trained.archer': 3 }, trend: trendEnding('trained', 3) },
      ]);
      expect(s.allTime).toEqual({ 'trained.archer': 5 });
    }));

  it('counts the headline numbers day by day over the last days, for the lord and per city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await stats(g, a.id, a.cityId, statDay(T0), {
        'attacks.won.npc': 3,
        'attacks.won.valley': 1,
        'attacks.lost.npc': 9,
        honor: 40,
        'killed.militia': 7,
        'killed.trap': 2,
      });
      await stats(g, a.id, a.cityId, statDay(T0 - DAY), { 'trained.archer': 10, 'trained.trap': 5, 'captured.npc': 1, 'captured.valley': 4 });
      await stats(g, a.id, 0, statDay(T0 - 2 * DAY), { honor: 6 });
      await stats(g, a.id, a.cityId, statDay(T0 - TREND_DAYS * DAY), { 'attacks.won.npc': 100 }); // a day before the trends
      await stats(g, a.id, a.cityId, '2025-10', { 'attacks.won.npc': 1000 }); // a compacted month
      const s = await statistics.lordStatistics(g, a.id);
      expect(s.days).toHaveLength(TREND_DAYS);
      expect(s.days.at(-1)).toBe(statDay(T0));
      const last3 = (k: TrendKey) => s.trend[k].slice(-3);
      expect(last3('attacksWon')).toEqual([0, 0, 4]);
      expect(last3('honor')).toEqual([6, 0, 40]);
      expect(last3('enemies')).toEqual([0, 0, 9]);
      expect(last3('trained')).toEqual([0, 15, 0]);
      expect(last3('captured')).toEqual([0, 1, 0]);
      expect(last3('defensesWon')).toEqual([0, 0, 0]);
      expect(s.trend.attacksWon.reduce((x, y) => x + y, 0)).toBe(4);
      // the city's own: the honour on the lord as a whole (city 0) isn't the city's
      expect(s.cities[0]?.trend.honor.slice(-3)).toEqual([0, 0, 40]);
      expect(s.cities[0]?.trend.trained.slice(-3)).toEqual([0, 15, 0]);
    }));

  it('says since when statistics are kept (world state statsStartedAt), or null when unknown', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const at = T0 - 90 * DAY;
      await g.tx.update(worldState).set({ value: { at } }).where(eq(worldState.key, 'statsStartedAt'));
      expect((await statistics.lordStatistics(g, a.id)).since).toBe(at);
      await g.tx.delete(worldState).where(eq(worldState.key, 'statsStartedAt'));
      expect((await statistics.lordStatistics(g, a.id)).since).toBeNull();
    }));
});
