import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { playerStats, worldState } from '@marchlands/db';
import { statDay } from '#/stats.ts';
import { statistics } from '#/index.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';

const DAY = 86_400_000;

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
        cities: [{ cityId: a.cityId, name: `${a.name} City`, owned: true, allTime: {}, last7Days: {} }],
        since: expect.any(Number),
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
        { cityId: a.cityId, name: `${a.name} City`, owned: true, allTime: {}, last7Days: {} },
        { cityId: b.cityId, name: null, owned: false, allTime: { 'trained.archer': 2 }, last7Days: {} },
        { cityId: gone, name: null, owned: false, allTime: { 'trained.archer': 3 }, last7Days: { 'trained.archer': 3 } },
      ]);
      expect(s.allTime).toEqual({ 'trained.archer': 5 });
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
