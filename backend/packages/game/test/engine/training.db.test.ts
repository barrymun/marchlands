import { describe, expect, it } from 'vitest';
import { TroopType } from '@marchlands/core';
import { training } from '#/index.ts';
import { cityBundle, createTestPlayer, reloadCity } from '#test/support/factories.ts';
import { game } from '#test/support/game.ts';
import { completeTraining, hasTrainingRoom } from '#/engine/training.ts';
import { withBarracks, queueOf, batchMs } from '#test/support/training.ts';
const { WORKER, WARRIOR } = TroopType;

describe(hasTrainingRoom.name, () => {
  it('needs a barracks with fewer queued batches than its level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(hasTrainingRoom(await cityBundle(g, p))).toBe(false);
      await withBarracks(g, p, [1]);
      expect(hasTrainingRoom(await cityBundle(g, p))).toBe(true);
      await training.train(g, p.id, p.cityId, WORKER, 1, 0);
      expect(hasTrainingRoom(await cityBundle(g, p))).toBe(false);
      await withBarracks(g, p, [2]);
      expect(hasTrainingRoom(await cityBundle(g, p))).toBe(true);
    }));
});

describe(completeTraining.name, () => {
  it('does nothing before the head is due, and keeps it scheduled', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      const ev = g.events('train')[0];
      const pushes = g.pushes().length;
      await completeTraining(g, p.cityId, 0);
      expect(await queueOf(g, p, 0)).toHaveLength(1);
      expect(g.events('train')).toEqual([ev]);
      expect(g.pushes()).toHaveLength(pushes);
    }));

  it('completes every batch that is due, in one go', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      await training.train(g, p.id, p.cityId, WARRIOR, 10, 0);
      g.advance((await batchMs(g, p, WORKER, 10)) + (await batchMs(g, p, WARRIOR, 10)));
      await completeTraining(g, p.cityId, 0);
      expect((await reloadCity(g, p.cityId)).troops).toMatchObject({ peasants: 10, militia: 10 });
      expect(await queueOf(g, p, 0)).toEqual([]);
      expect(g.events('train')).toEqual([]);
    }));

  it('ignores a city that no longer exists', () =>
    game(async (g) => {
      await completeTraining(g, -1, 0);
      expect(g.pushes()).toEqual([]);
    }));
});
