// Helpers for the report tests (services/reports.db.test.ts, engine/reports.db.test.ts).

import { msg, type ReportBody, ReportBodyKind, ReportType } from '@marchlands/core';

import { createReport } from '#/engine/reports.ts';
import { type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

export const textBody = (text = msg('report.oldFormat')): ReportBody => ({ kind: ReportBodyKind.TEXT, text });

export const addReport = (g: TestGame, p: TestPlayer, typeId: number = ReportType.ARMY, title = msg('report.title.scoutReport')) =>
  createReport(g, { playerId: p.id, typeId, title, body: textBody() });
