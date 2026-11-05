// Construction completion (timed event 'building.complete') and the helpers that schedule it.

import { PushCmd } from '@marchlands/contracts';
import {
  addHeroExp,
  buildingHeroExp,
  buildingLevel,
  type BuildingState,
  BuildingStatus,
  BuildingType,
  findBuilding,
  PrestigeAction,
  prestigeOf,
  TimedEventType,
} from '@marchlands/core';

import { type CityBundle, mayorOf, openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { buildingBean, heroBean } from '#/dto.ts';
import { clearTavern } from '#/engine/heroes.ts';
import { checkBeginner } from '#/engine/player.ts';
import { addPrestige, pushPlayerInfo, pushResources } from '#/helpers.ts';
import { saveCity, saveHero, savePlayer } from '#/repo.ts';

export const refKey = (cityId: number, pos: number) => `building:${cityId}:${pos}`;

export function scheduleBuilding(ctx: Ctx, b: CityBundle, bld: BuildingState) {
  ctx.schedule({
    type: TimedEventType.BUILDING,
    dueAt: bld.endTime,
    playerId: b.player.id,
    cityId: b.city.id,
    refKey: refKey(b.city.id, bld.positionId),
    payload: { positionId: bld.positionId },
  });
}

export function pushBuilding(ctx: Ctx, b: CityBundle, bld: BuildingState) {
  ctx.push(b.player.id, PushCmd.BUILD_COMPLETE, { castleId: b.city.id, buildingBean: buildingBean(bld) });
}

export async function commit(ctx: Ctx, b: CityBundle) {
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

// ---------------------------------------------------------------------------------------------
// Completion (timed event)
// ---------------------------------------------------------------------------------------------

export async function completeBuilding(ctx: Ctx, cityId: number, positionId: number) {
  const b = await openCity(ctx, cityId);
  if (!b) return; // city vanished
  const playerId = b.player.id;
  const bld = findBuilding(b.city.buildings, positionId);
  if (!bld || bld.status === BuildingStatus.IDLE) return;
  if (bld.endTime > ctx.now) {
    scheduleBuilding(ctx, b, bld); // was delayed; make sure an event exists
    return;
  }
  const level = bld.level + 1;
  const after: BuildingState = { ...bld, level, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 };
  ctx.stat(playerId, cityId, { 'levels.building': 1 });
  const th = bld.typeId === BuildingType.TOWN_HALL ? level : buildingLevel(b.city.buildings, BuildingType.TOWN_HALL);
  const gain = prestigeOf(PrestigeAction.BUILDING, bld.typeId, level, th);
  addPrestige(b.player, gain);
  const mayor = mayorOf(b.heroes);
  if (mayor) {
    addHeroExp(mayor, buildingHeroExp(bld.typeId, level, th));
    await saveHero(ctx, mayor);
    ctx.push(playerId, PushCmd.HERO_UPDATE, { castleId: cityId, hero: heroBean(mayor), updateType: 2 });
  }
  if (bld.typeId === BuildingType.INN) await clearTavern(ctx, cityId);
  if (bld.typeId === BuildingType.TOWN_HALL) await checkBeginner(ctx, b.player, level);
  b.city.buildings = b.city.buildings.map((x) => (x.positionId === positionId ? after : x));
  pushBuilding(ctx, b, after);
  pushResources(ctx, b);
  await pushPlayerInfo(ctx, b.player);
  await commit(ctx, b);
}
