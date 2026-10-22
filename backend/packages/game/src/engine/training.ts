// Production queue internals: queue rows, scheduling the head batch and completing it (timed event).

import { PushCmd } from '@marchlands/contracts';
import {
  addForts,
  addHeroExp,
  addTroops,
  BALANCE,
  buildingLevel,
  BuildingType,
  fortKeyOf,
  PrestigeAction,
  prestigeOf,
  type TrainBatch,
  troopKey,
  type TroopQueueState,
  unitExp,
} from '@marchlands/core';

import { type CityBundle, mayorOf, openCity } from '#/city.ts';
import { type Ctx } from '#/context.ts';
import { fortBean, heroBean, troopBean } from '#/dto.ts';
import { addPrestige, addRefundCredit, pushResources } from '#/helpers.ts';
import { saveCity, saveHero, savePlayer } from '#/repo.ts';
import { prefixed } from '#/stats.ts';

export const WALLS_QUEUE = -2;
const refKey = (cityId: number, pos: number) => `train:${cityId}:${pos}`;

/** Whether any barracks of the city has room in its queue (a barracks queues as many batches as its level). */
export function hasTrainingRoom(b: CityBundle): boolean {
  return b.city.buildings.some((x) => x.typeId === BuildingType.BARRACKS && x.level >= 1 && queueOf(b, x.positionId).queue.length < x.level);
}

export function queueOf(b: CityBundle, positionId: number): { queue: TrainBatch[]; nextQueueId: number } {
  if (positionId === WALLS_QUEUE) return b.city.fortQueue;
  const q = b.city.troopQueues.find((x) => x.positionId === positionId);
  return q ?? { queue: [], nextQueueId: 1 };
}

export function setQueue(b: CityBundle, positionId: number, queue: TrainBatch[], nextQueueId: number) {
  if (positionId === WALLS_QUEUE) b.city.fortQueue = { queue, nextQueueId };
  else {
    const rest = b.city.troopQueues.filter((x) => x.positionId !== positionId);
    const q: TroopQueueState = { positionId, queue, nextQueueId };
    b.city.troopQueues = [...rest, q].sort((x, y) => x.positionId - y.positionId);
  }
}

export function scheduleHead(ctx: Ctx, b: CityBundle, positionId: number, queue: TrainBatch[]) {
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

export function queueBean(positionId: number, queue: TrainBatch[]) {
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

export function pushQueues(ctx: Ctx, b: CityBundle, positionId: number) {
  ctx.push(b.player.id, positionId === WALLS_QUEUE ? PushCmd.FORTIFICATIONS_QUEUE_UPDATE : PushCmd.TROOP_QUEUE_UPDATE, {
    castleId: b.city.id,
    ...queueBean(positionId, queueOf(b, positionId).queue),
  });
}

/**
 * A waiting batch starts producing at `at`. Time already cut by speed-ups counts as done: the start sits that
 * far back, so its progress bar starts part way.
 */
export function startBatch(batch: TrainBatch, at: number): TrainBatch {
  const saved = Math.max(0, (batch.fullTime ?? batch.costTime) - batch.costTime);
  return { ...batch, startTime: at - saved, endTime: at + batch.costTime };
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
  const done: Record<string, number> = {};
  while (queue[0] && queue[0].endTime > 0 && queue[0].endTime <= ctx.now) {
    const head = queue[0];
    const fort = positionId === WALLS_QUEUE;
    const key = fort ? fortKeyOf(head.troopId) : troopKey(head.troopId);
    if (key) {
      if (fort) b.city.forts = addForts(b.city.forts, { [key]: head.count });
      else b.city.troops = addTroops(b.city.troops, { [key]: head.count });
      done[key] = (done[key] ?? 0) + head.count;
      // what the batch paid becomes refund credit (disbandRefund in core)
      addRefundCredit(b.player, key, head.count * (head.paidShare ?? 1));
    }
    gain += head.count * prestigeOf(PrestigeAction.TRAIN, head.troopId, 1, th);
    exp += head.count * unitExp(head.troopId) * BALANCE.heroExpPerTrain;
    queue = queue.slice(1);
    if (queue[0]) queue[0] = startBatch(queue[0], head.endTime);
    changed = true;
  }
  if (!changed) {
    scheduleHead(ctx, b, positionId, queue);
    return;
  }
  setQueue(b, positionId, queue, nextQueueId);
  scheduleHead(ctx, b, positionId, queue);
  ctx.stat(b.player.id, cityId, prefixed('trained', done));
  addPrestige(b.player, gain);
  const mayor = mayorOf(b.heroes);
  if (mayor && gain + exp > 0) {
    addHeroExp(mayor, gain + exp);
    await saveHero(ctx, mayor);
    ctx.push(b.player.id, PushCmd.HERO_UPDATE, { castleId: cityId, hero: heroBean(mayor), updateType: 2 });
  }
  if (positionId === WALLS_QUEUE) ctx.push(b.player.id, PushCmd.FORTIFICATIONS_UPDATE, { castleId: cityId, fortification: fortBean(b.city.forts) });
  else ctx.push(b.player.id, PushCmd.TROOP_UPDATE, { castleId: cityId, troop: troopBean(b.city.troops) });
  pushQueues(ctx, b, positionId);
  pushResources(ctx, b);
  await saveCity(ctx, b.city);
  await savePlayer(ctx, b.player);
}
