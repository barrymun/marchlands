import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { HOUR, msg, ReportType } from '@marchlands/core';
import { reports as reportRows } from '@marchlands/db';

import { createReport, pushReportCounts, reportDesertion } from '#/engine/reports.ts';
import { reports } from '#/index.ts';
import { createTestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { addReport, textBody } from '#test/support/reports.ts';

const food = { production: 100, upkeep: 300, net: -200 };
const position = msg('world.position.city', { name: 'Home', x: 1, y: 2 });

describe(createReport.name, () => {
  it('stores the report unread at the current time, with defaults for what is not given', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await createReport(g, { playerId: a.id, title: msg('report.title.scoutReport'), body: textBody() });
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
      const id = await createReport(g, {
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

describe(reportDesertion.name, () => {
  /** the stored desertion (read from the row: opening the report would mark it read) */
  const desertion = async (g: TestGame, id: number) => {
    const [row] = await g.tx.select().from(reportRows).where(eq(reportRows.id, id));
    if (row.body.kind !== 'desertion') throw new Error('not a desertion report');
    return row.body.desertion;
  };

  it('files a "Troops Deserted" army report for the city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reportDesertion(g, {
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
      const id = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start, troops: { archer: 10 }, food, position });
      g.advance(HOUR);
      const food2 = { production: 100, upkeep: 250, net: -150 };
      const id2 = await reportDesertion(g, {
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
      const id = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start, troops: { archer: 10 }, food, position });
      g.advance(HOUR);
      await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start + HOUR, troops: { archer: 4 }, food, position });
      g.advance(HOUR);
      // the settle from start + HOUR was not saved: the next one recomputes it, with more deserters
      await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: start + HOUR, troops: { archer: 7 }, food, position });
      const d = await desertion(g, id);
      expect(d.troops).toEqual({ archer: 17 });
      expect(d.last).toEqual({ from: start + HOUR, troops: { archer: 7 } });
    }));

  it('a recomputed window updates the report even after it was read, and marks it unread again', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 10 }, food, position });
      await reports.markReportsRead(g, a.id, [id]);
      await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 12 }, food, position });
      const list = (await reports.listReports(g, a.id, null, 1, 10)).reports;
      expect(list).toEqual([expect.objectContaining({ id, isRead: false })]);
      expect((await desertion(g, id)).troops).toEqual({ archer: 12 });
    }));

  it('starts a new report once the last one was read', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const id = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 10 }, food, position });
      await reports.markReportsRead(g, a.id, 'all');
      g.advance(HOUR);
      const id2 = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 3 }, food, position });
      expect(id2).not.toBe(id);
      expect((await desertion(g, id2)).troops).toEqual({ archer: 3 });
      expect((await desertion(g, id)).troops).toEqual({ archer: 10 });
    }));

  it('keeps cities and players apart', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const id = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'A', from: g.now, troops: { archer: 1 }, food, position });
      const other = await reportDesertion(g, { playerId: a.id, cityId: b.cityId, city: 'B', from: g.now, troops: { archer: 1 }, food, position });
      const theirs = await reportDesertion(g, { playerId: b.id, cityId: a.cityId, city: 'A', from: g.now, troops: { archer: 1 }, food, position });
      expect(new Set([id, other, theirs]).size).toBe(3);
    }));

  it('does not merge into a report of another kind', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const plain = await addReport(g, a);
      const id = await reportDesertion(g, { playerId: a.id, cityId: a.cityId, city: 'Home', from: g.now, troops: { archer: 1 }, food, position });
      expect(id).not.toBe(plain);
    }));
});

describe(pushReportCounts.name, () => {
  it('pushes the counts to the player', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      await addReport(g, a, ReportType.OTHER);
      const before = g.pushes(PushCmd.NEW_REPORT).length;
      await pushReportCounts(g, a.id);
      expect(g.pushes(PushCmd.NEW_REPORT)).toHaveLength(before + 1);
      expect(g.pushes(PushCmd.NEW_REPORT).at(-1)).toMatchObject({ playerIds: [a.id], data: { count: 1, other_count: 1 } });
    }));
});
