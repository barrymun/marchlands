// (marchlands) Titles the historic cities give their holders (docs/features/historical-cities.md): Ruler of a state for
// its capital, Sovereign of Atlantis.

import { and, inArray } from 'drizzle-orm';

import { seatTitle, type SeatTitle } from '@marchlands/core';
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
