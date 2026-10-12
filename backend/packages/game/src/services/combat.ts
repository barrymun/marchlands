// valley.* — abandoning and upgrading valleys. Army arrival and battles live in engine/combat.ts.

import { GameError, TileType, VALLEY_TYPES, valleyUpgradeCost, msg } from '@marchlands/core';
import { openOwnCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { pushResources } from '#/helpers.ts';
import { armiesStationedAt, getTile, saveCity, saveTile } from '#/repo.ts';
import { homeMarchMs, sendBack } from '#/engine/armies.ts';

/** field.giveUpField: release a valley the city occupies; its garrison comes home. */
export async function abandonValley(ctx: Ctx, playerId: number, tileId: number) {
  const peek = await getTile(ctx, tileId);
  if (peek.ownerPlayerId !== playerId || peek.ownerCityId == null) throw new GameError(msg('army.valleyNotHeld'), -99);
  const b = await openOwnCity(ctx, playerId, peek.ownerCityId);
  const tile = await getTile(ctx, tileId, { lock: true });
  for (const s of await armiesStationedAt(ctx, tileId, { lock: true })) await sendBack(ctx, s, await homeMarchMs(ctx, s, tileId));
  Object.assign(tile, { ownerCityId: null, ownerPlayerId: null, troops: null, state: null, updatedAt: ctx.now });
  await saveTile(ctx, tile);
  b.valleys = b.valleys.filter((v) => v.id !== tileId);
  await saveCity(ctx, b.city);
  pushResources(ctx, b);
}

/**
 * Raise an unowned valley or barbarian city one level, paid in gold by one of the lord's cities (instant). Its
 * garrison regenerates at the new level the next time it is scouted or attacked.
 */
export async function upgradeValley(ctx: Ctx, playerId: number, cityId: number, tileId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const tile = await getTile(ctx, tileId, { lock: true });
  const npc = tile.type === TileType.NPC;
  if ((!VALLEY_TYPES.includes(tile.type) && !npc) || tile.cityId != null) throw new GameError(msg('army.upgradeTarget'), -99);
  if (tile.ownerCityId != null) throw new GameError(msg('army.upgradeHeld'), -99);
  const cost = valleyUpgradeCost(tile.level);
  if (cost == null) throw new GameError(msg(npc ? 'army.barbarianCityMaxLevel' : 'army.valleyMaxLevel', { level: tile.level }), -99);
  if (b.city.gold < cost) throw new GameError(msg('common.notEnoughGoldFor', { amount: cost }), -99);
  b.city.gold -= cost;
  ctx.stat(b.player.id, b.city.id, { 'spent.valleys.gold': cost });
  // the garrison, fortifications, resources and hero start afresh at the new level
  Object.assign(tile, { level: tile.level + 1, troops: null, forts: null, state: null, updatedAt: ctx.now });
  await saveTile(ctx, tile);
  await saveCity(ctx, b.city);
  pushResources(ctx, b);
  return { tileId, level: tile.level, gold: cost, nextCost: valleyUpgradeCost(tile.level) };
}
