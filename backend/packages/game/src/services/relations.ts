// Diplomatic relation between two players (orig AllianceMgr::GetRelation, with the
// "two alliance-less players count as one alliance" bug fixed).

import { and, eq, inArray } from 'drizzle-orm';
import { Relation } from '@evony/core';
import { allianceRelations, players } from '@evony/db';
import type { Ctx } from '../context.ts';

export async function allianceOf(ctx: Ctx, playerId: number): Promise<number | null> {
  const [row] = await ctx.tx.select({ a: players.allianceId }).from(players).where(eq(players.id, playerId));
  return row?.a ?? null;
}

/** Relation of alliance `a` towards alliance `b` (one-sided, as stored). */
export async function allianceRelation(ctx: Ctx, a: number, b: number): Promise<number> {
  if (a === b) return Relation.ALLIANCE;
  const [row] = await ctx.tx
    .select({ r: allianceRelations.relation })
    .from(allianceRelations)
    .where(and(eq(allianceRelations.allianceId, a), eq(allianceRelations.targetAllianceId, b)));
  return row?.r ?? Relation.NO_RELATION;
}

export async function relationBetween(ctx: Ctx, viewer: number, other: number): Promise<number> {
  if (viewer === other) return Relation.SELF;
  const rows = await ctx.tx.select({ id: players.id, a: players.allianceId }).from(players).where(inArray(players.id, [viewer, other]));
  const av = rows.find((r) => r.id === viewer)?.a ?? null;
  const ao = rows.find((r) => r.id === other)?.a ?? null;
  if (av == null || ao == null) return Relation.NO_RELATION;
  if (av === ao) return Relation.ALLIANCE;
  return allianceRelation(ctx, av, ao);
}

/** Friendly players may not be attacked or scouted. */
export const isFriendly = (r: number) => r === Relation.SELF || r === Relation.ALLIANCE || r === Relation.ALLY;
