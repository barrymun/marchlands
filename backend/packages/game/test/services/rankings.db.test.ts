import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { AllianceRank, BALANCE, BuildingType, msg } from '@marchlands/core';
import { alliances, heroes as heroTable } from '@marchlands/db';
import { addPrestige, admin, alliance, getPlayer, heroes, rankings, savePlayer } from '../../src/index.ts';
import { expectRefused } from '../support/expect.ts';
import { addHero, createTestPlayer, reloadPlayer, setBuildings, setCityStats, setTownHall, type TestPlayer } from '../support/factories.ts';
import { game, type TestGame } from '../support/game.ts';
import { foundAlliance, joinAlliance } from '../support/alliance.ts';

/** Set a player's prestige and honour. */
async function setFame(g: TestGame, p: TestPlayer, fame: { prestige?: number; honor?: number }) {
  const row = await getPlayer(g, p.id);
  if (fame.prestige != null) addPrestige(row, fame.prestige - row.prestige);
  if (fame.honor != null) row.honor = fame.honor;
  await savePlayer(g, row);
}

// the rankings cover the whole (otherwise empty) test world, so ranks are exact
describe(rankings.refreshRankings.name, () => {
  it('caches population and the prestige and honour ranks of every player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await setFame(g, a, { prestige: 100, honor: 5 });
      await setFame(g, b, { prestige: 300, honor: 1 });
      await setFame(g, c, { prestige: 100, honor: 9 });
      await setCityStats(g, b, { population: 1234 });
      await rankings.refreshRankings(g);
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
      await rankings.refreshRankings(g);
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

describe(rankings.playerRanking.name, () => {
  it('ranks players by prestige by default, with their alliance and cities', () =>
    game(async (g) => {
      const a = await createTestPlayer(g, { name: 'Alda' });
      const b = await createTestPlayer(g, { name: 'Bern' });
      await setFame(g, a, { prestige: 100.7, honor: 3.9 });
      await setFame(g, b, { prestige: 200 });
      await foundAlliance(g, a, 'Order');
      await rankings.refreshRankings(g);
      const r = await rankings.playerRanking(g, 2, 1, 10);
      expect(r).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      const pa = await reloadPlayer(g, a);
      expect(r.beans).toEqual([
        expect.objectContaining({ ranking: 1, id: b.id, userName: 'Bern', prestige: 200, alliance: '', allianceRank: null }),
        {
          ranking: 2,
          id: a.id,
          userName: 'Alda',
          prestige: 100,
          honor: 3,
          titleId: 0,
          population: BALANCE.startPopulation,
          castleCount: 1,
          alliance: 'Order',
          allianceRank: AllianceRank.HOST,
          flag: pa.flag,
          faceUrl: pa.faceUrl,
        },
      ]);
      // an unknown sort is by prestige
      expect((await rankings.playerRanking(g, 99, 1, 10)).beans.map((x) => x.id)).toEqual([b.id, a.id]);
    }));

  it('sorts by title, honour, cities and population', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g);
      await setFame(g, a, { prestige: 300, honor: 1 });
      await setFame(g, b, { prestige: 200, honor: 3 });
      await setFame(g, c, { prestige: 100, honor: 2 });
      await admin.setPlayerFlags(g, c.name, { title: 2 });
      await admin.setPlayerFlags(g, b.name, { title: 2 });
      await setCityStats(g, a, { population: 10 });
      await setCityStats(g, c, { population: 900 });
      await rankings.refreshRankings(g);
      const ids = async (sort: number) => (await rankings.playerRanking(g, sort, 1, 10)).beans.map((x) => x.id);
      expect(await ids(1)).toEqual([b.id, c.id, a.id]); // title, then prestige
      expect(await ids(3)).toEqual([b.id, c.id, a.id]);
      expect(await ids(4)).toEqual([a.id, b.id, c.id]); // one city each: by prestige
      expect(await ids(5)).toEqual([c.id, b.id, a.id]);
    }));

  it('pages, and searches names case-insensitively keeping the overall rank', () =>
    game(async (g) => {
      const names = ['Rook', 'Raven', 'Robin', 'Wren', 'Rail'];
      const ps = [];
      for (const [i, name] of names.entries()) {
        const p = await createTestPlayer(g, { name });
        await setFame(g, p, { prestige: 1000 - i });
        ps.push(p);
      }
      const page2 = await rankings.playerRanking(g, 2, 2, 2);
      expect(page2).toMatchObject({ pageNo: 2, pageSize: 2, totalPage: 3 });
      expect(page2.beans.map((x) => [x.ranking, x.userName])).toEqual([
        [3, 'Robin'],
        [4, 'Wren'],
      ]);
      const found = await rankings.playerRanking(g, 2, 1, 10, 'rA');
      expect(found).toMatchObject({ totalPage: 1 });
      expect(found.beans.map((x) => [x.ranking, x.userName])).toEqual([
        [2, 'Raven'],
        [5, 'Rail'],
      ]);
      // LIKE wildcards in the key are ignored, not interpreted
      expect((await rankings.playerRanking(g, 2, 1, 10, 'R_n')).beans).toEqual([]);
      expect((await rankings.playerRanking(g, 2, 1, 10, 'Wr%')).beans.map((x) => x.userName)).toEqual(['Wren']);
      expect((await rankings.playerRanking(g, 2, 1, 10, '%')).beans).toHaveLength(5);
      expect(await rankings.playerRanking(g, 2, 1, 10, 'nobody')).toEqual({ pageNo: 1, pageSize: 10, totalPage: 0, beans: [] });
    }));

  it('a page number below 1 or missing is page 1; a page past the end is empty', () =>
    game(async (g) => {
      await createTestPlayer(g);
      expect((await rankings.playerRanking(g, 2, 0, 10)).pageNo).toBe(1);
      expect((await rankings.playerRanking(g, 2, -3, 10)).beans).toHaveLength(1);
      expect((await rankings.playerRanking(g, 2, NaN, 10)).pageNo).toBe(1);
      expect((await rankings.playerRanking(g, 2, 2.7, 10)).pageNo).toBe(2);
      expect((await rankings.playerRanking(g, 2, 5, 10)).beans).toEqual([]);
    }));

  it('rejects a page size outside 1 to 50', () =>
    game(async (g) => {
      for (const size of [0, 51, 2.5, NaN]) await expectRefused(rankings.playerRanking(g, 2, 1, size), msg('common.invalidData'));
      expect((await rankings.playerRanking(g, 2, 1, 50)).pageSize).toBe(50);
    }));
});

describe(rankings.allianceRanking.name, () => {
  it('ranks alliances by members by default, with leader, founder and intro', () =>
    game(async (g) => {
      const a = await createTestPlayer(g, { name: 'Alda' });
      const b = await createTestPlayer(g);
      const c = await createTestPlayer(g, { name: 'Cato' });
      await setFame(g, a, { prestige: 10, honor: 1.5 });
      await setFame(g, b, { prestige: 20, honor: 2 });
      await setFame(g, c, { prestige: 1000, honor: 1 });
      await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      await alliance.setInfo(g, a.id, { intro: 'We keep order' });
      await foundAlliance(g, c, 'Chaos');
      await rankings.refreshRankings(g);
      const r = await rankings.allianceRanking(g, 1, 1, 10);
      expect(r).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      expect(r.beans).toEqual([
        { rank: 1, name: 'Order', member: 2, prestige: 30, honor: 3, city: 2, playerName: 'Alda', createrName: 'Alda', description: 'We keep order' },
        { rank: 2, name: 'Chaos', member: 1, prestige: 1000, honor: 1, city: 1, playerName: 'Cato', createrName: 'Cato', description: '' },
      ]);
      expect((await rankings.allianceRanking(g, 99, 1, 10)).beans.map((x) => x.name)).toEqual(['Order', 'Chaos']);
      expect((await rankings.allianceRanking(g, 2, 1, 10)).beans.map((x) => x.name)).toEqual(['Chaos', 'Order']);
      expect((await rankings.allianceRanking(g, 3, 1, 10)).beans.map((x) => x.name)).toEqual(['Order', 'Chaos']);
    }));

  it('shows the current leader after a hand-over', () =>
    game(async (g) => {
      const a = await createTestPlayer(g, { name: 'Alda' });
      const b = await createTestPlayer(g, { name: 'Bern' });
      await foundAlliance(g, a, 'Order');
      await joinAlliance(g, a, b, 'Order');
      await alliance.setRank(g, a.id, b.name, AllianceRank.VICE_HOST);
      await alliance.transferHost(g, a.id, b.name);
      const [bean] = (await rankings.allianceRanking(g, 1, 1, 10)).beans;
      expect(bean).toMatchObject({ playerName: 'Bern', createrName: 'Alda' });
    }));

  it('searches and pages', () =>
    game(async (g) => {
      for (const name of ['Order', 'Chaos', 'Ordo']) await foundAlliance(g, await createTestPlayer(g), name);
      await rankings.refreshRankings(g);
      expect((await rankings.allianceRanking(g, 2, 1, 10, 'ORD')).beans.map((x) => x.name)).toEqual(['Order', 'Ordo']);
      const p2 = await rankings.allianceRanking(g, 2, 2, 2);
      expect(p2).toMatchObject({ pageNo: 2, totalPage: 2 });
      expect(p2.beans.map((x) => x.rank)).toEqual([3]);
      await expectRefused(rankings.allianceRanking(g, 1, 1, 0), msg('common.invalidData'));
    }));
});

describe(rankings.heroRanking.name, () => {
  it("ranks hired heroes by level by default, named with their lord's name", () =>
    game(async (g) => {
      const a = await createTestPlayer(g, { name: 'Alda' });
      const ids = [await addHero(g, a, 10), await addHero(g, a, 10), await addHero(g, a, 10)];
      const rows = await g.tx.select().from(heroTable);
      const r = await rankings.heroRanking(g, 1, 1, 10);
      expect(r).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      expect(r.beans.map((x) => x.kind)).toEqual(['Alda', 'Alda', 'Alda']);
      const byLevel = [...rows].sort((x, y) => y.level - x.level || x.id - y.id);
      expect(r.beans).toEqual(
        byLevel.map((h, i) => ({ rank: i + 1, name: h.name, grade: h.level, power: h.power, management: h.management, stratagem: h.stratagem, kind: 'Alda' })),
      );
      expect(rows.map((h) => h.id).sort()).toEqual([...ids].sort());
    }));

  it('sorts by management, power and stratagem', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (let i = 0; i < 4; i++) await addHero(g, a, 10);
      const rows = await g.tx.select().from(heroTable);
      for (const [sort, key] of [
        [2, 'management'],
        [3, 'power'],
        [4, 'stratagem'],
      ] as const) {
        const expected = [...rows].sort((x, y) => y[key] - x[key] || x.id - y.id).map((h) => h.name);
        expect((await rankings.heroRanking(g, sort, 1, 10)).beans.map((x) => x.name)).toEqual(expected);
      }
    }));

  it('leaves out tavern offers and captured heroes', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await setBuildings(g, a, [[0, BuildingType.INN, 1]]);
      const offers = await heroes.tavern(g, a.id, a.cityId);
      expect(offers.heros.length).toBeGreaterThan(0);
      const kept = await addHero(g, a);
      const captured = await addHero(g, a);
      await g.tx.update(heroTable).set({ capturedByPlayerId: b.id }).where(eq(heroTable.id, captured));
      const [hero] = await g.tx.select().from(heroTable).where(eq(heroTable.id, kept));
      expect((await rankings.heroRanking(g, 1, 1, 10)).beans.map((x) => x.name)).toEqual([hero.name]);
    }));

  it('searches hero names', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (let i = 0; i < 3; i++) await addHero(g, a);
      const [first] = await g.tx.select().from(heroTable);
      const found = await rankings.heroRanking(g, 1, 1, 10, first.name.toUpperCase());
      expect(found.beans.map((x) => x.name)).toContain(first.name);
      expect(found.beans.every((x) => x.name.toLowerCase().includes(first.name.toLowerCase()))).toBe(true);
      expect((await rankings.heroRanking(g, 1, 1, 10, 'zzzz-no-hero')).totalPage).toBe(0);
      await expectRefused(rankings.heroRanking(g, 1, 1, 51), msg('common.invalidData'));
    }));
});

describe(rankings.castleRanking.name, () => {
  it('ranks cities by population by default, with town hall level, owner and alliance', () =>
    game(async (g) => {
      const a = await createTestPlayer(g, { name: 'Alda' });
      const b = await createTestPlayer(g, { name: 'Bern' });
      await foundAlliance(g, a, 'Order');
      await setCityStats(g, a, { population: 200 });
      await setCityStats(g, b, { population: 900 });
      await setTownHall(g, a, 5);
      const r = await rankings.castleRanking(g, 1, 1, 10);
      expect(r).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      expect(r.beans).toEqual([
        { rank: 1, name: 'Bern City', level: 1, grade: 'Level 1', population: 900, kind: 'Bern', alliance: '' },
        { rank: 2, name: 'Alda City', level: 5, grade: 'Level 5', population: 200, kind: 'Alda', alliance: 'Order' },
      ]);
      expect((await rankings.castleRanking(g, 2, 1, 10)).beans.map((x) => x.name)).toEqual(['Alda City', 'Bern City']);
      expect((await rankings.castleRanking(g, 7, 1, 10)).beans.map((x) => x.name)).toEqual(['Bern City', 'Alda City']);
    }));

  it('by level, equal levels go by population; a city without a town hall is level 0', () =>
    game(async (g) => {
      await createTestPlayer(g, { name: 'Alda' });
      const b = await createTestPlayer(g, { name: 'Bern' });
      const c = await createTestPlayer(g, { name: 'Cato' });
      await setCityStats(g, b, { population: 500 });
      await setTownHall(g, c, 0);
      const r = await rankings.castleRanking(g, 2, 1, 10);
      expect(r.beans.map((x) => [x.name, x.level])).toEqual([
        ['Bern City', 1],
        ['Alda City', 1],
        ['Cato City', 0],
      ]);
      expect(r.beans[2].grade).toBe('Level 0');
    }));

  it('searches city names and pages', () =>
    game(async (g) => {
      for (const name of ['Alda', 'Bern', 'Cato']) await createTestPlayer(g, { name });
      expect((await rankings.castleRanking(g, 1, 1, 10, 'bern c')).beans.map((x) => x.name)).toEqual(['Bern City']);
      const p2 = await rankings.castleRanking(g, 1, 2, 2);
      expect(p2).toMatchObject({ pageNo: 2, totalPage: 2 });
      expect(p2.beans).toHaveLength(1);
      await expectRefused(rankings.castleRanking(g, 1, 1, -1), msg('common.invalidData'));
    }));
});
