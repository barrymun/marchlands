// (marchlands) Holding a historic city (docs/features/historical-cities.md, Decided): a seat short of troops at home or
// out of gold or food for its upkeep loses loyalty and, at 0, rises up and stands again as a historic city nobody holds;
// and its holder's alliance gets its share of the tribute, paid to the other members every real hour. The upkeep itself
// and the holder's lower tribute are in core's city economy (computeCityStats). Run by the worker every minute.

import { and, asc, eq, ne, sql } from 'drizzle-orm';

import { BALANCE, HOUR, msg, seatNeglect, seatUnrest, TileType } from '@marchlands/core';
import { armies, cities, players, tiles } from '@marchlands/db';

import { type CityBundle, openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { cityPosition } from '#/engine/armies.ts';
import { evacuateSeat } from '#/engine/combat.ts';
import { seatLevelOf } from '#/engine/draft.ts';
import { createReport } from '#/engine/reports.ts';
import { pushPlayerInfo } from '#/helpers.ts';
import { saveCity } from '#/repo.ts';

/** One held historic city's minute: its loyalty for what it lacks (none under its truce), a rising, the alliance's share. */
export async function tendSeat(ctx: Ctx, cityId: number) {
  const b = await openCity(ctx, cityId);
  const level = b && seatLevelOf(b.city);
  if (!b || !level) return;
  const neglect = b.city.truceUntil > ctx.now ? 0 : seatNeglect(level, b.city).length;
  Object.assign(b.city, seatUnrest(b.city.loyalty, b.city.loyaltyAt, ctx.now, neglect));
  if (b.city.loyalty <= 0) {
    await riseUp(ctx, b, level);
    return;
  }
  await shareTribute(ctx, b, level);
  await saveCity(ctx, b.city);
}

/** A seat at 0 loyalty rises up: its holder leaves it as when it's taken, and it stands again, whole, for anyone to take. */
async function riseUp(ctx: Ctx, b: CityBundle, level: number) {
  const { city, player } = b;
  await evacuateSeat(ctx, city, player.id);
  // armies marching on it now march on a historic city nobody holds
  await ctx.tx
    .update(armies)
    .set({ targetPlayerId: null })
    .where(and(eq(armies.targetTileId, city.tileId), ne(armies.playerId, player.id)));
  await ctx.tx.execute(sql`delete from timed_events where city_id = ${city.id}`);
  await ctx.tx
    .update(tiles)
    .set({ cityId: null, ownerPlayerId: null, type: TileType.HISTORIC, level, troops: null, forts: null, state: null, updatedAt: ctx.now })
    .where(eq(tiles.id, city.tileId));
  await ctx.tx.delete(cities).where(eq(cities.id, city.id));
  await createReport(ctx, {
    playerId: player.id,
    title: msg('report.title.seatRebelled'),
    startPos: cityPosition(city.name, city.tileId),
    targetPos: cityPosition(city.name, city.tileId),
    body: { kind: 'text', text: msg('report.seatRebelled', { name: city.name, level }) },
  });
  await pushPlayerInfo(ctx, player);
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
