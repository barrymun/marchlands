// report.* — battle/scout/movement/trade reports. Bodies are structured JSON (the original
// wrote XML files to disk).

import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { GameError, ReportBodySchema, type ReportBody } from '@evony/core';
import { reports } from '@evony/db';
import type { Ctx } from '../context.ts';

/** Client tabs: 0 trade, 1 army, 2 other. */
export const ReportType = { TRADE: 0, ARMY: 1, OTHER: 2 } as const;

export interface NewReport {
  playerId: number;
  typeId?: number;
  title: string;
  armyType?: number;
  isAttack?: boolean;
  isBack?: boolean;
  startPos?: string;
  targetPos?: string;
  body: ReportBody;
}

export async function createReport(ctx: Ctx, r: NewReport): Promise<number> {
  const [row] = await ctx.tx
    .insert(reports)
    .values({
      playerId: r.playerId,
      typeId: r.typeId ?? ReportType.ARMY,
      title: r.title,
      armyType: r.armyType ?? 0,
      isAttack: r.isAttack ?? false,
      isBack: r.isBack ?? false,
      startPos: r.startPos ?? '',
      targetPos: r.targetPos ?? '',
      body: r.body,
      eventTime: ctx.now,
    })
    .returning({ id: reports.id });
  await pushReportCounts(ctx, r.playerId);
  return row.id;
}

export async function reportCounts(ctx: Ctx, playerId: number) {
  const rows = await ctx.tx
    .select({ type: reports.typeId, n: count() })
    .from(reports)
    .where(and(eq(reports.playerId, playerId), eq(reports.isRead, false)))
    .groupBy(reports.typeId);
  const n = (t: number) => Number(rows.find((r) => r.type === t)?.n ?? 0);
  return { count: n(0) + n(1) + n(2), trade_count: n(0), army_count: n(1), other_count: n(2) };
}

export async function pushReportCounts(ctx: Ctx, playerId: number) {
  ctx.push(playerId, 'server.NewReport', await reportCounts(ctx, playerId));
}

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
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new GameError('Invalid data.', -99);
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
  const [r] = await ctx.tx.select().from(reports).where(and(eq(reports.id, id), eq(reports.playerId, playerId)));
  if (!r) throw new GameError('Invalid report id.', -99, 404);
  if (!r.isRead) {
    await ctx.tx.update(reports).set({ isRead: true }).where(eq(reports.id, id));
    await pushReportCounts(ctx, playerId);
  }
  // rows written before the report format was typed may not match it: show a notice instead of failing
  const parsed = ReportBodySchema.safeParse(r.body);
  const content: ReportBody = parsed.success ? parsed.data : { kind: 'text', text: 'This report was saved in an older format and cannot be shown.' };
  return { ...listBean(r), isRead: r.isRead, content };
}

/** report.readOverReport */
export async function markReportsRead(ctx: Ctx, playerId: number, ids: number[] | 'all') {
  const where =
    ids === 'all' ? eq(reports.playerId, playerId) : and(eq(reports.playerId, playerId), inArray(reports.id, ids.length ? ids : [-1]));
  await ctx.tx.update(reports).set({ isRead: true }).where(where);
  await pushReportCounts(ctx, playerId);
}

/** report.deleteReport */
export async function deleteReports(ctx: Ctx, playerId: number, ids: number[]) {
  if (!ids.length) return;
  await ctx.tx.delete(reports).where(and(eq(reports.playerId, playerId), inArray(reports.id, ids)));
  await pushReportCounts(ctx, playerId);
}

/** Housekeeping: drop reports older than `days`. */
export async function pruneReports(ctx: Ctx, days: number) {
  await ctx.tx.execute(sql`delete from reports where event_time < ${ctx.now - days * 86_400_000}`);
}
