import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { msg, type ReportBody, ReportType } from '@marchlands/core';
import { reports as reportRows } from '@marchlands/db';

import { reports } from '#/index.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
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
      expect(page1).toMatchObject({ pageNo: 1, pageSize: 2, totalPage: 3 });
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

  it('treats a missing or low page number as the first page', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await addReport(g, a);
      for (const page of [0, -3, NaN]) expect(await reports.listReports(g, a.id, null, page, 10)).toMatchObject({ pageNo: 1, reports: [{ id }] });
    }));

  it('has no pages without reports', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      expect(await reports.listReports(g, a.id, null, 1, 10)).toEqual({ pageNo: 1, pageSize: 10, totalPage: 0, reports: [] });
    }));

  it('rejects a page size outside 1..100', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      for (const size of [0, 101, 2.5, NaN]) await expectRefused(reports.listReports(g, a.id, null, 1, size), msg('common.invalidData'));
      await reports.listReports(g, a.id, null, 1, 100);
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
      expect((await reports.readReport(g, a.id, row!.id)).content).toEqual({ kind: 'text', text: msg('report.oldFormat') });
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
      await reports.markReportsRead(g, a.id, 'all');
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
