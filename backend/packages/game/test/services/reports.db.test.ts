import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { ALL_REPORTS, msg, ref, type ReportBody, ReportBodyKind, ReportKind, ReportOrder, ReportType, TileType } from '@marchlands/core';
import { reports as reportRows } from '@marchlands/db';

import { createReport } from '#/engine/reports.ts';
import { reports } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { addReport, textBody } from '#test/support/reports.ts';

describe(reports.reportCounts.name, () => {
  it('counts unread reports per tab', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      expect(await reports.reportCounts(g, a.id)).toEqual({ count: 0, trade_count: 0, army_count: 0, other_count: 0 });
      await addReport(g, a, ReportType.TRADE);
      await addReport(g, a, ReportType.ARMY);
      await addReport(g, a, ReportType.ARMY);
      const read = await addReport(g, a, ReportType.OTHER);
      await addReport(g, b, ReportType.OTHER);
      await reports.markReportsRead(g, a.id, [read]);
      expect(await reports.reportCounts(g, a.id)).toEqual({ count: 3, trade_count: 1, army_count: 2, other_count: 0 });
    }));
});

describe(reports.listReports.name, () => {
  it('pages newest first, ties by id', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const ids = [];
      for (let i = 0; i < 3; i++) {
        ids.push(await addReport(g, a));
        g.advance(1000);
      }
      ids.push(await addReport(g, a)); // same time as the next one
      ids.push(await addReport(g, a));
      const page1 = await reports.listReports(g, a.id, null, 1, 2);
      expect(page1).toMatchObject({ pageNo: 1, pageSize: 2, totalPage: 3, total: 5 });
      expect(page1.reports.map((r) => r.id)).toEqual([ids[4], ids[3]]);
      expect((await reports.listReports(g, a.id, null, 3, 2)).reports.map((r) => r.id)).toEqual([ids[0]]);
      expect((await reports.listReports(g, a.id, null, 4, 2)).reports).toEqual([]);
    }));

  it('filters by tab and shows only the player’s reports', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const trade = await addReport(g, a, ReportType.TRADE);
      await addReport(g, a, ReportType.ARMY);
      await addReport(g, b, ReportType.TRADE);
      const list = await reports.listReports(g, a.id, ReportType.TRADE, 1, 10);
      expect(list).toMatchObject({ totalPage: 1 });
      expect(list.reports.map((r) => r.id)).toEqual([trade]);
      expect((await reports.listReports(g, a.id, null, 1, 10)).reports).toHaveLength(2);
    }));

  it('lists oldest first when asked, ties by id, and pages that way', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const ids = [];
      for (let i = 0; i < 2; i++) {
        ids.push(await addReport(g, a));
        g.advance(1000);
      }
      ids.push(await addReport(g, a)); // same time as the next one
      ids.push(await addReport(g, a));
      const oldest = { order: ReportOrder.OLDEST };
      expect((await reports.listReports(g, a.id, null, 1, 3, oldest)).reports.map((r) => r.id)).toEqual(ids.slice(0, 3));
      expect((await reports.listReports(g, a.id, null, 2, 3, oldest)).reports.map((r) => r.id)).toEqual([ids[3]]);
      expect((await reports.listReports(g, a.id, null, 1, 1, { order: ReportOrder.NEWEST })).reports.map((r) => r.id)).toEqual([ids[3]]);
    }));

  it('treats a missing or low page number as the first page', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await addReport(g, a);
      for (const page of [0, -3, NaN]) expect(await reports.listReports(g, a.id, null, page, 10)).toMatchObject({ pageNo: 1, reports: [{ id }] });
    }));

  it('has no pages without reports', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await reports.listReports(g, a.id, null, 1, 10)).toEqual({ pageNo: 1, pageSize: 10, totalPage: 0, total: 0, reports: [] });
    }));

  it('rejects a page size outside 1..100', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (const size of [0, 101, 2.5, NaN]) await expectRefused(reports.listReports(g, a.id, null, 1, size), msg('common.invalidData'));
      await reports.listReports(g, a.id, null, 1, 100);
    }));
});

describe(`${reports.listReports.name}: search and filters`, () => {
  const at = (name: string, x: number, y: number) => msg('world.position.city', { name, x, y });
  const valley = (x: number, y: number) => msg('world.position.tile', { tile: ref.tile(TileType.FOREST), level: 3, x, y });
  const ids = async (g: TestGame, p: TestPlayer, filter: reports.ReportFilter, type: number | null = null) =>
    (await reports.listReports(g, p.id, type, 1, 50, filter)).reports.map((r) => r.id).sort();

  /** A battle at (12,34), a scout of Oakridge, a return home to (12,34) and a trade. */
  async function inbox(g: TestGame) {
    const a = await createTestPlayer(g);
    const base = { playerId: a.id, startPos: at('Home', 1, 2) };
    const battle = await createReport(g, { ...base, title: msg('report.title.attackSucceeded'), targetPos: valley(12, 34), body: textBody() });
    await g.tx
      .update(reportRows)
      .set({ body: { kind: ReportBodyKind.BATTLE } as unknown as ReportBody })
      .where(eq(reportRows.id, battle));
    const scout = await createReport(g, { ...base, title: msg('report.title.scoutReport'), targetPos: at('Oakridge_%', 120, 7), body: textBody() });
    await g.tx
      .update(reportRows)
      .set({ body: { kind: ReportBodyKind.SCOUT, scout: { owner: 'Eadric' } } as unknown as ReportBody })
      .where(eq(reportRows.id, scout));
    const home = await createReport(g, {
      playerId: a.id,
      title: msg('report.title.attackReturned'),
      isBack: true,
      startPos: valley(12, 34),
      targetPos: at('Home', 1, 2),
      body: { kind: ReportBodyKind.MOVEMENT, movement: { hero: null, troops: {}, resources: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 } } },
    });
    const aborted = await createReport(g, { ...base, title: msg('report.title.missionAborted'), body: textBody() });
    const trade = await addReport(g, a, ReportType.TRADE, msg('report.title.tradeCompleted'));
    return { a, battle, scout, home, aborted, trade };
  }

  it('finds the reports from or to a tile by its coordinates, however they are typed', () =>
    game(async (g) => {
      const { a, battle, home, scout } = await inbox(g);
      for (const q of ['12,34', '(12, 34)', ' 12 34 ', '012,034']) expect(await ids(g, a, { q })).toEqual([battle, home].sort());
      expect(await ids(g, a, { q: '120,7' })).toEqual([scout]);
      expect(await ids(g, a, { q: '34,12' })).toEqual([]);
    }));

  it('finds names in the places and the report, ignoring case and treating % and _ as letters', () =>
    game(async (g) => {
      const { a, scout } = await inbox(g);
      expect(await ids(g, a, { q: 'oakRIDGE' })).toEqual([scout]);
      expect(await ids(g, a, { q: 'eadric' })).toEqual([scout]);
      expect(await ids(g, a, { q: '_%' })).toEqual([scout]);
      expect(await ids(g, a, { q: '%' })).toEqual([scout]);
      expect(await ids(g, a, { q: 'Nowhere' })).toEqual([]);
    }));

  it('filters by kind and by unread, together with the tab and the search', () =>
    game(async (g) => {
      const { a, battle, scout, home, aborted, trade } = await inbox(g);
      expect(await ids(g, a, { kind: ReportKind.BATTLES })).toEqual([battle]);
      expect(await ids(g, a, { kind: ReportKind.SCOUTING })).toEqual([scout]);
      expect(await ids(g, a, { kind: ReportKind.RETURNS })).toEqual([home]);
      expect(await ids(g, a, { kind: ReportKind.MOVEMENTS })).toEqual([aborted]);
      expect(await ids(g, a, { kind: ReportKind.OTHER })).toEqual([trade]);
      // the return home was filed as read
      expect(await ids(g, a, { unread: true })).toEqual([battle, scout, aborted, trade].sort());
      expect(await ids(g, a, { kind: ReportKind.RETURNS, unread: true })).toEqual([]);
      expect(await ids(g, a, { q: '12,34', kind: ReportKind.BATTLES })).toEqual([battle]);
      expect(await ids(g, a, { kind: ReportKind.OTHER }, ReportType.ARMY)).toEqual([]);
      expect(await reports.listReports(g, a.id, null, 1, 1, { unread: true })).toMatchObject({ totalPage: 4, total: 4 });
    }));
});

describe(reports.setReportSettings.name, () => {
  it('reads returns home by default, and keeps what the player sets', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await reports.reportSettings(g, a.id)).toEqual({ autoReadReturns: true });
      expect(await reports.setReportSettings(g, a.id, { autoReadReturns: false })).toEqual({ autoReadReturns: false });
      expect(await reports.reportSettings(g, a.id)).toEqual({ autoReadReturns: false });
    }));
});

describe(reports.readReport.name, () => {
  it('marks the report read and pushes the counts once', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await addReport(g, a);
      const pushes = g.pushes(PushCmd.NEW_REPORT).length;
      // the report comes back as it was before opening it
      expect(await reports.readReport(g, a.id, id)).toMatchObject({ id, isRead: false, content: textBody() });
      expect(g.pushes(PushCmd.NEW_REPORT)).toHaveLength(pushes + 1);
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toMatchObject({ data: { count: 0 } });
      expect(await reports.readReport(g, a.id, id)).toMatchObject({ isRead: true });
      expect(g.pushes(PushCmd.NEW_REPORT)).toHaveLength(pushes + 1);
    }));

  it('shows a notice for a stored body that no longer matches the report format', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      // a row from before the typed format: only possible to write directly
      const [row] = await g.tx
        .insert(reportRows)
        .values({ playerId: a.id, title: msg('report.title.scoutReport'), body: { kind: 'xml', xml: '<report/>' } as unknown as ReportBody, eventTime: g.now })
        .returning();
      expect((await reports.readReport(g, a.id, row!.id)).content).toEqual({ kind: ReportBodyKind.TEXT, text: msg('report.oldFormat') });
    }));

  it("cannot read another player's report or one that does not exist", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await addReport(g, b);
      await expectRefused(reports.readReport(g, a.id, id), msg('report.notFound'));
      await expectRefused(reports.readReport(g, a.id, 2_000_000_000), msg('report.notFound'));
      expect(await reports.reportCounts(g, b.id)).toMatchObject({ count: 1 });
    }));
});

describe(reports.markReportsRead.name, () => {
  it('marks only the listed reports of that player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const [r1, r2] = [await addReport(g, a), await addReport(g, a)];
      const theirs = await addReport(g, b);
      await reports.markReportsRead(g, a.id, [r1, theirs]);
      expect(await reports.reportCounts(g, a.id)).toMatchObject({ count: 1 });
      expect(await reports.reportCounts(g, b.id)).toMatchObject({ count: 1 });
      expect((await reports.listReports(g, a.id, null, 1, 10)).reports.find((r) => r.id === r2)).toMatchObject({ isRead: false });
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toMatchObject({ playerIds: [a.id], data: { count: 1 } });
    }));

  it("'all' marks every report of the player, an empty list none", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await addReport(g, a, ReportType.TRADE);
      await addReport(g, a, ReportType.OTHER);
      await addReport(g, b);
      await reports.markReportsRead(g, a.id, []);
      expect(await reports.reportCounts(g, a.id)).toMatchObject({ count: 2 });
      await reports.markReportsRead(g, a.id, ALL_REPORTS);
      expect(await reports.reportCounts(g, a.id)).toMatchObject({ count: 0 });
      expect(await reports.reportCounts(g, b.id)).toMatchObject({ count: 1 });
    }));
});

describe(reports.deleteReports.name, () => {
  it('deletes only the listed reports of that player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const [r1, r2] = [await addReport(g, a), await addReport(g, a)];
      const theirs = await addReport(g, b);
      await reports.deleteReports(g, a.id, [r1, theirs]);
      expect((await reports.listReports(g, a.id, null, 1, 10)).reports.map((r) => r.id)).toEqual([r2]);
      expect((await reports.listReports(g, b.id, null, 1, 10)).reports.map((r) => r.id)).toEqual([theirs]);
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toMatchObject({ playerIds: [a.id], data: { count: 1 } });
    }));

  it('does nothing for an empty list', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await addReport(g, a);
      const pushes = g.pushes().length;
      await reports.deleteReports(g, a.id, []);
      expect(g.pushes()).toHaveLength(pushes);
      expect((await reports.listReports(g, a.id, null, 1, 10)).reports).toHaveLength(1);
    }));
});
