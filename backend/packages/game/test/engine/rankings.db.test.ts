import { describe, expect, it } from 'vitest';

import { BALANCE } from '@marchlands/core';
import { alliances } from '@marchlands/db';

import { refreshRankings } from '#/engine/rankings.ts';
import { foundAlliance, joinAlliance } from '#test/support/alliance.ts';
import { createTestPlayer, reloadPlayer, setCityStats } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { setFame } from '#test/support/rankings.ts';

// the rankings cover the whole (otherwise empty) test world, so ranks are exact
describe(refreshRankings.name, () => {
  it('caches population and the prestige and honour ranks of every player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await setFame(g, a, { prestige: 100, honor: 5 });
      await setFame(g, b, { prestige: 300, honor: 1 });
      await setFame(g, c, { prestige: 100, honor: 9 });
      await setCityStats(g, b, { population: 1234 });
      await refreshRankings(g);
      expect(await reloadPlayer(g, a)).toMatchObject({ prestigeRank: 2, honorRank: 2, population: BALANCE.startPopulation });
      expect(await reloadPlayer(g, b)).toMatchObject({ prestigeRank: 1, honorRank: 3, population: 1234 });
      // equal prestige: the older player first
      expect(await reloadPlayer(g, c)).toMatchObject({ prestigeRank: 3, honorRank: 1 });
    }));

  it('aggregates alliance members, cities and ranks', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await setFame(g, a, { prestige: 100, honor: 10 });
      await setFame(g, b, { prestige: 50, honor: 20 });
      await setFame(g, c, { prestige: 500, honor: 1 });
      await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      await foundAlliance(g, c, 'Chaos');
      await refreshRankings(g);
      const rows = await g.tx.select().from(alliances).orderBy(alliances.id);
      const pick = ({ name, prestige, honor, memberCount, cityCount, prestigeRank, honorRank, membersRank }: (typeof rows)[number]) => ({
        name,
        prestige,
        honor,
        memberCount,
        cityCount,
        prestigeRank,
        honorRank,
        membersRank,
      });
      expect(rows.map(pick)).toEqual([
        { name: 'Order', prestige: 150, honor: 30, memberCount: 2, cityCount: 2, prestigeRank: 2, honorRank: 1, membersRank: 1 },
        { name: 'Chaos', prestige: 500, honor: 1, memberCount: 1, cityCount: 1, prestigeRank: 1, honorRank: 2, membersRank: 2 },
      ]);
    }));
});
