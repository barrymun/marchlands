// castle.* — construction, upgrades, demolition, speed-ups, cancellation and completion.

import {
  buildingEffect,
  buildingInfo,
  BALANCE,
  BuildingStatus,
  BuildingType,
  buildingConfig,
  buildingLevel,
  buildingMaxLevel,
  BUILDINGS,
  buildCost,
  buildingHeroExp,
  buildTimeMs,
  canPlace,
  checkRequirements,
  goldForSpeedup,
  speedupItemGold,
  fullDemolishRefund,
  findBuilding,
  GameError,
  prestigeOf,
  PrestigeAction,
  requirementsMet,
  scaled,
  SPEEDUP_ITEMS,
  unlockedOuterSlots,
  assertCanConstruct,
  assertCanUpgrade,
  type BuildingState,
  addHeroExp,
  BuffId,
  msg,
  ref,
  dur,
  SpeedupId,
} from '@marchlands/core';
import { mayorOf, mayorStats, openCity, openOwnCity, viewCity, type CityBundle } from '../city.ts';
import type { Ctx } from '../context.ts';
import { buildingBean, heroBean } from '../dto.ts';
import { activeBuff, addPrestige, gainResources, pushPlayerInfo, pushResources, spendGold, spendResources, useItemOrGold } from '../helpers.ts';
import { prefixed } from '../stats.ts';
import { saveCity, saveHero, savePlayer } from '../repo.ts';
import { checkBeginner } from './player.ts';
import { clearTavern } from './heroes.ts';
import { PushCmd } from '@marchlands/contracts';

const refKey = (cityId: number, pos: number) => `building:${cityId}:${pos}`;

/** How many constructions may run at once (Bernini's Hammer adds one more queue). */
function maxConcurrent(b: CityBundle, now: number) {
  return BALANCE.buildQueues + (activeBuff(b.player, BuffId.BUILDING_QUEUE, now) ? 1 : 0);
}

function scheduleBuilding(ctx: Ctx, b: CityBundle, bld: BuildingState) {
  ctx.schedule({
    type: 'building',
    dueAt: bld.endTime,
    playerId: b.player.id,
    cityId: b.city.id,
    refKey: refKey(b.city.id, bld.positionId),
    payload: { positionId: bld.positionId },
  });
}

function pushBuilding(ctx: Ctx, b: CityBundle, bld: BuildingState) {
  ctx.push(b.player.id, PushCmd.BUILD_COMPLETE, { castleId: b.city.id, buildingBean: buildingBean(bld) });
}

async function commit(ctx: Ctx, b: CityBundle) {
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

function requirementsView(b: CityBundle, typeId: number, level: number) {
  const cfg = buildingConfig(typeId, level);
  if (!cfg) return null;
  const checks = checkRequirements(cfg.requires, b.city.buildings, b.player.research, b.player.items);
  return {
    typeId,
    level,
    time: Math.ceil(buildTimeMs(typeId, level, mayorStats(b.heroes), b.player.research) / 1000),
    ...cfg.cost,
    requirements: checks,
    ok: requirementsMet(checks),
    effect: buildingEffect(typeId, level),
  };
}

/** castle.getAvailableBuildingListInside / Outside / getAvailableBuildingBean (walls). */
export async function availableBuildings(ctx: Ctx, playerId: number, cityId: number, area: 'inside' | 'outside' | 'walls') {
  const b = await ownView(ctx, playerId, cityId);
  const types = [...new Set(BUILDINGS.filter((x) => x.level === 1).map((x) => x.typeId))].filter((t) => {
    const cfg = buildingConfig(t, 1)!;
    if (cfg.inside === 3) return false;
    if (area === 'outside') return canPlace(t, 1001);
    if (area === 'walls') return t === BuildingType.WALLS || t === BuildingType.TOWN_HALL;
    return canPlace(t, 0);
  });
  const list = [];
  for (const t of types) {
    const cfg = buildingConfig(t, 1)!;
    const count = b.city.buildings.filter((x) => x.typeId === t).length;
    if (cfg.limit > 0 && count >= cfg.limit) continue;
    const view = requirementsView(b, t, 1);
    list.push(view ? { ...view, info: buildingInfo(t) } : null);
  }
  const th = buildingLevel(b.city.buildings, BuildingType.TOWN_HALL);
  return { buildings: list, unlockedOuterSlots: unlockedOuterSlots(th) };
}

/** castle.checkOutUpgrade: cost of the next level of a building. */
export async function upgradeInfo(ctx: Ctx, playerId: number, cityId: number, positionId: number) {
  const b = await ownView(ctx, playerId, cityId);
  const bld = findBuilding(b.city.buildings, positionId);
  if (!bld) throw new GameError(msg('building.notFound'), -99, 404);
  const max = buildingMaxLevel(bld.typeId);
  return {
    building: buildingBean(bld),
    info: buildingInfo(bld.typeId),
    effect: buildingEffect(bld.typeId, bld.level),
    maxLevel: max,
    next: bld.level < max ? requirementsView(b, bld.typeId, bld.level + 1) : null,
    demolishRefund: bld.level <= 0 ? null : fullDemolishRefund(bld.typeId, bld.level),
  };
}

async function ownView(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  return b;
}

/** castle.getCoinsNeed */
export async function speedupCost(ctx: Ctx, playerId: number, cityId: number, positionId: number) {
  const b = await ownView(ctx, playerId, cityId);
  const bld = findBuilding(b.city.buildings, positionId);
  if (!bld || bld.status === BuildingStatus.IDLE || bld.endTime < ctx.now) throw new GameError(msg('building.notInProgress'), -99);
  return { goldNeed: goldForSpeedup(bld.endTime - ctx.now), timeLeft: bld.endTime - ctx.now };
}

// ---------------------------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------------------------

/** castle.newBuilding */
export async function construct(ctx: Ctx, playerId: number, cityId: number, typeId: number, positionId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  assertCanConstruct({
    typeId,
    positionId,
    buildings: b.city.buildings,
    research: b.player.research,
    items: b.player.items,
    maxConcurrent: maxConcurrent(b, ctx.now),
  });
  const cost = buildCost(typeId, 1);
  spendResources(b.city, cost);
  ctx.stat(playerId, cityId, prefixed('spent.building', cost));
  const ms = buildTimeMs(typeId, 1, mayorStats(b.heroes), b.player.research);
  const bld: BuildingState = { positionId, typeId, level: 0, status: BuildingStatus.BUILDING, startTime: ctx.now, endTime: ctx.now + ms };
  b.city.buildings = [...b.city.buildings, bld];
  scheduleBuilding(ctx, b, bld);
  pushBuilding(ctx, b, bld);
  pushResources(ctx, b);
  await commit(ctx, b);
  return buildingBean(bld);
}

/** castle.upgradeBuilding */
export async function upgrade(ctx: Ctx, playerId: number, cityId: number, positionId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const bld = findBuilding(b.city.buildings, positionId);
  assertCanUpgrade(bld, b.city.buildings, b.player.research, b.player.items, maxConcurrent(b, ctx.now));
  const cfg = buildingConfig(bld!.typeId, bld!.level + 1)!;
  spendResources(b.city, cfg.cost);
  ctx.stat(playerId, cityId, prefixed('spent.building', cfg.cost));
  const ms = buildTimeMs(bld!.typeId, bld!.level + 1, mayorStats(b.heroes), b.player.research);
  const next: BuildingState = { ...bld!, status: BuildingStatus.BUILDING, startTime: ctx.now, endTime: ctx.now + ms };
  b.city.buildings = b.city.buildings.map((x) => (x.positionId === positionId ? next : x));
  scheduleBuilding(ctx, b, next);
  pushBuilding(ctx, b, next);
  pushResources(ctx, b);
  await commit(ctx, b);
  return buildingBean(next);
}

/**
 * castle.destructBuilding: (marchlands) the whole building goes at once, returning BALANCE.demolishRefund of
 * every level's cost (orig: one level per timed demolition).
 */
export async function demolish(ctx: Ctx, playerId: number, cityId: number, positionId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const bld = findBuilding(b.city.buildings, positionId);
  if (!bld || bld.level <= 0) throw new GameError(msg('building.nothingToDemolish'), -99);
  if (bld.status !== BuildingStatus.IDLE) throw new GameError(msg('building.busy'), -45);
  if (bld.typeId === BuildingType.TOWN_HALL || bld.typeId === BuildingType.WALLS) {
    throw new GameError(msg('building.cannotDemolish', { building: ref.building(bld.typeId) }), -99);
  }
  gainResources(b.city, fullDemolishRefund(bld.typeId, bld.level));
  ctx.stat(playerId, cityId, { 'levels.demolished': bld.level });
  removeBuilding(b, bld);
  const gone: BuildingState = { positionId, typeId: 0, level: 0, status: 0, startTime: 0, endTime: 0 };
  pushBuilding(ctx, b, gone);
  pushResources(ctx, b);
  await commit(ctx, b);
  return buildingBean(gone);
}

/** castle.cancleBuildCommand: cancel a construction or upgrade, refunding BALANCE.cancelBuildRefund of its cost. */
export async function cancel(ctx: Ctx, playerId: number, cityId: number, positionId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const bld = findBuilding(b.city.buildings, positionId);
  if (!bld || bld.status === BuildingStatus.IDLE) throw new GameError(msg('building.notInProgress'), -99);
  const paid = buildingConfig(bld.typeId, bld.level + 1)!.cost;
  gainResources(b.city, paid, BALANCE.cancelBuildRefund);
  ctx.stat(playerId, cityId, prefixed('spent.building', paid, -BALANCE.cancelBuildRefund));
  let after: BuildingState | null = null;
  if (bld.level === 0) b.city.buildings = b.city.buildings.filter((x) => x.positionId !== positionId);
  else {
    after = { ...bld, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 };
    b.city.buildings = b.city.buildings.map((x) => (x.positionId === positionId ? after! : x));
  }
  ctx.unschedule(refKey(cityId, positionId));
  pushBuilding(ctx, b, after ?? { positionId, typeId: 0, level: 0, status: 0, startTime: 0, endTime: 0 });
  pushResources(ctx, b);
  await commit(ctx, b);
}

/** castle.speedUpBuildCommand: free 5-minute speed-up, guideline items, coins, dynamite. */
export async function speedup(ctx: Ctx, playerId: number, cityId: number, positionId: number, itemId: string) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const bld = findBuilding(b.city.buildings, positionId);
  if (!bld || bld.status === BuildingStatus.IDLE) throw new GameError(msg('building.notInProgress'), -99);
  const left = Math.max(0, bld.endTime - ctx.now);
  const total = bld.endTime - bld.startTime;
  let reduce: number;
  if (itemId === SpeedupId.FREE) {
    const freeMs = scaled(BALANCE.freeSpeedupMs);
    if (left > freeMs) throw new GameError(msg('common.freeSpeedupTooEarly', { time: dur(freeMs) }), -99);
    reduce = left;
  } else if (itemId === SpeedupId.GOLD) {
    const gold = goldForSpeedup(left);
    spendGold(b.city, gold);
    ctx.stat(playerId, cityId, { 'spent.speedups.gold': gold });
    reduce = left;
  } else {
    const eff = SPEEDUP_ITEMS[itemId];
    if (!eff) throw new GameError(msg('common.invalidSpeedup'), -99);
    useItemOrGold(ctx, b.player, b.city, itemId, speedupItemGold(itemId));
    reduce = scaled(eff.reduce(total, () => ctx.rng.next()));
  }
  pushResources(ctx, b);
  // (marchlands) the start moves back by the time saved: the job keeps its length, so its progress bar jumps
  // forward by the share skipped and percentage speed-ups always cut a share of the original time
  const endTime = Math.max(ctx.now, bld.endTime - reduce);
  const next: BuildingState = { ...bld, startTime: bld.startTime - (bld.endTime - endTime), endTime };
  b.city.buildings = b.city.buildings.map((x) => (x.positionId === positionId ? next : x));
  scheduleBuilding(ctx, b, next);
  pushBuilding(ctx, b, next);
  await commit(ctx, b);
  return buildingBean(next);
}

/** Take a building off the city; a Barracks takes its training queue with it. */
function removeBuilding(b: CityBundle, bld: BuildingState) {
  b.city.buildings = b.city.buildings.filter((x) => x.positionId !== bld.positionId);
  if (bld.typeId === BuildingType.BARRACKS) b.city.troopQueues = b.city.troopQueues.filter((q) => q.positionId !== bld.positionId);
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
