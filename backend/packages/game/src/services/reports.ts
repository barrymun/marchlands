// report.* — battle/scout/movement/trade reports. Bodies are structured JSON (the original
// wrote XML files to disk).

import { and, count, desc, eq, inArray } from 'drizzle-orm';

import { GameError, msg, type ReportBody, ReportBodySchema } from '@marchlands/core';
import { reports } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { pushReportCounts } from '#/engine/reports.ts';

export { reportCounts } from '#/engine/reports.ts';

const listBean = (r: typeof reports.$inferSelect) => ({
  id: r.id,
  title: r.title,
  type: r.typeId,
  armyType: r.armyType,
  attack: r.isAttack,
  back: r.isBack,
  startPos: r.startPos,
  targetPos: r.targetPos,
  eventTime: r.eventTime,
  isRead: r.isRead,
});

/** report.receiveReportList */
export async function listReports(ctx: Ctx, playerId: number, type: number | null, pageNo: number, pageSize: number) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new GameError(msg('common.invalidData'), -99);
  const page = Math.max(1, pageNo || 1);
  const where = type == null ? eq(reports.playerId, playerId) : and(eq(reports.playerId, playerId), eq(reports.typeId, type));
  const [{ n }] = await ctx.tx.select({ n: count() }).from(reports).where(where);
  const rows = await ctx.tx
    .select()
    .from(reports)
    .where(where)
    .orderBy(desc(reports.eventTime), desc(reports.id))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { pageNo: page, pageSize, totalPage: Math.ceil(Number(n) / pageSize), reports: rows.map(listBean) };
}

/** report.markAsRead (open a report) */
export async function readReport(ctx: Ctx, playerId: number, id: number) {
  const [r] = await ctx.tx
    .select()
    .from(reports)
    .where(and(eq(reports.id, id), eq(reports.playerId, playerId)));
  if (!r) throw new GameError(msg('report.notFound'), -99, 404);
  if (!r.isRead) {
    await ctx.tx.update(reports).set({ isRead: true }).where(eq(reports.id, id));
    await pushReportCounts(ctx, playerId);
  }
  // rows written before the report format was typed may not match it: show a notice instead of failing
  const parsed = ReportBodySchema.safeParse(r.body);
  const content: ReportBody = parsed.success ? parsed.data : { kind: 'text', text: msg('report.oldFormat') };
  return { ...listBean(r), isRead: r.isRead, content };
}

/** report.readOverReport */
export async function markReportsRead(ctx: Ctx, playerId: number, ids: number[] | 'all') {
  const where = ids === 'all' ? eq(reports.playerId, playerId) : and(eq(reports.playerId, playerId), inArray(reports.id, ids.length ? ids : [-1]));
  await ctx.tx.update(reports).set({ isRead: true }).where(where);
  await pushReportCounts(ctx, playerId);
}

/** report.deleteReport */
export async function deleteReports(ctx: Ctx, playerId: number, ids: number[]) {
  if (!ids.length) return;
  await ctx.tx.delete(reports).where(and(eq(reports.playerId, playerId), inArray(reports.id, ids)));
  await pushReportCounts(ctx, playerId);
}
