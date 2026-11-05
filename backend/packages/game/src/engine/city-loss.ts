// (marchlands) What goes when a player loses a city, by a rival taking a historic city or by abandoning one
// (docs/features/abandoning-a-city.md): the two lose the same things, on purpose.

import { and, eq } from 'drizzle-orm';

import { PushCmd } from '@marchlands/contracts';
import { ArmyDirection, TileType } from '@marchlands/core';
import { armies, heroes, marketOrders, marketShipments, tiles, warPlanWaves } from '@marchlands/db';

import { type Ctx } from '#/context.ts';
import { armyRef, departRef, homeMarchMs, notifyArmyParties, sendBack } from '#/engine/armies.ts';
import { dropCityTargets } from '#/engine/flows.ts';
import { cancelCityResearch } from '#/engine/research.ts';
import { armiesStationedAt, type CityRow, type PlayerRow, savePlayer } from '#/repo.ts';

/**
 * All a player had in a city they're losing is lost, as nothing is moved to another city: heroes, armies wherever they
 * are, research running there, plan waves, market orders and shipments. Its valleys go free (other cities' troops there
 * head home), troops other cities have stationed in it go home, and it leaves the player's farming lists.
 */
export async function loseCityContents(ctx: Ctx, city: CityRow, loser: PlayerRow) {
  const loserId = loser.id;
  cancelCityResearch(ctx, loser, city.id);
  await savePlayer(ctx, loser);
  const lostArmies = await ctx.tx
    .delete(armies)
    .where(and(eq(armies.cityId, city.id), eq(armies.playerId, loserId)))
    .returning();
  for (const a of lostArmies) {
    ctx.unschedule(armyRef(a.id));
    ctx.unschedule(departRef(a.id));
  }
  await ctx.tx.delete(heroes).where(and(eq(heroes.cityId, city.id), eq(heroes.playerId, loserId)));
  await ctx.tx.delete(warPlanWaves).where(and(eq(warPlanWaves.cityId, city.id), eq(warPlanWaves.playerId, loserId)));
  const orders = await ctx.tx
    .delete(marketOrders)
    .where(and(eq(marketOrders.cityId, city.id), eq(marketOrders.playerId, loserId)))
    .returning();
  if (orders.length) ctx.broadcast(PushCmd.MARKET_UPDATE, { resTypes: [...new Set(orders.map((o) => o.resType))] });
  const shipments = await ctx.tx
    .delete(marketShipments)
    .where(and(eq(marketShipments.cityId, city.id), eq(marketShipments.playerId, loserId)))
    .returning();
  for (const s of shipments) ctx.unschedule(`shipment:${s.id}`);
  await dropCityTargets(ctx, loserId, city.id);
  const sentHome = new Set<number>();
  for (const v of await ctx.tx.select().from(tiles).where(eq(tiles.ownerCityId, city.id))) {
    for (const s of await armiesStationedAt(ctx, v.id, { lock: true })) {
      await sendBack(ctx, s, await homeMarchMs(ctx, s, v.id));
      sentHome.add(s.playerId);
    }
    // attackers on their way land on a free valley: it's no longer this player they're coming for
    await ctx.tx
      .update(armies)
      .set({ targetPlayerId: null })
      .where(and(eq(armies.targetTileId, v.id), eq(armies.direction, ArmyDirection.FORWARD)));
    await ctx.tx.update(tiles).set({ ownerCityId: null, ownerPlayerId: null, troops: null, state: null, updatedAt: ctx.now }).where(eq(tiles.id, v.id));
  }
  for (const s of await armiesStationedAt(ctx, city.tileId, { lock: true })) {
    await sendBack(ctx, s, await homeMarchMs(ctx, s, city.tileId));
    sentHome.add(s.playerId);
  }
  // whoever the lost armies were marching on or stationed with no longer sees them, and those sent home see them heading back
  for (const id of new Set([...sentHome, ...lostArmies.flatMap((a) => a.targetPlayerId ?? [])]))
    await notifyArmyParties(ctx, { playerId: id, targetPlayerId: null });
}

/** A city gone from the map: a historic city stands again as one, whole, for the next to take; any other leaves flat land. */
export async function releaseCityTile(ctx: Ctx, city: CityRow) {
  const standing = city.historicLevel
    ? { type: TileType.HISTORIC, level: city.historicLevel, troops: null, forts: null, state: null }
    : { type: TileType.FLAT };
  await ctx.tx
    .update(tiles)
    .set({ cityId: null, ownerPlayerId: null, ...standing, updatedAt: ctx.now })
    .where(eq(tiles.id, city.tileId));
}
