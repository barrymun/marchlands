// Troop and fortification routes (src/routes/cities.ts): what can be trained, the queues, training, cancelling and
// speeding up batches, dismissing troops and fortifications and the injured. The same routes serve troops (at a
// barracks) and fortifications (at the walls). The rules are covered by the training service tests.

import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { BuildingType, FortType, ItemId, TroopType, type FortCounts, type TroopCounts } from '@marchlands/core';
import { cities, players } from '@marchlands/db';
import { getCity, saveCity } from '@marchlands/game/testing';
import { apiTest, type TestApi } from '#test/support/api.ts';
import { expectInvalid, giveItems, itGuards, lords, RICH, setBuildings, setCityStats, setResources, type Lord } from '#test/support/city-fixtures.ts';

const cityRow = async (api: TestApi, id: number) => (await api.db.select().from(cities).where(eq(cities.id, id)))[0];
const items = async (api: TestApi, p: Lord) => (await api.db.select({ items: players.items }).from(players).where(eq(players.id, p.playerId)))[0].items;

const BARRACKS = 2;
const BARRACKS_2 = 4;
const WALLS = -2;

type Batch = { queueId: number; type: number; num: number; startTime: number; endTime: number; costTime: number };
type Queue = { positionId: number; allProduceQueue: Batch[] };

/** Two barracks, walls, people and resources to train with. */
async function garrison(api: TestApi, p: Lord) {
  await setBuildings(api, p, [
    [BARRACKS, BuildingType.BARRACKS, 5],
    [BARRACKS_2, BuildingType.BARRACKS, 5],
    [WALLS, BuildingType.WALLS, 3],
  ]);
  await setResources(api, p, RICH);
  await setCityStats(api, p, { population: 50_000 });
}

/** Set a city's injured troops or fortifications through the repo (as a battle leaves them). */
const patchCity = (api: TestApi, cityId: number, fields: { injuredTroops?: TroopCounts; forts?: FortCounts }) =>
  api.game(async (ctx) => {
    const c = await getCity(ctx, cityId);
    Object.assign(c, fields);
    await saveCity(ctx, c);
  });

const train = (api: TestApi, p: Lord, troopId: number = TroopType.WARRIOR, count = 10) =>
  api.ok<Queue>('POST', `cities/${p.cityId}/troops/train`, { token: p.token, body: { troopId, count, positionId: BARRACKS } });
const trainForts = (api: TestApi, p: Lord, count = 5) =>
  api.ok<Queue>('POST', `cities/${p.cityId}/fortifications/train`, { token: p.token, body: { troopId: FortType.TRAP, count } });

describe('GET /cities/{cityId}/troops/trainable', () => {
  itGuards('GET', (c) => `cities/${c}/troops/trainable`);

  it('lists the troops with their costs and whether the city can train them', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const list = await api.ok<{ typeId: number }[]>('GET', `cities/${a.cityId}/troops/trainable`, { token: a.token });
      expect(list.map((u) => u.typeId)).not.toContain(FortType.TRAP);
      expect(list.find((u) => u.typeId === TroopType.WARRIOR)).toMatchObject({
        key: 'militia',
        costShare: 1,
        permission: true,
        food: expect.any(Number),
        stats: expect.objectContaining({ attack: expect.any(Number) }),
        description: { code: expect.any(String) },
      });
      expect(list.find((u) => u.typeId === TroopType.CAVALRY)).toMatchObject({ permission: false });
    }));
});

describe('GET /cities/{cityId}/fortifications/trainable', () => {
  itGuards('GET', (c) => `cities/${c}/fortifications/trainable`);

  it('lists the fortifications', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const list = await api.ok<{ typeId: number }[]>('GET', `cities/${a.cityId}/fortifications/trainable`, { token: a.token });
      expect(list.map((u) => u.typeId)).not.toContain(TroopType.WARRIOR);
      expect(list.find((u) => u.typeId === FortType.TRAP)).toMatchObject({ key: 'trap', permission: true });
    }));
});

describe('GET /cities/{cityId}/troops/queues', () => {
  itGuards('GET', (c) => `cities/${c}/troops/queues`);

  it("answers each barracks' queue and capacity", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      await train(api, a);
      const { queues } = await api.ok<{ queues: (Queue & { capacity: number })[] }>('GET', `cities/${a.cityId}/troops/queues`, { token: a.token });
      expect(queues).toHaveLength(2);
      expect(queues.find((q) => q.positionId === BARRACKS)).toMatchObject({ capacity: 5, allProduceQueue: [{ type: TroopType.WARRIOR, num: 10 }] });
      expect(queues.find((q) => q.positionId === BARRACKS_2)).toMatchObject({ capacity: 5, allProduceQueue: [] });
    }));
});

describe('GET /cities/{cityId}/fortifications/queues', () => {
  itGuards('GET', (c) => `cities/${c}/fortifications/queues`);

  it('answers the walls queue, capacity and space', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      await trainForts(api, a, 5);
      const data = await api.ok('GET', `cities/${a.cityId}/fortifications/queues`, { token: a.token });
      expect(data).toMatchObject({
        queues: [{ positionId: WALLS, allProduceQueue: [{ type: FortType.TRAP, num: 5 }] }],
        capacity: 3,
        wallSpace: { used: expect.any(Number), max: expect.any(Number) },
      });
    }));
});

describe('POST /cities/{cityId}/troops/train', () => {
  itGuards('POST', (c) => `cities/${c}/troops/train`, { body: { troopId: TroopType.WARRIOR, count: 1, positionId: BARRACKS } });

  it('queues a batch at the barracks and pays for it', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const before = await cityRow(api, a.cityId);
      const q = await train(api, a, TroopType.WARRIOR, 10);
      expect(q).toMatchObject({ positionId: BARRACKS, allProduceQueue: [{ queueId: expect.any(Number), type: TroopType.WARRIOR, num: 10 }] });
      expect(q.allProduceQueue[0].endTime).toBeGreaterThan(Date.now());
      const after = await cityRow(api, a.cityId);
      expect(after.troopQueues).toContainEqual(
        expect.objectContaining({ positionId: BARRACKS, queue: [expect.objectContaining({ troopId: TroopType.WARRIOR })] }),
      );
      expect(after.food).toBeLessThan(before.food);
    }));

  it('refuses a malformed body, a missing barracks and a fortification', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const url = `cities/${a.cityId}/troops/train`;
      await expectInvalid(api, a.token, [
        ['POST', url, { body: { troopId: TroopType.WARRIOR } }],
        ['POST', url, { body: { troopId: TroopType.WARRIOR, count: 'ten' } }],
        ['POST', url, { body: { troopId: TroopType.WARRIOR, count: 1.5 } }],
      ]);
      await api.refused('POST', url, 'training.invalidBarracks', { token: a.token, body: { troopId: TroopType.WARRIOR, count: 1 }, status: 400 });
      await api.refused('POST', url, 'common.invalidTroopType', {
        token: a.token,
        body: { troopId: FortType.TRAP, count: 1, positionId: BARRACKS },
        status: 400,
      });
    }));

  it('does not train fortifications at the walls', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const r = await api.call('POST', `cities/${a.cityId}/troops/train`, { token: a.token, body: { troopId: FortType.TRAP, count: 1, positionId: WALLS } });
      expect(r.status).toBe(400);
      expect((await cityRow(api, a.cityId)).fortQueue.queue).toEqual([]);
    }));
});

describe('POST /cities/{cityId}/fortifications/train', () => {
  itGuards('POST', (c) => `cities/${c}/fortifications/train`, { body: { troopId: FortType.TRAP, count: 1 } });

  it('queues a batch at the walls', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      // a barracks position in the body is ignored: fortifications go to the walls
      const q = await api.ok<Queue>('POST', `cities/${a.cityId}/fortifications/train`, {
        token: a.token,
        body: { troopId: FortType.TRAP, count: 5, positionId: BARRACKS },
      });
      expect(q).toMatchObject({ positionId: WALLS, allProduceQueue: [{ type: FortType.TRAP, num: 5 }] });
      expect((await cityRow(api, a.cityId)).fortQueue.queue).toEqual([expect.objectContaining({ troopId: FortType.TRAP, count: 5 })]);
    }));

  it('refuses a malformed body and a troop', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/fortifications/train`, { body: { count: 1 } }]]);
      await api.refused('POST', `cities/${a.cityId}/fortifications/train`, 'common.invalidTroopType', {
        token: a.token,
        body: { troopId: TroopType.WARRIOR, count: 1 },
        status: 400,
      });
    }));
});

describe('POST /cities/{cityId}/troops/train-many', () => {
  itGuards('POST', (c) => `cities/${c}/troops/train-many`, { body: { orders: [{ troopId: TroopType.WARRIOR, count: 1 }] } });

  it('trains several troop types, split over the barracks by default or at one', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const orders = [
        { troopId: TroopType.WORKER, count: 30 },
        { troopId: TroopType.WARRIOR, count: 40 },
      ];
      expect(await api.ok('POST', `cities/${a.cityId}/troops/train-many`, { token: a.token, body: { orders } })).toEqual({ orders: 2, units: 70 });
      const queues = (await cityRow(api, a.cityId)).troopQueues;
      expect(queues.map((q) => q.positionId).sort()).toEqual([BARRACKS, BARRACKS_2]);
      const one = await api.ok('POST', `cities/${a.cityId}/troops/train-many`, {
        token: a.token,
        body: { orders: [{ troopId: TroopType.WARRIOR, count: 5 }], split: false, positionId: BARRACKS_2 },
      });
      expect(one).toEqual({ orders: 1, units: 5 });
      expect((await cityRow(api, a.cityId)).troopQueues.find((q) => q.positionId === BARRACKS_2)?.queue).toHaveLength(3);
    }));

  it('refuses a malformed body and a type ordered twice', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const url = `cities/${a.cityId}/troops/train-many`;
      const order = { troopId: TroopType.WARRIOR, count: 1 };
      await expectInvalid(api, a.token, [
        ['POST', url, { body: { orders: [] } }],
        ['POST', url, { body: { orders: [{ troopId: TroopType.WARRIOR, count: 0 }] } }],
        ['POST', url, { body: { orders: Array.from({ length: 21 }, (_, i) => ({ troopId: i, count: 1 })) } }],
        ['POST', url, { body: { orders: [order], split: 'yes' } }],
      ]);
      await api.refused('POST', url, 'training.duplicateOrder', { token: a.token, body: { orders: [order, order] }, status: 400 });
    }));
});

describe('POST /cities/{cityId}/fortifications/train-many', () => {
  itGuards('POST', (c) => `cities/${c}/fortifications/train-many`, { body: { orders: [{ troopId: FortType.TRAP, count: 1 }] } });

  it('trains fortifications at the walls', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const res = await api.ok('POST', `cities/${a.cityId}/fortifications/train-many`, {
        token: a.token,
        body: { orders: [{ troopId: FortType.TRAP, count: 4 }] },
      });
      expect(res).toEqual({ orders: 1, units: 4 });
      expect((await cityRow(api, a.cityId)).fortQueue.queue).toEqual([expect.objectContaining({ troopId: FortType.TRAP, count: 4 })]);
    }));

  it('refuses a troop', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      await api.refused('POST', `cities/${a.cityId}/fortifications/train-many`, 'common.invalidTroopType', {
        token: a.token,
        body: { orders: [{ troopId: TroopType.WARRIOR, count: 1 }] },
        status: 400,
      });
    }));
});

describe('DELETE /cities/{cityId}/troops/queues/{positionId}/{queueId}', () => {
  itGuards('DELETE', (c) => `cities/${c}/troops/queues/${BARRACKS}/1`);

  it('cancels a batch', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const { allProduceQueue } = await train(api, a);
      expect(await api.ok('DELETE', `cities/${a.cityId}/troops/queues/${BARRACKS}/${allProduceQueue[0].queueId}`, { token: a.token })).toBeNull();
      expect((await cityRow(api, a.cityId)).troopQueues.find((q) => q.positionId === BARRACKS)?.queue).toEqual([]);
    }));

  it('refuses malformed ids and an unknown batch', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['DELETE', `cities/${a.cityId}/troops/queues/${BARRACKS}/-1`],
        ['DELETE', `cities/${a.cityId}/troops/queues/2000/1`],
      ]);
      await api.refused('DELETE', `cities/${a.cityId}/troops/queues/${BARRACKS}/99`, 'training.batchNotFound', { token: a.token, status: 404 });
    }));
});

describe('DELETE /cities/{cityId}/fortifications/queues/{positionId}/{queueId}', () => {
  itGuards('DELETE', (c) => `cities/${c}/fortifications/queues/${WALLS}/1`);

  it('cancels a batch at the walls', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const { allProduceQueue } = await trainForts(api, a);
      expect(await api.ok('DELETE', `cities/${a.cityId}/fortifications/queues/${WALLS}/${allProduceQueue[0].queueId}`, { token: a.token })).toBeNull();
      expect((await cityRow(api, a.cityId)).fortQueue.queue).toEqual([]);
    }));

  it('refuses an unknown batch', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('DELETE', `cities/${a.cityId}/fortifications/queues/${WALLS}/99`, 'training.batchNotFound', { token: a.token, status: 404 });
    }));
});

describe('POST /cities/{cityId}/troops/queues/{positionId}/{queueId}/speedup', () => {
  itGuards('POST', (c) => `cities/${c}/troops/queues/${BARRACKS}/1/speedup`);

  it("uses a Napoleon's Diary on the batch", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      await giveItems(api, a, { [ItemId.NAPOLEONS_DIARY]: 1 });
      const batch = (await train(api, a, TroopType.WARRIOR, 500)).allProduceQueue[0];
      expect(await api.ok('POST', `cities/${a.cityId}/troops/queues/${BARRACKS}/${batch.queueId}/speedup`, { token: a.token })).toBeNull();
      const after = (await cityRow(api, a.cityId)).troopQueues.find((q) => q.positionId === BARRACKS)!.queue[0];
      expect(after.endTime).toBeLessThan(batch.endTime);
      expect((await items(api, a))[ItemId.NAPOLEONS_DIARY]).toBeUndefined();
    }));

  it('refuses an unknown batch', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/troops/queues/${BARRACKS}/x/speedup`]]);
      await api.refused('POST', `cities/${a.cityId}/troops/queues/${BARRACKS}/99/speedup`, 'training.batchNotFound', { token: a.token, status: 404 });
    }));
});

describe('POST /cities/{cityId}/fortifications/queues/{positionId}/{queueId}/speedup', () => {
  itGuards('POST', (c) => `cities/${c}/fortifications/queues/${WALLS}/1/speedup`);

  it("uses an Archimedes' Note on the batch", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      await giveItems(api, a, { [ItemId.ARCHIMEDES_NOTE]: 2 });
      const batch = (await trainForts(api, a, 50)).allProduceQueue[0];
      expect(await api.ok('POST', `cities/${a.cityId}/fortifications/queues/${WALLS}/${batch.queueId}/speedup`, { token: a.token })).toBeNull();
      expect((await cityRow(api, a.cityId)).fortQueue.queue[0].endTime).toBeLessThan(batch.endTime);
      expect((await items(api, a))[ItemId.ARCHIMEDES_NOTE]).toBe(1);
    }));

  it('refuses an unknown batch', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('POST', `cities/${a.cityId}/fortifications/queues/${WALLS}/99/speedup`, 'training.batchNotFound', { token: a.token, status: 404 });
    }));
});

describe('POST /cities/{cityId}/troops/train-split', () => {
  itGuards('POST', (c) => `cities/${c}/troops/train-split`, { body: { troopId: TroopType.WARRIOR, count: 1 } });

  it('splits one order over the barracks', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await garrison(api, a);
      const res = await api.ok<{ batches: { positionId: number; count: number }[]; finishAt: number }>('POST', `cities/${a.cityId}/troops/train-split`, {
        token: a.token,
        body: { troopId: TroopType.WARRIOR, count: 100 },
      });
      expect(res.batches.map((b) => b.positionId).sort()).toEqual([BARRACKS, BARRACKS_2]);
      expect(res.batches.reduce((s, b) => s + b.count, 0)).toBe(100);
      expect(res.finishAt).toBeGreaterThan(Date.now());
      expect((await cityRow(api, a.cityId)).troopQueues).toHaveLength(2);
    }));

  it('refuses a malformed body and a city whose barracks queues are full', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/troops/train-split`, { body: { troopId: TroopType.WARRIOR } }]]);
      await setBuildings(api, a, [[BARRACKS, BuildingType.BARRACKS, 1]]);
      await setResources(api, a, RICH);
      await setCityStats(api, a, { population: 1000 });
      await train(api, a, TroopType.WARRIOR, 1);
      await api.refused('POST', `cities/${a.cityId}/troops/train-split`, 'training.allQueuesFull', {
        token: a.token,
        body: { troopId: TroopType.WARRIOR, count: 1 },
        status: 400,
      });
    }));
});

describe('POST /cities/{cityId}/troops/disband', () => {
  itGuards('POST', (c) => `cities/${c}/troops/disband`, { body: { troopId: TroopType.WARRIOR, count: 1 } });

  it('dismisses troops', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setCityStats(api, a, { troops: { militia: 10 } });
      expect(await api.ok('POST', `cities/${a.cityId}/troops/disband`, { token: a.token, body: { troopId: TroopType.WARRIOR, count: 4 } })).toBeNull();
      expect((await cityRow(api, a.cityId)).troops).toMatchObject({ militia: 6 });
    }));

  it('refuses a malformed body and more troops than the city has', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/troops/disband`, { body: { troopId: TroopType.WARRIOR, count: '4' } }]]);
      const r = await api.refused('POST', `cities/${a.cityId}/troops/disband`, 'training.notEnoughUnits', {
        token: a.token,
        body: { troopId: TroopType.WARRIOR, count: 4 },
        status: 400,
      });
      expect(r.body.error?.params).toEqual({ unit: { ref: 'troop', id: TroopType.WARRIOR } });
    }));
});

describe('POST /cities/{cityId}/fortifications/destroy', () => {
  itGuards('POST', (c) => `cities/${c}/fortifications/destroy`, { body: { troopId: FortType.TRAP, count: 1 } });

  it('destroys fortifications', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await patchCity(api, a.cityId, { forts: { trap: 5 } });
      expect(await api.ok('POST', `cities/${a.cityId}/fortifications/destroy`, { token: a.token, body: { troopId: FortType.TRAP, count: 2 } })).toBeNull();
      expect((await cityRow(api, a.cityId)).forts).toEqual({ trap: 3 });
    }));

  it('refuses a malformed body and a troop', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/fortifications/destroy`, { body: { troopId: FortType.TRAP } }]]);
      await api.refused('POST', `cities/${a.cityId}/fortifications/destroy`, 'training.invalidFort', {
        token: a.token,
        body: { troopId: TroopType.WARRIOR, count: 1 },
        status: 400,
      });
    }));
});

describe('POST /cities/{cityId}/troops/injured/cure', () => {
  itGuards('POST', (c) => `cities/${c}/troops/injured/cure`, { body: { troops: { militia: 1 } } });

  it('heals injured troops with resources', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResources(api, a, RICH);
      await patchCity(api, a.cityId, { injuredTroops: { militia: 10 } });
      expect(await api.ok('POST', `cities/${a.cityId}/troops/injured/cure`, { token: a.token, body: { troops: { militia: 4 } } })).toBeNull();
      expect(await cityRow(api, a.cityId)).toMatchObject({ injuredTroops: { militia: 6 }, troops: { militia: 4 } });
    }));

  it('refuses a malformed body, more than are injured and honor the player lacks', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await patchCity(api, a.cityId, { injuredTroops: { militia: 10 } });
      const url = `cities/${a.cityId}/troops/injured/cure`;
      await expectInvalid(api, a.token, [
        ['POST', url, { body: {} }],
        ['POST', url, { body: { troops: { militia: -1 } } }],
        ['POST', url, { body: { troops: { militia: 1 }, payWith: 'gems' } }],
      ]);
      await api.refused('POST', url, 'training.notEnoughInjured', { token: a.token, body: { troops: { militia: 11 } }, status: 400 });
      await api.refused('POST', url, 'training.notEnoughHonor', { token: a.token, body: { troops: { militia: 1 }, payWith: 'honor' }, status: 400 });
    }));
});

describe('POST /cities/{cityId}/troops/injured/disband', () => {
  itGuards('POST', (c) => `cities/${c}/troops/injured/disband`, { body: { troops: { militia: 1 } } });

  it('dismisses injured troops', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await patchCity(api, a.cityId, { injuredTroops: { militia: 10 } });
      expect(await api.ok('POST', `cities/${a.cityId}/troops/injured/disband`, { token: a.token, body: { troops: { militia: 4 } } })).toBeNull();
      expect((await cityRow(api, a.cityId)).injuredTroops).toEqual({ militia: 6 });
    }));

  it('refuses a malformed body and more than are injured', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/troops/injured/disband`, { body: { troops: [1] } }]]);
      await api.refused('POST', `cities/${a.cityId}/troops/injured/disband`, 'training.notEnoughInjured', {
        token: a.token,
        body: { troops: { militia: 1 } },
        status: 400,
      });
    }));
});
