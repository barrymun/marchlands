import { describe, expect, it } from 'vitest';

import type { ReportCounts, ReportDetail, ReportList, ReportSettings } from '@marchlands/contracts';
import { msg, ReportType } from '@marchlands/core';
import { createReport } from '@marchlands/game/testing';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { accountWithoutPlayer, expectInvalid, expectNeedsPlayer, expectNeedsToken, type RouteCall } from '#test/support/guards.ts';

const ROUTES: RouteCall[] = [
  { method: 'GET', url: 'reports' },
  { method: 'GET', url: 'reports/unread' },
  { method: 'GET', url: 'reports/settings' },
  { method: 'POST', url: 'reports/settings', body: { autoReadReturns: false } },
  { method: 'GET', url: 'reports/1' },
  { method: 'POST', url: 'reports/read', body: {} },
  { method: 'POST', url: 'reports/delete', body: { ids: [1] } },
];

const TRADE = { kind: 'trade' as const, trade: { side: 'buy' as const, resource: 'wood' as const, amount: 100, price: 1, gold: 100 } };

/** A trade report (tab 0) and an army report (tab 1) for the player, as the game files them; returns their ids. */
async function withReports(api: TestApi, playerId: number) {
  return api.game(async (ctx) => ({
    trade: await createReport(ctx, { playerId, typeId: ReportType.TRADE, title: msg('report.title.tradeCompleted'), body: TRADE }),
    army: await createReport(ctx, { playerId, typeId: ReportType.ARMY, title: msg('report.title.tradeCompleted'), body: TRADE }),
  }));
}

describe('authentication', () => {
  it('every report route needs a token and a player', () =>
    apiTest(async (api) => {
      await expectNeedsToken(api, ROUTES);
      await expectNeedsPlayer(api, (await accountWithoutPlayer(api)).token, ROUTES);
    }));
});

describe('GET /reports', () => {
  it('answers a page of reports, of every tab or of one', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const ids = await withReports(api, p.playerId);
      const all = await api.ok<ReportList>('GET', 'reports', { token: p.token });
      expect(all).toMatchObject({ pageNo: 1, pageSize: 10, totalPage: 1 });
      expect(all.reports.map((r) => r.id).sort()).toEqual([ids.trade, ids.army].sort());
      expect(all.reports[0]).toMatchObject({ title: { code: 'report.title.tradeCompleted' }, isRead: false, attack: false, back: false });
      const trade = await api.ok<ReportList>('GET', 'reports?type=0', { token: p.token });
      expect(trade.reports).toEqual([expect.objectContaining({ id: ids.trade, type: 0 })]);
    }));

  it('searches and filters', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const ids = await withReports(api, p.playerId);
      await api.ok('POST', 'reports/read', { token: p.token, body: { ids: [ids.army] } });
      const list = async (query: string) => (await api.ok<ReportList>('GET', `reports?${query}`, { token: p.token })).reports.map((r) => r.id);
      expect(await list('unread=true')).toEqual([ids.trade]);
      expect((await list('unread=false')).sort()).toEqual([ids.trade, ids.army].sort());
      expect((await list('kind=other')).sort()).toEqual([ids.trade, ids.army].sort());
      expect(await list('kind=battles')).toEqual([]);
      expect(await list(`q=${encodeURIComponent('(1,2)')}`)).toEqual([]);
      expect(await list('order=oldest')).toEqual([ids.trade, ids.army]);
      expect(await list('order=newest')).toEqual([ids.army, ids.trade]);
    }));

  it('validates the query', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await expectInvalid(api, p.token, [
        { method: 'GET', url: 'reports?pageSize=0' },
        { method: 'GET', url: 'reports?type=army' },
        { method: 'GET', url: 'reports?kind=sieges' },
        { method: 'GET', url: 'reports?unread=yes' },
        { method: 'GET', url: 'reports?order=random' },
        { method: 'GET', url: `reports?q=${'x'.repeat(61)}` },
      ]);
    }));
});

describe('GET /reports/unread', () => {
  it('counts unread reports by tab', () =>
    apiTest(async (api) => {
      const p = await api.player();
      await withReports(api, p.playerId);
      expect(await api.ok<ReportCounts>('GET', 'reports/unread', { token: p.token })).toEqual({ count: 2, trade_count: 1, army_count: 1, other_count: 0 });
    }));
});

describe('GET /reports/:reportId', () => {
  it('answers the report with its body and marks it read', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const ids = await withReports(api, p.playerId);
      const r = await api.ok<ReportDetail>('GET', `reports/${ids.trade}`, { token: p.token });
      expect(r).toMatchObject({ id: ids.trade, type: 0, content: TRADE });
      expect((await api.ok<ReportCounts>('GET', 'reports/unread', { token: p.token })).trade_count).toBe(0);
    }));

  it("answers 404 for an unknown report or another player's", () =>
    apiTest(async (api) => {
      const p = await api.player();
      const other = await api.player();
      const ids = await withReports(api, other.playerId);
      await api.refused('GET', `reports/${ids.trade}`, 'report.notFound', { token: p.token, status: 404 });
      await api.refused('GET', 'reports/999999', 'report.notFound', { token: p.token, status: 404 });
      await expectInvalid(api, p.token, [{ method: 'GET', url: 'reports/abc' }]);
    }));
});

describe('POST /reports/read', () => {
  it('marks the given reports read, or all without ids', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const ids = await withReports(api, p.playerId);
      expect(await api.ok('POST', 'reports/read', { token: p.token, body: { ids: [ids.army] } })).toBeNull();
      expect(await api.ok<ReportCounts>('GET', 'reports/unread', { token: p.token })).toMatchObject({ count: 1, army_count: 0 });
      await api.ok('POST', 'reports/read', { token: p.token, body: {} });
      expect((await api.ok<ReportCounts>('GET', 'reports/unread', { token: p.token })).count).toBe(0);
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'reports/read', body: { ids: 'all' } }]);
    }));
});

describe('POST /reports/delete', () => {
  it('deletes reports', () =>
    apiTest(async (api) => {
      const p = await api.player();
      const ids = await withReports(api, p.playerId);
      expect(await api.ok('POST', 'reports/delete', { token: p.token, body: { ids: [ids.trade] } })).toBeNull();
      expect((await api.ok<ReportList>('GET', 'reports', { token: p.token })).reports.map((r) => r.id)).toEqual([ids.army]);
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'reports/delete', body: {} }]);
    }));
});

describe('/reports/settings', () => {
  it('answers and changes the report settings', () =>
    apiTest(async (api) => {
      const p = await api.player();
      expect(await api.ok<ReportSettings>('GET', 'reports/settings', { token: p.token })).toEqual({ autoReadReturns: true });
      expect(await api.ok<ReportSettings>('POST', 'reports/settings', { token: p.token, body: { autoReadReturns: false } })).toEqual({
        autoReadReturns: false,
      });
      expect(await api.ok<ReportSettings>('GET', 'reports/settings', { token: p.token })).toEqual({ autoReadReturns: false });
      await expectInvalid(api, p.token, [{ method: 'POST', url: 'reports/settings', body: { autoReadReturns: 'yes' } }]);
    }));
});
