// troop.* and fortifications.* — production queues (one per Barracks, one on the Walls),
// cancellation, speed-ups, disbanding and injured troops.

import { PushCmd } from '@marchlands/contracts';
import {
  addForts,
  addTroops,
  assertCanTrain,
  BALANCE,
  buildingLevel,
  BuildingType,
  checkRequirements,
  disbandRefund,
  findBuilding,
  FORT_ID_BY_KEY,
  fortKeyOf,
  GameError,
  getGameSpeed,
  healCost,
  healHonorCost,
  itemGoldPrice,
  ItemId,
  msg,
  ref,
  requirementsMet,
  speedUpTrainBatch,
  type SplitLane,
  splitTraining,
  type TrainBatch,
  trainBatchMs,
  trainCost,
  TROOP_ID_BY_KEY,
  troopConfig,
  troopCostShare,
  troopDescription,
  troopKey,
  TROOPS,
  troopUnitSeconds,
  usedWallSpace,
  wallCapacity,
} from '@marchlands/core';

import { type CityBundle, cityStats, mayorStats, openCity, openOwnCity, viewCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { fortBean, troopBean } from '#/dto.ts';
import { completeTraining, pushQueues, queueBean, queueOf, scheduleHead, setQueue, startBatch, WALLS_QUEUE } from '#/engine/training.ts';
import { addRefundCredit, gainResources, pushPlayerInfo, pushResources, spendResources, useItemOrGold } from '#/helpers.ts';
import { saveCity, savePlayer } from '#/repo.ts';
import { prefixed } from '#/stats.ts';

export { WALLS_QUEUE } from '#/engine/training.ts';

/** trainMany: the most unit types one request may order. */
const MAX_ORDERS = 20;

async function ownView(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError(msg('common.invalidCastle'), -99, 403);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/** troop.getTroopProduceList / fortifications.getFortificationsProduceList */
export async function trainableList(ctx: Ctx, playerId: number, cityId: number, fort: boolean) {
  const b = await ownView(ctx, playerId, cityId);
  const mayor = mayorStats(b.heroes);
  const costShare = fort ? 1 : troopCostShare(b.player.buffs, ctx.now);
  return TROOPS.filter((t) => t.inside === (fort ? 2 : 1)).map((t) => {
    const checks = checkRequirements(t.requires, b.city.buildings, b.player.research, b.player.items);
    return {
      typeId: t.troopId,
      key: fort ? fortKeyOf(t.troopId) : troopKey(t.troopId),
      ...t.cost,
      costShare,
      population: t.population,
      time: troopUnitSeconds(t.troopId, mayor, b.player.research),
      requirements: checks,
      permission: requirementsMet(checks),
      description: troopDescription(t.troopId),
      stats: { life: t.life, attack: t.attack, defense: t.defense, speed: t.speed, range: t.range, load: t.load, upkeep: t.upkeep },
    };
  });
}

/** troop.getProduceQueue / fortifications.getProduceQueue */
export async function productionQueues(ctx: Ctx, playerId: number, cityId: number, fort: boolean) {
  const b = await ownView(ctx, playerId, cityId);
  if (fort) {
    return {
      queues: [queueBean(WALLS_QUEUE, b.city.fortQueue.queue)],
      capacity: buildingLevel(b.city.buildings, BuildingType.WALLS),
      wallSpace: { used: usedWallSpace(b.city.forts, b.city.fortQueue.queue), max: wallCapacity(b.city.buildings) },
    };
  }
  const barracks = b.city.buildings.filter((x) => x.typeId === BuildingType.BARRACKS && x.level > 0);
  return {
    queues: barracks.map((x) => ({ ...queueBean(x.positionId, queueOf(b, x.positionId).queue), capacity: x.level })),
  };
}

// ---------------------------------------------------------------------------------------------
// Production
// ---------------------------------------------------------------------------------------------

/** troop.produceTroop / fortifications.produceWallProtect */
export async function train(ctx: Ctx, playerId: number, cityId: number, troopId: number, count: number, positionId: number) {
  const fort = positionId === WALLS_QUEUE;
  const b = await openOwnCity(ctx, playerId, cityId);
  const cfg = assertCanTrain(troopId, count, b.city.buildings, b.player.research, b.player.items, fort);
  const building = fort ? findBuilding(b.city.buildings, -2) : findBuilding(b.city.buildings, positionId);
  if (!building || building.typeId !== (fort ? BuildingType.WALLS : BuildingType.BARRACKS) || building.level < 1) {
    throw new GameError(
      fort
        ? msg('training.wallsNeeded', { building: ref.building(BuildingType.WALLS) })
        : msg('training.invalidBarracks', { building: ref.building(BuildingType.BARRACKS) }),
      -99,
    );
  }
  const { queue, nextQueueId } = queueOf(b, positionId);
  if (queue.length >= building.level) throw new GameError(msg('training.queueFull'), -99);
  if (fort) {
    const space = usedWallSpace(b.city.forts, queue) + count * (BALANCE.fortSpace[troopId] ?? 1);
    if (space > wallCapacity(b.city.buildings)) throw new GameError(msg('training.wallSpaceFull'), -99);
  }
  const pop = cfg.population * count;
  const stats = cityStats(b, ctx.now);
  if (pop > stats.idlePopulation) throw new GameError(msg('training.notEnoughPopulation'), -1);
  const share = fort ? 1 : troopCostShare(b.player.buffs, ctx.now);
  const cost = trainCost(troopId, count, share);
  spendResources(b.city, cost);
  ctx.stat(playerId, cityId, prefixed('spent.training', cost));
  b.city.population -= pop;
  const ms = trainBatchMs(troopId, count, mayorStats(b.heroes), b.player.research);
  const batch: TrainBatch = {
    queueId: nextQueueId,
    troopId,
    count,
    costTime: ms,
    ...(share !== 1 && { paidShare: share }),
    startTime: queue.length === 0 ? ctx.now : 0,
    endTime: queue.length === 0 ? ctx.now + ms : 0,
  };
  const next = [...queue, batch];
  setQueue(b, positionId, next, nextQueueId + 1);
  scheduleHead(ctx, b, positionId, next);
  pushQueues(ctx, b, positionId);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  // instant training (a strong enough mayor, BALANCE.minTrainUnitSeconds = 0): done right away
  if (batch.endTime > 0 && batch.endTime <= ctx.now) {
    await completeTraining(ctx, cityId, positionId);
    const after = await openCity(ctx, cityId);
    if (after) return queueBean(positionId, queueOf(after, positionId).queue);
  }
  return queueBean(positionId, next);
}

/**
 * (marchlands) Several orders in one go (one per troop type), all or nothing: an order that cannot be
 * paid for or queued fails the request, undoing the orders before it. Troops go to one barracks or
 * split over all of them (trainSplit); fortifications go to the walls.
 */
export async function trainMany(
  ctx: Ctx,
  playerId: number,
  cityId: number,
  orders: { troopId: number; count: number }[],
  opts: { fort: boolean; split: boolean; positionId?: number },
): Promise<{ orders: number; units: number }> {
  if (!orders.length || orders.length > MAX_ORDERS) throw new GameError(msg('training.orderLimit', { max: MAX_ORDERS }), -99);
  if (new Set(orders.map((o) => o.troopId)).size !== orders.length) throw new GameError(msg('training.duplicateOrder'), -99);
  for (const o of orders) {
    if (!Number.isInteger(o.count) || o.count < 1) throw new GameError(msg('common.invalidAmount'), -99);
    if (opts.fort) await train(ctx, playerId, cityId, o.troopId, o.count, WALLS_QUEUE);
    else if (opts.split) await trainSplit(ctx, playerId, cityId, o.troopId, o.count);
    else await train(ctx, playerId, cityId, o.troopId, o.count, opts.positionId ?? -999);
  }
  return { orders: orders.length, units: orders.reduce((s, o) => s + o.count, 0) };
}

/**
 * Train one order split over every barracks with room in its queue, sized so all batches finish
 * together (core splitTraining): busy barracks get fewer units. Paid and checked as one order.
 */
export async function trainSplit(ctx: Ctx, playerId: number, cityId: number, troopId: number, count: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const cfg = assertCanTrain(troopId, count, b.city.buildings, b.player.research, b.player.items, false);
  if (cfg.inside === 2) throw new GameError(msg('training.fortsAtWalls'), -99);
  const lanes: SplitLane[] = [];
  for (const x of b.city.buildings) {
    if (x.typeId !== BuildingType.BARRACKS || x.level < 1) continue;
    const { queue } = queueOf(b, x.positionId);
    if (queue.length >= x.level) continue;
    const head = queue[0];
    const busyUntil = head ? Math.max(ctx.now, head.endTime || ctx.now + head.costTime) + queue.slice(1).reduce((t, q) => t + q.costTime, 0) : ctx.now;
    lanes.push({ positionId: x.positionId, freeAt: busyUntil });
  }
  if (lanes.length === 0) throw new GameError(msg('training.allQueuesFull', { building: ref.building(BuildingType.BARRACKS) }), -99);
  const pop = cfg.population * count;
  if (pop > cityStats(b, ctx.now).idlePopulation) throw new GameError(msg('training.notEnoughPopulation'), -1);
  const share = troopCostShare(b.player.buffs, ctx.now);
  const cost = trainCost(troopId, count, share);
  spendResources(b.city, cost);
  ctx.stat(playerId, cityId, prefixed('spent.training', cost));
  b.city.population -= pop;

  const mayor = mayorStats(b.heroes);
  const unitMs = (Math.max(BALANCE.minTrainUnitSeconds, troopUnitSeconds(troopId, mayor, b.player.research)) * 1000) / getGameSpeed();
  const plan = splitTraining(lanes, count, unitMs);
  const batches: { positionId: number; count: number; endTime: number }[] = [];
  for (const p of plan) {
    const { queue, nextQueueId } = queueOf(b, p.positionId);
    const ms = trainBatchMs(troopId, p.count, mayor, b.player.research);
    const batch: TrainBatch = {
      queueId: nextQueueId,
      troopId,
      count: p.count,
      costTime: ms,
      ...(share !== 1 && { paidShare: share }),
      startTime: queue.length === 0 ? ctx.now : 0,
      endTime: queue.length === 0 ? ctx.now + ms : 0,
    };
    const next = [...queue, batch];
    setQueue(b, p.positionId, next, nextQueueId + 1);
    scheduleHead(ctx, b, p.positionId, next);
    pushQueues(ctx, b, p.positionId);
    batches.push({ positionId: p.positionId, count: p.count, endTime: Math.round(p.finishAt) });
  }
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  // instant training: finish zero-time batches right away
  for (const x of batches) if (x.endTime <= ctx.now) await completeTraining(ctx, cityId, x.positionId);
  return { batches, finishAt: Math.max(...batches.map((x) => x.endTime)) };
}

/** troop.cancelTroopProduce / fortifications.cancelFortificationProduce */
export async function cancelTraining(ctx: Ctx, playerId: number, cityId: number, positionId: number, queueId: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  const { queue, nextQueueId } = queueOf(b, positionId);
  const idx = queue.findIndex((q) => q.queueId === queueId);
  const batch = queue[idx];
  if (!batch) throw new GameError(msg('training.batchNotFound'), -99, 404);
  const share = idx === 0 ? BALANCE.cancelTrainInProgressRefund : BALANCE.cancelTrainQueuedRefund;
  const paid = trainCost(batch.troopId, batch.count, batch.paidShare ?? 1);
  gainResources(b.city, paid, share);
  ctx.stat(playerId, cityId, prefixed('spent.training', paid, -share));
  b.city.population += (troopConfig(batch.troopId)?.population ?? 1) * batch.count;
  const next = queue.filter((_, i) => i !== idx);
  if (idx === 0 && next[0]) next[0] = startBatch(next[0], ctx.now);
  setQueue(b, positionId, next, nextQueueId);
  scheduleHead(ctx, b, positionId, next);
  pushQueues(ctx, b, positionId);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** troop.accTroopProduce (Napoleon's Diary) / fortifications.accTroopProduce (Archimedes' Note): see speedUpTrainBatch. */
export async function speedupTraining(ctx: Ctx, playerId: number, cityId: number, positionId: number, queueId: number) {
  const fort = positionId === WALLS_QUEUE;
  const itemId = fort ? ItemId.ARCHIMEDES_NOTE : ItemId.NAPOLEONS_DIARY;
  const b = await openOwnCity(ctx, playerId, cityId);
  const { queue, nextQueueId } = queueOf(b, positionId);
  const idx = queue.findIndex((q) => q.queueId === queueId);
  const batch = queue[idx];
  if (!batch) throw new GameError(msg('training.batchNotFound'), -99, 404);
  useItemOrGold(ctx, b.player, b.city, itemId, itemGoldPrice(itemId) ?? 0);
  const next = [...queue];
  next[idx] = speedUpTrainBatch(batch, idx === 0, ctx.now);
  setQueue(b, positionId, next, nextQueueId);
  scheduleHead(ctx, b, positionId, next);
  pushQueues(ctx, b, positionId);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

// ---------------------------------------------------------------------------------------------
// Disband / destroy / injured
// ---------------------------------------------------------------------------------------------

/**
 * troop.disbandTroop. (marchlands) Dismissed troops return to the population (orig: not), and BALANCE.disbandRefund of
 * their training cost, up to the player's refund credit (disbandRefund in core; orig: one unit's full cost, a bug).
 */
export async function disbandTroops(ctx: Ctx, playerId: number, cityId: number, troopId: number, count: number) {
  const key = troopKey(troopId);
  if (!key) throw new GameError(msg('common.invalidTroopType'), -99);
  if (!Number.isInteger(count) || count < 1) throw new GameError(msg('common.invalidTroopCount'), -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  if ((b.city.troops[key] ?? 0) < count) throw new GameError(msg('training.notEnoughUnits', { unit: ref.troop(TROOP_ID_BY_KEY[key]) }), -99);
  b.city.troops = addTroops(b.city.troops, { [key]: count }, -1);
  const stats = cityStats(b, ctx.now);
  b.city.population = Math.min(stats.maxPopulation, b.city.population + (troopConfig(troopId)?.population ?? 1) * count);
  payRefund(ctx, b, key, troopId, count);
  ctx.stat(playerId, cityId, { [`disbanded.${key}`]: count });
  ctx.push(playerId, PushCmd.TROOP_UPDATE, { castleId: cityId, troop: troopBean(b.city.troops) });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

/** fortifications.destructWallProtect. (marchlands) Refunds like disbandTroops (orig: one unit's full cost, a bug). */
export async function destroyForts(ctx: Ctx, playerId: number, cityId: number, fortId: number, count: number) {
  const key = fortKeyOf(fortId);
  if (!key) throw new GameError(msg('training.invalidFort'), -99);
  if (!Number.isInteger(count) || count < 1) throw new GameError(msg('common.invalidAmount'), -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  if ((b.city.forts[key] ?? 0) < count) throw new GameError(msg('training.notEnoughUnits', { unit: ref.troop(FORT_ID_BY_KEY[key]) }), -99);
  b.city.forts = addForts(b.city.forts, { [key]: count }, -1);
  payRefund(ctx, b, key, fortId, count);
  ctx.stat(playerId, cityId, { [`disbanded.${key}`]: count });
  ctx.push(playerId, PushCmd.FORTIFICATIONS_UPDATE, { castleId: cityId, fortification: fortBean(b.city.forts) });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

/** Pay back disbanded units out of the player's refund credit (disbandRefund in core). Counted as training spending undone. */
function payRefund(ctx: Ctx, b: CityBundle, key: string, unitId: number, count: number) {
  const { refund, creditUsed } = disbandRefund(unitId, count, b.player.misc.refundCredit?.[key] ?? 0);
  if (creditUsed <= 0) return;
  gainResources(b.city, refund);
  addRefundCredit(b.player, key, -creditUsed);
  ctx.stat(b.player.id, b.city.id, prefixed('spent.training', refund, -1));
}

/** army.cureInjuredTroop: heal injured troops for BALANCE.healCostShare of their training cost, or for honor. */
export async function cureInjured(ctx: Ctx, playerId: number, cityId: number, troops: Record<string, number>, payWith: 'resources' | 'honor' = 'resources') {
  const b = await openOwnCity(ctx, playerId, cityId);
  for (const [key, n] of Object.entries(troops)) {
    if (!Number.isInteger(n) || n < 0) throw new GameError(msg('common.invalidTroopCount'), -99);
    if ((b.city.injuredTroops[key as keyof typeof b.city.injuredTroops] ?? 0) < n) throw new GameError(msg('training.notEnoughInjured'), -99);
  }
  if (payWith === 'honor') {
    // honor earned by killing pays to heal: each unit costs its food upkeep x BALANCE.healHonorPerUpkeep
    const honor = healHonorCost(troops);
    if (b.player.honor < honor) throw new GameError(msg('training.notEnoughHonor', { amount: honor }), -99);
    b.player.honor -= honor;
    ctx.stat(playerId, cityId, { 'spent.healing.honor': honor });
    await savePlayer(ctx, b.player);
    await pushPlayerInfo(ctx, b.player);
  } else {
    const cost = healCost(troops);
    spendResources(b.city, cost);
    ctx.stat(playerId, cityId, prefixed('spent.healing', cost));
  }
  ctx.stat(playerId, cityId, prefixed('healed', troops));
  b.city.injuredTroops = addTroops(b.city.injuredTroops, troops, -1);
  b.city.troops = addTroops(b.city.troops, troops);
  ctx.push(playerId, PushCmd.TROOP_UPDATE, { castleId: cityId, troop: troopBean(b.city.troops) });
  ctx.push(playerId, PushCmd.INJURED_TROOP_UPDATE, { castleId: cityId, troop: troopBean(b.city.injuredTroops) });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** army.disbandInjuredTroop */
export async function disbandInjured(ctx: Ctx, playerId: number, cityId: number, troops: Record<string, number>) {
  const b = await openOwnCity(ctx, playerId, cityId);
  for (const [key, n] of Object.entries(troops)) {
    if (!Number.isInteger(n) || n < 0) throw new GameError(msg('common.invalidTroopCount'), -99);
    if ((b.city.injuredTroops[key as keyof typeof b.city.injuredTroops] ?? 0) < n) throw new GameError(msg('training.notEnoughInjured'), -99);
  }
  b.city.injuredTroops = addTroops(b.city.injuredTroops, troops, -1);
  ctx.stat(playerId, cityId, prefixed('disbanded', troops));
  ctx.push(playerId, PushCmd.INJURED_TROOP_UPDATE, { castleId: cityId, troop: troopBean(b.city.injuredTroops) });
  await saveCity(ctx, b.city);
}
