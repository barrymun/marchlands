// Helpers for the training tests (services/training.db.test.ts, engine/training.db.test.ts): barracks,
// a city's production queues and batch times.

import { BuildingType, trainBatchMs } from '@marchlands/core';

import { training } from '#/index.ts';
import { cityBundle, reloadCity, setBuildings, type TestPlayer } from '#test/support/factories.ts';
import { type TestGame } from '#test/support/game.ts';

export const { WALLS_QUEUE } = training;

export const withBarracks = (g: TestGame, p: TestPlayer, levels: number[]) =>
  setBuildings(
    g,
    p,
    levels.map((l, i): [number, number, number] => [i, BuildingType.BARRACKS, l]),
  );

export const queueOf = async (g: TestGame, p: TestPlayer, positionId: number) => {
  const c = await reloadCity(g, p.cityId);
  return positionId === WALLS_QUEUE ? c.fortQueue.queue : (c.troopQueues.find((q) => q.positionId === positionId)?.queue ?? []);
};

export const batchMs = async (g: TestGame, p: TestPlayer, troopId: number, count: number) => {
  const b = await cityBundle(g, p);
  return trainBatchMs(troopId, count, null, b.player.research);
};
