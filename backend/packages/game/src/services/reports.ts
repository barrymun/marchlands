// report.* — battle/scout/movement/trade reports. Bodies are structured JSON (the original
// wrote XML files to disk).

import { and, asc, count, desc, eq, inArray, or, type SQL, sql } from 'drizzle-orm';

import { ALL_REPORTS, GameError, msg, type ReportBody, ReportBodyKind, ReportBodySchema, ReportKind, ReportOrder } from '@marchlands/core';
import { one, players, reports } from '@marchlands/db';

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

/** (marchlands) Coordinates typed into the search: `207,405`, `(207, 405)` or `207 405`. */
const COORDS = /^\(?\s*(\d{1,4})(?:\s|\s*,)\s*(\d{1,4})\s*\)?$/;

/** Where a report's positions (`world.position.*` messages) put a tile's coordinates. */
const POSITIONS = [sql`${reports.startPos}`, sql`${reports.targetPos}`, sql`${reports.body}->'draft'->'target'`];

/** The names a search looks through: cities and places, players, heroes. */
const NAMES = sql`concat_ws(' ',
  ${reports.startPos}->'params'->>'name', ${reports.targetPos}->'params'->>'name', ${reports.title}->'params'->>'name',
  ${reports.body}->'battle'->'attacker'->>'player', ${reports.body}->'battle'->'defender'->>'player',
  ${reports.body}->'battle'->'attacker'->'hero'->>'name', ${reports.body}->'battle'->'defender'->'hero'->>'name',
  ${reports.body}->'battle'->>'city', ${reports.body}->'scout'->>'owner', ${reports.body}->'movement'->'hero'->>'name',
  ${reports.body}->'movement'->>'from', ${reports.body}->'desertion'->>'city', ${reports.body}->'draft'->>'city')`;

function searchWhere(q: string): SQL {
  const at = COORDS.exec(q);
  if (at) {
    const [, x = '', y = ''] = at;
    // as JSON text, so 0405 finds 405
    const [tx, ty] = [String(Number(x)), String(Number(y))];
    return or(...POSITIONS.map((p) => sql`(${p}->'params'->>'x' = ${tx} and ${p}->'params'->>'y' = ${ty})`)) ?? sql`false`;
  }
  return sql`${NAMES} ilike ${`%${q.replace(/[\\%_]/g, '\\$&')}%`}`;
}

const bodyKind = sql`${reports.body}->>'kind'`;
const aborted = sql`${reports.title}->>'code' = 'report.title.missionAborted'`;

function kindWhere(kind: ReportKind): SQL {
  switch (kind) {
    case ReportKind.BATTLES:
      return sql`${bodyKind} = ${ReportBodyKind.BATTLE}`;
    case ReportKind.SCOUTING:
      return sql`${bodyKind} = ${ReportBodyKind.SCOUT}`;
    case ReportKind.RETURNS:
      return eq(reports.isBack, true);
    case ReportKind.MOVEMENTS:
      return sql`((${bodyKind} = ${ReportBodyKind.MOVEMENT} and not ${reports.isBack}) or ${aborted})`;
    case ReportKind.OTHER:
      return sql`(${bodyKind} not in (${ReportBodyKind.BATTLE}, ${ReportBodyKind.SCOUT}, ${ReportBodyKind.MOVEMENT}) and not ${aborted})`;
  }
}

export interface ReportFilter {
  /** coordinates, or part of a name */
  q?: string;
  kind?: ReportKind;
  /** only unread reports */
  unread?: boolean;
  /** newest first (the default) or oldest first */
  order?: ReportOrder;
}

/** report.receiveReportList; (marchlands) with a search, filters and oldest first */
export async function listReports(ctx: Ctx, playerId: number, type: number | null, pageNo: number, pageSize: number, filter: ReportFilter = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new GameError(msg('common.invalidData'), -99);
  const page = Math.max(1, pageNo || 1);
  const q = filter.q?.trim();
  const where = and(
    eq(reports.playerId, playerId),
    type == null ? undefined : eq(reports.typeId, type),
    q ? searchWhere(q) : undefined,
    filter.kind ? kindWhere(filter.kind) : undefined,
    filter.unread ? eq(reports.isRead, false) : undefined,
  );
  const { n } = one(await ctx.tx.select({ n: count() }).from(reports).where(where));
  const rows = await ctx.tx
    .select()
    .from(reports)
    .where(where)
    .orderBy(...(filter.order === ReportOrder.OLDEST ? [asc(reports.eventTime), asc(reports.id)] : [desc(reports.eventTime), desc(reports.id)]))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  return { pageNo: page, pageSize, totalPage: Math.ceil(Number(n) / pageSize), total: Number(n), reports: rows.map(listBean) };
}

/** (marchlands) The player's report settings. */
export async function reportSettings(ctx: Ctx, playerId: number) {
  const [p] = await ctx.tx.select({ autoReadReturns: players.autoReadReturns }).from(players).where(eq(players.id, playerId));
  if (!p) throw new GameError(msg('common.invalidData'), -99, 404);
  return p;
}

/** (marchlands) Change the player's report settings; the reports already there stay as they are. */
export async function setReportSettings(ctx: Ctx, playerId: number, settings: { autoReadReturns: boolean }) {
  await ctx.tx.update(players).set({ autoReadReturns: settings.autoReadReturns }).where(eq(players.id, playerId));
  return reportSettings(ctx, playerId);
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
  const content: ReportBody = parsed.success ? parsed.data : { kind: ReportBodyKind.TEXT, text: msg('report.oldFormat') };
  return { ...listBean(r), isRead: r.isRead, content };
}

/** report.readOverReport */
export async function markReportsRead(ctx: Ctx, playerId: number, ids: number[] | typeof ALL_REPORTS) {
  const where = ids === ALL_REPORTS ? eq(reports.playerId, playerId) : and(eq(reports.playerId, playerId), inArray(reports.id, ids.length ? ids : [-1]));
  await ctx.tx.update(reports).set({ isRead: true }).where(where);
  await pushReportCounts(ctx, playerId);
}

/** report.deleteReport */
export async function deleteReports(ctx: Ctx, playerId: number, ids: number[]) {
  if (!ids.length) return;
  await ctx.tx.delete(reports).where(and(eq(reports.playerId, playerId), inArray(reports.id, ids)));
  await pushReportCounts(ctx, playerId);
}
