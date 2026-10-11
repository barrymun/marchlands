import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { DAY, HOUR, msg, type ReportBody } from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { reports as reportRows } from '@marchlands/db';
import { reports } from '../../src/index.ts';
import { expectRefused } from '../support/expect.ts';
import { createTestPlayer, type TestPlayer } from '../support/factories.ts';
import { game, type TestGame } from '../support/game.ts';

const { ReportType } = reports;

const textBody = (text = msg('report.oldFormat')): ReportBody => ({ kind: 'text', text });

/** A plain report for `p` of a client tab, made with the service's own createReport. */
const addReport = (g: TestGame, p: TestPlayer, typeId: number = ReportType.ARMY, title = msg('report.title.scoutReport')) =>
  reports.createReport(g, { playerId: p.id, typeId, title, body: textBody() });

const food = { production: 100, upkeep: 300, net: -200 };
const position = msg('world.position.city', { name: 'Home', x: 1, y: 2 });

describe(reports.createReport.name, () => {
  it('stores the report unread at the current time, with defaults for what is not given', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reports.createReport(g, { playerId: a.id, title: msg('report.title.scoutReport'), body: textBody() });
      const r = await reports.readReport(g, a.id, id);
      expect(r).toMatchObject({
        id,
        title: msg('report.title.scoutReport'),
        type: ReportType.ARMY,
        armyType: 0,
        attack: false,
        back: false,
        startPos: null,
        targetPos: null,
        eventTime: g.now,
        isRead: false,
        content: textBody(),
      });
    }));

  it('keeps the given type, mission, flags and positions', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reports.createReport(g, {
        playerId: a.id,
        typeId: ReportType.TRADE,
        title: msg('report.title.tradeCompleted'),
        armyType: 3,
        isAttack: true,
        isBack: true,
        startPos: position,
        targetPos: position,
        body: textBody(),
      });
      const [r] = (await reports.listReports(g, a.id, null, 1, 10)).reports;
      expect(r).toEqual({
        id,
        title: msg('report.title.tradeCompleted'),
        type: ReportType.TRADE,
        armyType: 3,
        attack: true,
        back: true,
        startPos: position,
        targetPos: position,
        eventTime: g.now,
        isRead: false,
      });
    }));

  it('pushes the new unread counts to the player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await addReport(g, a, ReportType.ARMY);
      await addReport(g, a, ReportType.TRADE);
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toEqual({
        playerIds: [a.id],
        cmd: PushCmd.NEW_REPORT,
        data: { count: 2, trade_count: 1, army_count: 1, other_count: 0 },
      });
    }));
});

describe(reports.reportDesertion.name, () => {
  /** the stored desertion (read from the row: opening the report would mark it read) */
  const desertion = async (g: TestGame, id: number) => {
    const [row] = await g.tx.select().from(reportRows).where(eq(reportRows.id, id));
    if (row.body.kind !== 'desertion') throw new Error('not a desertion report');
    return row.body.desertion;
  };

  it('files a "Troops Deserted" army report for the city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reports.reportDesertion(g, {
        playerId: a.id,
        cityId: a.cityId,
        city: 'Home',
        from: g.now - HOUR,
        troops: { archer: 10 },
        food,
        position,
      });
      const [row] = (await reports.listReports(g, a.id, null, 1, 10)).reports;
      expect(row).toMatchObject({
        id,
        title: msg('report.title.troopsDeserted'),
        type: ReportType.ARMY,
        startPos: position,
        targetPos: position,
        isRead: false,
      });
      expect(await desertion(g, id)).toEqual({
        cityId: a.cityId,
        city: 'Home',
        troops: { archer: 10 },
        from: g.now - HOUR,
        to: g.now,
        food,
        last: { from: g.now - HOUR, troops: { archer: 10 } },
      });
    }));

  it('merges later desertions into the unread report of that city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const start = g.now;
      const id = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start, troops: { archer: 10 }, food, position });
      g.advance(HOUR);
      const food2 = { production: 100, upkeep: 250, net: -150 };
      const id2 = await reports.reportDesertion(g, {
        playerId: a.id,
        cityId: a.cityId,
        city: 'Renamed',
        from: start + 1000,
        troops: { archer: 5, militia: 2 },
        food: food2,
        position,
      });
      expect(id2).toBe(id);
      expect((await reports.listReports(g, a.id, null, 1, 10)).reports).toHaveLength(1);
      expect(await desertion(g, id)).toEqual({
        cityId: a.cityId,
        city: 'Renamed',
        troops: { archer: 15, militia: 2 },
        from: start,
        to: start + HOUR,
        food: food2,
        last: { from: start + 1000, troops: { archer: 5, militia: 2 } },
      });
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toMatchObject({ data: { army_count: 1 } });
    }));

  it('a recomputed window (same start) replaces its earlier contribution instead of adding to it', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const start = g.now;
      const id = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start, troops: { archer: 10 }, food, position });
      g.advance(HOUR);
      await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start + HOUR, troops: { archer: 4 }, food, position });
      g.advance(HOUR);
      // the settle from start + HOUR was not saved: the next one recomputes it, with more deserters
      await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start + HOUR, troops: { archer: 7 }, food, position });
      const d = await desertion(g, id);
      expect(d.troops).toEqual({ archer: 17 });
      expect(d.last).toEqual({ from: start + HOUR, troops: { archer: 7 } });
    }));

  it('a recomputed window updates the report even after it was read, and marks it unread again', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 10 }, food, position });
      await reports.markReportsRead(g, a.id, [id]);
      await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 12 }, food, position });
      const list = (await reports.listReports(g, a.id, null, 1, 10)).reports;
      expect(list).toEqual([expect.objectContaining({ id, isRead: false })]);
      expect((await desertion(g, id)).troops).toEqual({ archer: 12 });
    }));

  it('starts a new report once the last one was read', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 10 }, food, position });
      await reports.markReportsRead(g, a.id, 'all');
      g.advance(HOUR);
      const id2 = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 3 }, food, position });
      expect(id2).not.toBe(id);
      expect((await desertion(g, id2)).troops).toEqual({ archer: 3 });
      expect((await desertion(g, id)).troops).toEqual({ archer: 10 });
    }));

  it('keeps cities and players apart', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'A', from: g.now, troops: { archer: 1 }, food, position });
      const other = await reports.reportDesertion(g, { playerId: a.id, cityId: b.cityId, city: 'B', from: g.now, troops: { archer: 1 }, food, position });
      const theirs = await reports.reportDesertion(g, { playerId: b.id, cityId: a.cityId, city: 'A', from: g.now, troops: { archer: 1 }, food, position });
      expect(new Set([id, other, theirs]).size).toBe(3);
    }));

  it('does not merge into a report of another kind', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const plain = await addReport(g, a);
      const id = await reports.reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 1 }, food, position });
      expect(id).not.toBe(plain);
    }));
});

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

describe(reports.pushReportCounts.name, () => {
  it('pushes the counts to the player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await addReport(g, a, ReportType.OTHER);
      const before = g.pushes(PushCmd.NEW_REPORT).length;
      await reports.pushReportCounts(g, a.id);
      expect(g.pushes(PushCmd.NEW_REPORT)).toHaveLength(before + 1);
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toMatchObject({ playerIds: [a.id], data: { count: 1, other_count: 1 } });
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
      expect((await reports.readReport(g, a.id, row.id)).content).toEqual({ kind: 'text', text: msg('report.oldFormat') });
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

describe(reports.pruneReports.name, () => {
  it('drops the reports of every player older than the given days', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await addReport(g, a);
      await addReport(g, b);
      g.advance(5 * DAY);
      const edge = await addReport(g, a); // exactly 2 days old when pruning: kept
      g.advance(2 * DAY);
      const fresh = await addReport(g, b);
      await reports.pruneReports(g, 2);
      expect((await reports.listReports(g, a.id, null, 1, 10)).reports.map((r) => r.id)).toEqual([edge]);
      expect((await reports.listReports(g, b.id, null, 1, 10)).reports.map((r) => r.id)).toEqual([fresh]);
    }));
});
