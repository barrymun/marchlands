// (marchlands) What the historic cities give their holders (docs/features/historical-cities.md): titles (Ruler of a
// state for its capital, Sovereign of Atlantis), and rule over a state, whose barbarian cities a held capital cuts off
// from their faction.

import { and, eq, inArray } from 'drizzle-orm';

import { seatTitle, type SeatTitle, stateOf } from '@marchlands/core';
import { cities } from '@marchlands/db';

import { type Ctx } from '#/context.ts';

/** The seat titles of some players, by player id (players holding no capital and not Atlantis are left out). */
export async function seatTitles(ctx: Ctx, playerIds: readonly number[]): Promise<Map<number, SeatTitle>> {
  const out = new Map<number, SeatTitle>();
  if (!playerIds.length) return out;
  const held = await ctx.tx
    .select({ playerId: cities.playerId, historicLevel: cities.historicLevel, tileId: cities.tileId })
    .from(cities)
    .where(and(inArray(cities.playerId, [...playerIds]), inArray(cities.historicLevel, [16, 18])));
  for (const id of new Set(held.map((h) => h.playerId))) {
    const title = seatTitle(held.filter((h) => h.playerId === id));
    if (title) out.set(id, title);
  }
  return out;
}

/** A state a player rules: its capital (a held level 16) and its holder. */
export interface StateRuler {
  zoneId: number;
  cityId: number;
  playerId: number;
}

/** The states players rule, by zone. */
export async function stateRulers(ctx: Ctx): Promise<Map<number, StateRuler>> {
  const rows = await ctx.tx.select({ cityId: cities.id, playerId: cities.playerId, tileId: cities.tileId }).from(cities).where(eq(cities.historicLevel, 16));
  return new Map(rows.map((r) => [stateOf(r.tileId), { zoneId: stateOf(r.tileId), cityId: r.cityId, playerId: r.playerId }]));
}

/** The zones players rule: their NPC cities answer to no faction (core stateFaction). */
export const ruledZones = async (ctx: Ctx): Promise<ReadonlySet<number>> => new Set((await stateRulers(ctx)).keys());
