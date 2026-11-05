// (marchlands) Holding a historic city (docs/features/historical-cities.md): its holder's alliance gets its share of the
// tribute, paid to the other members every real hour. The holder's lower tribute is in core's city economy
// (computeCityStats). Run by the worker every minute.

import { and, asc, eq, ne } from 'drizzle-orm';

import { BALANCE, HOUR } from '@marchlands/core';
import { cities, players } from '@marchlands/db';

import { type CityBundle, openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { seatLevelOf } from '#/engine/draft.ts';
import { saveCity } from '#/repo.ts';

/** One held historic city's minute: the alliance's share. */
export async function tendSeat(ctx: Ctx, cityId: number) {
  const b = await openCity(ctx, cityId);
  const level = b && seatLevelOf(b.city);
  if (!b || !level) return;
  await shareTribute(ctx, b, level);
  await saveCity(ctx, b.city);
}

/**
 * Pays the holder's alliance its share of the seat's tributes (BALANCE.historic.allianceShare) for each whole real hour
 * since it was last paid, split between the other members, into each one's oldest city. Out of an alliance, or alone in
 * one, nothing is shared and the clock restarts.
 */
async function shareTribute(ctx: Ctx, b: CityBundle, level: 12 | 14 | 16 | 18) {
  const { city, player } = b;
  const members =
    player.allianceId == null
      ? []
      : await ctx.tx
          .select({ id: players.id })
          .from(players)
          .where(and(eq(players.allianceId, player.allianceId), ne(players.id, player.id)));
  if (!members.length || city.sharedAt <= 0) {
    city.sharedAt = ctx.now;
    return;
  }
  const hours = Math.floor((ctx.now - city.sharedAt) / HOUR);
  if (hours < 1) return;
  city.sharedAt += hours * HOUR;
  const gold = (BALANCE.historic.tribute[level] + city.stateTribute) * BALANCE.historic.allianceShare * hours;
  const each = Math.floor(gold / members.length);
  if (each <= 0) return;
  for (const m of members) {
    const [home] = await ctx.tx.select({ id: cities.id }).from(cities).where(eq(cities.playerId, m.id)).orderBy(asc(cities.id)).limit(1);
    if (!home) continue;
    const to = await openCity(ctx, home.id);
    if (!to) continue;
    to.city.gold += each;
    await saveCity(ctx, to.city);
  }
}
