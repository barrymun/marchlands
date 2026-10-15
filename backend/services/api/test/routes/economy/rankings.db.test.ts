import { describe, expect, it } from 'vitest';

import type { RankingAlliancePage, RankingCastlePage, RankingHeroPage, RankingPlayerPage } from '@marchlands/contracts';
import { BALANCE } from '@marchlands/core';
import { admin } from '@marchlands/game';

import { apiTest } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsToken } from '#test/support/guards.ts';

const KINDS = ['players', 'alliances', 'heroes', 'castles'];

describe('authentication', () => {
  it('rankings need a token, but no player', () =>
    apiTest(async (api) => {
      await expectNeedsToken(
        api,
        KINDS.map((k) => ({ method: 'GET', url: `rankings/${k}` })),
      );
      const a = await accountWithoutPlayer(api);
      for (const k of KINDS) await api.ok('GET', `rankings/${k}`, { token: a.token });
    }));
});

describe('GET /rankings/players', () => {
  it('ranks the players with cities, filtered by name', () =>
    apiTest(async (api) => {
      const p = await api.player('Ranked');
      await api.player('Other');
      const page = await api.ok<RankingPlayerPage>('GET', 'rankings/players?sortType=4&pageSize=5', { token: p.token });
      expect(page).toMatchObject({ pageNo: 1, pageSize: 5, totalPage: 1 });
      expect(page.beans.map((b) => b.ranking)).toEqual([1, 2]);
      const found = await api.ok<RankingPlayerPage>('GET', 'rankings/players?key=rank', { token: p.token });
      expect(found.beans).toEqual([expect.objectContaining({ id: p.playerId, userName: 'Ranked', castleCount: 1, alliance: '', allianceRank: null })]);
    }));

  it('validates the query', () =>
    apiTest(async (api) => {
      const a = await accountWithoutPlayer(api);
      await expectInvalid(api, a.token, [
        { method: 'GET', url: 'rankings/players?pageSize=51' },
        { method: 'GET', url: 'rankings/players?pageNo=0' },
        { method: 'GET', url: 'rankings/players?sortType=prestige' },
      ]);
    }));
});

describe('GET /rankings/alliances', () => {
  it('ranks the alliances', () =>
    apiTest(async (api) => {
      const host = await api.player('Leader');
      await api.game((ctx) => admin.setResources(ctx, host.cityId, host.playerId, { gold: BALANCE.allianceCreateGold }));
      await api.ok('POST', 'alliance', { token: host.token, body: { cityId: host.cityId, allianceName: 'Ranked Order' } });
      const page = await api.ok<RankingAlliancePage>('GET', 'rankings/alliances?sortType=1', { token: host.token });
      expect(page.beans).toEqual([expect.objectContaining({ rank: 1, name: 'Ranked Order', member: 1, playerName: 'Leader', createrName: 'Leader' })]);
    }));
});

describe('GET /rankings/heroes', () => {
  it('ranks the heroes with their owner', () =>
    apiTest(async (api) => {
      const p = await api.player('Keeper');
      await api.game((ctx) => admin.addHero(ctx, p.cityId, p.playerId, 5));
      const page = await api.ok<RankingHeroPage>('GET', 'rankings/heroes?sortType=1', { token: p.token });
      expect(page.beans).toEqual([expect.objectContaining({ rank: 1, kind: 'Keeper', grade: expect.any(Number), name: expect.any(String) })]);
    }));
});

describe('GET /rankings/castles', () => {
  it('ranks the cities with their owner', () =>
    apiTest(async (api) => {
      const p = await api.player('Builder');
      const page = await api.ok<RankingCastlePage>('GET', 'rankings/castles?key=builder', { token: p.token });
      expect(page.beans).toEqual([expect.objectContaining({ rank: 1, name: 'Builder City', kind: 'Builder', level: 1, alliance: '' })]);
    }));
});
