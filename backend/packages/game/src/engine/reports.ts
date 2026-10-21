// Writing reports for other services (battles, scouting, desertion, trades) and the unread counts.

import { and, count, desc, eq, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import { addTroops, type DesertionReport, type Message, msg, type ReportBody, ReportType, type TroopCounts } from '@marchlands/core';
import { reports } from '@marchlands/db';

import { type Ctx } from '#/context.ts';

export interface NewReport {
  playerId: number;
  typeId?: number;
  title: Message;
  armyType?: number;
  isAttack?: boolean;
  isBack?: boolean;
  /** where the army set out from and went to (`world.position.*`) */
  startPos?: Message;
  targetPos?: Message;
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
      startPos: r.startPos ?? null,
      targetPos: r.targetPos ?? null,
      body: r.body,
      eventTime: ctx.now,
    })
    .returning({ id: reports.id });
  await pushReportCounts(ctx, r.playerId);
  return row.id;
}

/**
 * Report troops that deserted a starving city. Settles happen on every action, so while a city
 * starves they are merged into the latest unread "Troops Deserted" report of that city. A settle
 * whose city row was not saved is recomputed from the same start by the next one: that window
 * replaces the previous contribution instead of being counted twice.
 */
export async function reportDesertion(
  ctx: Ctx,
  r: { playerId: number; cityId: number; city: string; from: number; troops: TroopCounts; food: DesertionReport['food']; position: Message },
) {
  const [prev] = await ctx.tx
    .select()
    .from(reports)
    .where(
      and(eq(reports.playerId, r.playerId), sql`${reports.body}->>'kind' = 'desertion'`, sql`(${reports.body}->'desertion'->>'cityId')::int = ${r.cityId}`),
    )
    .orderBy(desc(reports.id))
    .limit(1);
  const old = prev && prev.body.kind === 'desertion' ? prev.body.desertion : null;
  const replaces = old != null && old.last.from === r.from;
  if (prev && old && (replaces || !prev.isRead)) {
    const base = replaces ? addTroops(old.troops, old.last.troops, -1) : old.troops;
    const desertion: DesertionReport = {
      ...old,
      city: r.city,
      troops: addTroops(base, r.troops),
      to: ctx.now,
      food: r.food,
      last: { from: r.from, troops: r.troops },
    };
    await ctx.tx
      .update(reports)
      .set({ body: { kind: 'desertion', desertion }, eventTime: ctx.now, isRead: false })
      .where(eq(reports.id, prev.id));
    await pushReportCounts(ctx, r.playerId);
    return prev.id;
  }
  return createReport(ctx, {
    playerId: r.playerId,
    typeId: ReportType.ARMY,
    title: msg('report.title.troopsDeserted'),
    startPos: r.position,
    targetPos: r.position,
    body: {
      kind: 'desertion',
      desertion: { cityId: r.cityId, city: r.city, troops: r.troops, from: r.from, to: ctx.now, food: r.food, last: { from: r.from, troops: r.troops } },
    },
  });
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
  ctx.push(playerId, PushCmd.NEW_REPORT, await reportCounts(ctx, playerId));
}
