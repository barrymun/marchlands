// (marchlands) Abandoning a city (docs/features/abandoning-a-city.md): its hour runs out here, as a timed event.

import { and, eq, sql } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import { abandonPrestigeBack, ArmyDirection, Mission, msg, ReportBodyKind, TimedEventType } from '@marchlands/core';
import { armies, cities } from '@marchlands/db';

import { openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { cityPosition, notifyArmyParties, turnHome } from '#/engine/armies.ts';
import { loseCityContents, releaseCityTile } from '#/engine/city-loss.ts';
import { createReport } from '#/engine/reports.ts';
import { addPrestige, pushCity, pushPlayerInfo } from '#/helpers.ts';
import { citiesOf, saveCity } from '#/repo.ts';

export const abandonRef = (cityId: number) => `abandon:${cityId}`;

/**
 * A player always keeps a regular city: only a historic city can be taken from them, so this is what stops them ever being
 * left with none. Whether they'd still have one, not being abandoned itself, without this city.
 */
export async function keepsRegularCity(ctx: Ctx, playerId: number, cityId: number) {
  return (await citiesOf(ctx, playerId)).some((c) => c.id !== cityId && c.historicLevel == null && !c.abandonAt);
}

/**
 * The hour is up: all the player had in the city is lost (loseCityContents), the city goes, and the tile is flat land or a
 * historic city nobody holds. Friendly armies on their way go home; attackers carry on, to nothing on flat land and against
 * the unheld city on a historic one.
 */
export async function completeAbandon(ctx: Ctx, cityId: number) {
  const b = await openCity(ctx, cityId);
  if (!b || !b.city.abandonAt) return; // cancelled, or the city changed hands
  const { city, player } = b;
  if (city.abandonAt > ctx.now) {
    ctx.schedule({ type: TimedEventType.CITY_ABANDON, dueAt: city.abandonAt, playerId: player.id, cityId, refKey: abandonRef(cityId), payload: {} });
    return;
  }
  const position = cityPosition(city.name, city.tileId);
  if (!(await keepsRegularCity(ctx, player.id, cityId))) {
    city.abandonAt = 0;
    await saveCity(ctx, city);
    pushCity(ctx, b);
    await createReport(ctx, {
      playerId: player.id,
      title: msg('report.title.abandonCancelled'),
      startPos: position,
      targetPos: position,
      body: { kind: ReportBodyKind.TEXT, text: msg('report.abandonCancelled', { name: city.name }) },
    });
    return;
  }

  const prestigeBack = abandonPrestigeBack(city, ctx.now);
  addPrestige(player, -prestigeBack);
  await loseCityContents(ctx, city, player);
  const onTheWay = await ctx.tx
    .select()
    .from(armies)
    .where(and(eq(armies.targetTileId, city.tileId), eq(armies.direction, ArmyDirection.FORWARD)))
    .for('update');
  for (const a of onTheWay) {
    if (a.mission === Mission.TRANSPORT || a.mission === Mission.REINFORCE) await turnHome(ctx, a);
    else await ctx.tx.update(armies).set({ targetPlayerId: null }).where(eq(armies.id, a.id));
    await notifyArmyParties(ctx, { playerId: a.playerId, targetPlayerId: null });
  }
  // what the city had under way goes with it; research's event is its player's, and was cancelled above
  await ctx.tx.execute(sql`delete from timed_events where city_id = ${cityId}`);
  await releaseCityTile(ctx, city);
  await ctx.tx.delete(cities).where(eq(cities.id, cityId));
  await createReport(ctx, {
    playerId: player.id,
    title: msg('report.title.cityAbandoned'),
    startPos: position,
    targetPos: position,
    body: {
      kind: ReportBodyKind.TEXT,
      text: prestigeBack ? msg('report.cityAbandonedPrestige', { name: city.name, prestige: prestigeBack }) : msg('report.cityAbandoned', { name: city.name }),
    },
  });
  ctx.push(player.id, PushCmd.CASTLE_UPDATE, { updateType: 1, castleBean: { id: cityId } });
  await pushPlayerInfo(ctx, player);
  await notifyArmyParties(ctx, { playerId: player.id, targetPlayerId: null });
}
