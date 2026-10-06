// troop.* and fortifications.* — production queues (one per Barracks, one on the Walls),
// cancellation, speed-ups, disbanding and injured troops.

import {
  BALANCE,
  BuildingType,
  buildingLevel,
  FORT_KEYS,
  GameError,
  prestigeOf,
  PrestigeAction,
  checkRequirements,
  requirementsMet,
  trainBatchMs,
  trainCost,
  troopConfig,
  troopKey,
  troopUnitSeconds,
  troopDescription,
  TROOPS,
  usedWallSpace,
  wallCapacity,
  assertCanTrain,
  findBuilding,
  addTroops,
  addForts,
  type FortKey,
  type TrainBatch,
  type TroopQueueState,
  getGameSpeed,
  splitTraining,
  type SplitLane,
  unitExp,
  healCost,
} from '@evony/core';
import { cityStats, mayorOf, mayorStats, openCity, openOwnCity, viewCity, type CityBundle } from '../city.ts';
import type { Ctx } from '../context.ts';
import { fortBean, heroBean, troopBean } from '../dto.ts';
import { addItem, addPrestige, gainResources, itemCount, pushResources, spendCents, spendResources } from '../helpers.ts';
import { saveCity, saveHero, savePlayer } from '../repo.ts';

export const WALLS_QUEUE = -2;
const refKey = (cityId: number, pos: number) => `train:${cityId}:${pos}`;

function queueOf(b: CityBundle, positionId: number): { queue: TrainBatch[]; nextQueueId: number } {
  if (positionId === WALLS_QUEUE) return b.city.fortQueue;
  const q = b.city.troopQueues.find((x) => x.positionId === positionId);
  return q ?? { queue: [], nextQueueId: 1 };
}

function setQueue(b: CityBundle, positionId: number, queue: TrainBatch[], nextQueueId: number) {
  if (positionId === WALLS_QUEUE) b.city.fortQueue = { queue, nextQueueId };
  else {
    const rest = b.city.troopQueues.filter((x) => x.positionId !== positionId);
    const q: TroopQueueState = { positionId, queue, nextQueueId };
    b.city.troopQueues = [...rest, q].sort((x, y) => x.positionId - y.positionId);
  }
}

function scheduleHead(ctx: Ctx, b: CityBundle, positionId: number, queue: TrainBatch[]) {
  const head = queue[0];
  if (!head) {
    ctx.unschedule(refKey(b.city.id, positionId));
    return;
  }
  ctx.schedule({
    type: 'train',
    dueAt: head.endTime,
    playerId: b.player.id,
    cityId: b.city.id,
    refKey: refKey(b.city.id, positionId),
    payload: { positionId },
  });
}

function queueBean(positionId: number, queue: TrainBatch[]) {
  return {
    positionId,
    allProduceQueue: queue.map((q) => ({
      queueId: q.queueId,
      type: q.troopId,
      num: q.count,
      startTime: q.startTime,
      endTime: q.endTime,
      costTime: Math.round(q.costTime / 1000),
    })),
  };
}

function pushQueues(ctx: Ctx, b: CityBundle, positionId: number) {
  ctx.push(b.player.id, positionId === WALLS_QUEUE ? 'server.FortificationsQueueUpdate' : 'server.TroopQueueUpdate', {
    castleId: b.city.id,
    ...queueBean(positionId, queueOf(b, positionId).queue),
  });
}

async function ownView(ctx: Ctx, playerId: number, cityId: number) {
  const b = await viewCity(ctx, cityId);
  if (b.city.playerId !== playerId) throw new GameError('Invalid castle.', -99, 403);
  return b;
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

/** troop.getTroopProduceList / fortifications.getFortificationsProduceList */
export async function trainableList(ctx: Ctx, playerId: number, cityId: number, fort: boolean) {
  const b = await ownView(ctx, playerId, cityId);
  const mayor = mayorStats(b.heroes);
  return TROOPS.filter((t) => t.inside === (fort ? 2 : 1)).map((t) => {
    const checks = checkRequirements(t.requires, b.city.buildings, b.player.research, b.player.items);
    return {
      typeId: t.troopId,
      key: fort ? FORT_KEYS[t.troopId as keyof typeof FORT_KEYS] : troopKey(t.troopId),
      ...t.cost,
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
  assertCanTrain(troopId, count, b.city.buildings, b.player.research, b.player.items, fort);
  const building = fort ? findBuilding(b.city.buildings, -2) : findBuilding(b.city.buildings, positionId);
  if (!building || building.typeId !== (fort ? BuildingType.WALLS : BuildingType.BARRACKS) || building.level < 1) {
    throw new GameError(fort ? 'You need Walls to build fortifications.' : 'Invalid barracks.', -99);
  }
  const { queue, nextQueueId } = queueOf(b, positionId);
  if (queue.length >= building.level) throw new GameError('Troops could not be trained: the queue is full.', -99);
  const cfg = troopConfig(troopId)!;
  if (fort) {
    const space = usedWallSpace(b.city.forts, queue) + count * (BALANCE.fortSpace[troopId] ?? 1);
    if (space > wallCapacity(b.city.buildings)) throw new GameError('Not enough space on the walls.', -99);
  }
  const pop = cfg.population * count;
  const stats = cityStats(b, ctx.now);
  if (pop > stats.idlePopulation) throw new GameError('Not enough population.', -1);
  spendResources(b.city, trainCost(troopId, count));
  b.city.population -= pop;
  const ms = trainBatchMs(troopId, count, mayorStats(b.heroes), b.player.research);
  const batch: TrainBatch = {
    queueId: nextQueueId,
    troopId,
    count,
    costTime: ms,
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
 * Train one order split over every barracks with room in its queue, sized so all batches finish
 * together (core splitTraining): busy barracks get fewer units. Paid and checked as one order.
 */
export async function trainSplit(ctx: Ctx, playerId: number, cityId: number, troopId: number, count: number) {
  const b = await openOwnCity(ctx, playerId, cityId);
  assertCanTrain(troopId, count, b.city.buildings, b.player.research, b.player.items, false);
  const cfg = troopConfig(troopId)!;
  if (cfg.inside === 2) throw new GameError('Fortifications are built at the walls.', -99);
  const lanes: SplitLane[] = [];
  for (const x of b.city.buildings) {
    if (x.typeId !== BuildingType.BARRACKS || x.level < 1) continue;
    const { queue } = queueOf(b, x.positionId);
    if (queue.length >= x.level) continue;
    const head = queue[0];
    const busyUntil = head ? Math.max(ctx.now, head.endTime || ctx.now + head.costTime) + queue.slice(1).reduce((t, q) => t + q.costTime, 0) : ctx.now;
    lanes.push({ positionId: x.positionId, freeAt: busyUntil });
  }
  if (lanes.length === 0) throw new GameError('Every barracks queue is full.', -99);
  const pop = cfg.population * count;
  if (pop > cityStats(b, ctx.now).idlePopulation) throw new GameError('Not enough population.', -1);
  spendResources(b.city, trainCost(troopId, count));
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
  if (idx < 0) throw new GameError('Batch not found.', -99, 404);
  const batch = queue[idx];
  const share = idx === 0 ? BALANCE.cancelTrainInProgressRefund : BALANCE.cancelTrainQueuedRefund;
  gainResources(b.city, trainCost(batch.troopId, batch.count), share);
  b.city.population += (troopConfig(batch.troopId)?.population ?? 1) * batch.count;
  const next = queue.filter((_, i) => i !== idx);
  if (idx === 0 && next[0]) next[0] = { ...next[0], startTime: ctx.now, endTime: ctx.now + next[0].costTime };
  setQueue(b, positionId, next, nextQueueId);
  scheduleHead(ctx, b, positionId, next);
  pushQueues(ctx, b, positionId);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** troop.accTroopProduce (Napoleon's Diary) / fortifications.accTroopProduce (Archimedes' Note): -30%. */
export async function speedupTraining(ctx: Ctx, playerId: number, cityId: number, positionId: number, queueId: number) {
  const fort = positionId === WALLS_QUEUE;
  const itemId = fort ? 'player.fort.1.c' : 'player.troop.1.b';
  const b = await openOwnCity(ctx, playerId, cityId);
  const { queue, nextQueueId } = queueOf(b, positionId);
  const idx = queue.findIndex((q) => q.queueId === queueId);
  if (idx < 0) throw new GameError('Batch not found.', -99, 404);
  if (itemCount(b.player, itemId) > 0) addItem(ctx, b.player, itemId, -1);
  else spendCents(ctx, b.player, fort ? 35 : 30);
  const batch = queue[idx];
  const next = [...queue];
  if (idx === 0) {
    const left = Math.max(0, batch.endTime - ctx.now);
    next[0] = { ...batch, endTime: batch.endTime - Math.floor(left * 0.3), costTime: Math.floor(batch.costTime * 0.7) };
  } else next[idx] = { ...batch, costTime: Math.floor(batch.costTime * 0.7) };
  setQueue(b, positionId, next, nextQueueId);
  scheduleHead(ctx, b, positionId, next);
  pushQueues(ctx, b, positionId);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

/** Head-of-queue completion (timed event). Completes every batch that is due. */
export async function completeTraining(ctx: Ctx, cityId: number, positionId: number) {
  const b = await openCity(ctx, cityId);
  if (!b) return;
  let { queue } = queueOf(b, positionId);
  const { nextQueueId } = queueOf(b, positionId);
  const th = buildingLevel(b.city.buildings, BuildingType.TOWN_HALL);
  let gain = 0;
  let exp = 0;
  let changed = false;
  while (queue[0] && queue[0].endTime > 0 && queue[0].endTime <= ctx.now) {
    const head = queue[0];
    if (positionId === WALLS_QUEUE) {
      const key = FORT_KEYS[head.troopId as keyof typeof FORT_KEYS] as FortKey | undefined;
      if (key) b.city.forts = addForts(b.city.forts, { [key]: head.count });
    } else {
      const key = troopKey(head.troopId);
      if (key) b.city.troops = addTroops(b.city.troops, { [key]: head.count });
    }
    gain += head.count * prestigeOf(PrestigeAction.TRAIN, head.troopId, 1, th);
    exp += head.count * unitExp(head.troopId) * BALANCE.heroExpPerTrain;
    queue = queue.slice(1);
    if (queue[0]) queue[0] = { ...queue[0], startTime: head.endTime, endTime: head.endTime + queue[0].costTime };
    changed = true;
  }
  if (!changed) {
    scheduleHead(ctx, b, positionId, queue);
    return;
  }
  setQueue(b, positionId, queue, nextQueueId);
  scheduleHead(ctx, b, positionId, queue);
  addPrestige(b.player, gain);
  const mayor = mayorOf(b.heroes);
  if (mayor && gain + exp > 0) {
    mayor.experience += gain + exp;
    await saveHero(ctx, mayor);
    ctx.push(b.player.id, 'server.HeroUpdate', { castleId: cityId, hero: heroBean(mayor), updateType: 2 });
  }
  if (positionId === WALLS_QUEUE) ctx.push(b.player.id, 'server.FortificationsUpdate', { castleId: cityId, fortification: fortBean(b.city.forts) });
  else ctx.push(b.player.id, 'server.TroopUpdate', { castleId: cityId, troop: troopBean(b.city.troops) });
  pushQueues(ctx, b, positionId);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}

// ---------------------------------------------------------------------------------------------
// Disband / destroy / injured
// ---------------------------------------------------------------------------------------------

/** troop.disbandTroop: dismissed troops return to the population. */
export async function disbandTroops(ctx: Ctx, playerId: number, cityId: number, troopId: number, count: number) {
  const key = troopKey(troopId);
  if (!key || !Number.isInteger(count) || count < 1) throw new GameError('Invalid troops', -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  if ((b.city.troops[key] ?? 0) < count) throw new GameError(`You do not have that many ${key}.`, -99);
  b.city.troops = addTroops(b.city.troops, { [key]: count }, -1);
  const stats = cityStats(b, ctx.now);
  b.city.population = Math.min(stats.maxPopulation, b.city.population + (troopConfig(troopId)?.population ?? 1) * count);
  gainResources(b.city, trainCost(troopId, count), BALANCE.disbandRefund);
  ctx.push(playerId, 'server.TroopUpdate', { castleId: cityId, troop: troopBean(b.city.troops) });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** fortifications.destructWallProtect */
export async function destroyForts(ctx: Ctx, playerId: number, cityId: number, fortId: number, count: number) {
  const key = FORT_KEYS[fortId as keyof typeof FORT_KEYS];
  if (!key || !Number.isInteger(count) || count < 1) throw new GameError('Invalid trap', -99);
  const b = await openOwnCity(ctx, playerId, cityId);
  if ((b.city.forts[key] ?? 0) < count) throw new GameError(`You do not have that many ${key}.`, -99);
  b.city.forts = addForts(b.city.forts, { [key]: count }, -1);
  ctx.push(playerId, 'server.FortificationsUpdate', { castleId: cityId, fortification: fortBean(b.city.forts) });
  await saveCity(ctx, b.city);
}

/** army.cureInjuredTroop: heal injured troops for BALANCE.healCostShare of their training cost. */
export async function cureInjured(ctx: Ctx, playerId: number, cityId: number, troops: Record<string, number>) {
  const b = await openOwnCity(ctx, playerId, cityId);
  for (const [key, n] of Object.entries(troops)) {
    if (!Number.isInteger(n) || n < 0) throw new GameError('Invalid troop count.', -99);
    if ((b.city.injuredTroops[key as keyof typeof b.city.injuredTroops] ?? 0) < n) throw new GameError('Not enough injured troops.', -99);
  }
  const cost = healCost(troops);
  spendResources(b.city, cost);
  b.city.injuredTroops = addTroops(b.city.injuredTroops, troops, -1);
  b.city.troops = addTroops(b.city.troops, troops);
  ctx.push(playerId, 'server.TroopUpdate', { castleId: cityId, troop: troopBean(b.city.troops) });
  ctx.push(playerId, 'server.InjuredTroopUpdate', { castleId: cityId, troop: troopBean(b.city.injuredTroops) });
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
}

/** army.disbandInjuredTroop */
export async function disbandInjured(ctx: Ctx, playerId: number, cityId: number, troops: Record<string, number>) {
  const b = await openOwnCity(ctx, playerId, cityId);
  for (const [key, n] of Object.entries(troops)) {
    if (!Number.isInteger(n) || n < 0) throw new GameError('Invalid troop count.', -99);
    if ((b.city.injuredTroops[key as keyof typeof b.city.injuredTroops] ?? 0) < n) throw new GameError('Not enough injured troops.', -99);
  }
  b.city.injuredTroops = addTroops(b.city.injuredTroops, troops, -1);
  ctx.push(playerId, 'server.InjuredTroopUpdate', { castleId: cityId, troop: troopBean(b.city.injuredTroops) });
  await saveCity(ctx, b.city);
}
