import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BuildingType,
  disbandRefund,
  FORT_KEYS,
  FortType,
  healCost,
  healHonorCost,
  itemGoldPrice,
  ItemId,
  msg,
  PrestigeAction,
  prestigeOf,
  ref,
  RESOURCE_KEYS,
  type Resources,
  splitTraining,
  TechType,
  trainCost,
  TroopType,
  troopUnitSeconds,
  unitExp,
  wallCapacity,
} from '@marchlands/core';

import { savepoint } from '#/context.ts';
import { heroes, shop, training } from '#/index.ts';
import { getHero, saveCity, saveHero, savePlayer } from '#/repo.ts';
import { expectRefused } from '#test/support/expect.ts';
import {
  addHero,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setCityStats,
  setResearch,
  setResources,
  type TestPlayer,
} from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { batchMs, queueOf, WALLS_QUEUE, withBarracks } from '#test/support/training.ts';

const { WORKER, WARRIOR, SCOUT } = TroopType;

/** Walls (position -2) of this level. */
const withWalls = (g: TestGame, p: TestPlayer, level: number) => setBuildings(g, p, [[-2, BuildingType.WALLS, level]]);

/** Room for a bigger population: a level 10 cottage, and `population` people. */
async function withPopulation(g: TestGame, p: TestPlayer, population: number) {
  await setBuildings(g, p, [[20, BuildingType.COTTAGE, 10]]);
  await setCityStats(g, p, { population });
}

/** Change the stored city row (forts, injured troops ...). */
async function editCity(g: TestGame, p: TestPlayer, edit: (c: Awaited<ReturnType<typeof reloadCity>>) => void) {
  const c = await reloadCity(g, p.cityId);
  edit(c);
  await saveCity(g, c);
}

const resourcesOf = (c: Resources): Resources => ({ gold: c.gold, food: c.food, wood: c.wood, stone: c.stone, iron: c.iron });

function expectResources(actual: Resources, expected: Resources) {
  for (const k of RESOURCE_KEYS) expect(actual[k], k).toBeCloseTo(expected[k], 6);
}

const minus = (a: Resources, b: Partial<Resources>, mult = 1): Resources =>
  Object.fromEntries(RESOURCE_KEYS.map((k) => [k, a[k] - (b[k] ?? 0) * mult])) as unknown as Resources;

const INJURED = { peasants: 10, militia: 4 };

describe(training.trainableList.name, () => {
  it('lists the troops with their requirements, time and cost share', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = await training.trainableList(g, p.id, p.cityId, false);
      expect(before.map((t) => t.typeId)).toEqual(Object.values(TroopType));
      expect(before.every((t) => !t.permission && t.costShare === 1)).toBe(true);

      await withBarracks(g, p, [1]);
      const list = await training.trainableList(g, p.id, p.cityId, false);
      const worker = list.find((t) => t.typeId === WORKER)!;
      expect(worker).toMatchObject({ key: 'peasants', permission: true, population: 1, time: troopUnitSeconds(WORKER, null, {}) });
      expect(worker.requirements).toEqual([{ kind: 'building', id: BuildingType.BARRACKS, required: 1, current: 1, ok: true }]);
      const scout = list.find((t) => t.typeId === SCOUT)!;
      expect(scout.permission).toBe(false);
      expect(scout.requirements.filter((r) => !r.ok).map((r) => r.kind)).toEqual(['building', 'tech']);
    }));

  it('troops show the Quartermaster discount; fortifications never do', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.QUARTERMASTERS_SEAL]: 1 });
      await shop.useItem(g, p.id, ItemId.QUARTERMASTERS_SEAL, null);
      const troops = await training.trainableList(g, p.id, p.cityId, false);
      expect(new Set(troops.map((t) => t.costShare))).toEqual(new Set([1 - BALANCE.trainCostReduction]));
      const forts = await training.trainableList(g, p.id, p.cityId, true);
      expect(forts.map((t) => t.typeId)).toEqual(Object.values(FortType));
      expect(forts.map((t) => t.key)).toEqual(Object.values(FORT_KEYS));
      expect(forts.every((t) => t.costShare === 1)).toBe(true);
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(training.trainableList(g, a.id, b.cityId, false), msg('common.invalidCastle'));
    }));
});

describe(training.productionQueues.name, () => {
  it('lists each barracks queue with its capacity', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2, 1]);
      await training.train(g, p.id, p.cityId, WORKER, 3, 0);
      const { queues } = await training.productionQueues(g, p.id, p.cityId, false);
      expect(queues).toHaveLength(2);
      expect(queues.find((q) => q.positionId === 0)).toMatchObject({ capacity: 2, allProduceQueue: [{ queueId: 1, type: WORKER, num: 3 }] });
      expect(queues.find((q) => q.positionId === 1)).toMatchObject({ capacity: 1, allProduceQueue: [] });
    }));

  it('the walls queue shows the wall space used and available', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 2);
      await editCity(g, p, (c) => (c.forts = { arrowTower: 10 }));
      await training.train(g, p.id, p.cityId, FortType.TRAP, 5, WALLS_QUEUE);
      const r = await training.productionQueues(g, p.id, p.cityId, true);
      expect(r.capacity).toBe(2);
      expect(r.wallSpace).toEqual({ used: 10 * BALANCE.fortSpace[FortType.ARCHER_TOWER] + 5 * BALANCE.fortSpace[FortType.TRAP], max: BALANCE.wallSpace[2] });
      expect(r.queues[0]).toMatchObject({ positionId: WALLS_QUEUE, allProduceQueue: [{ type: FortType.TRAP, num: 5 }] });
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(training.productionQueues(g, a.id, b.cityId, true), msg('common.invalidCastle'));
    }));
});

describe(training.train.name, () => {
  it('pays, takes the population, queues the batch and schedules its completion', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      const before = await reloadCity(g, p.cityId);
      const ms = await batchMs(g, p, WORKER, 10);

      const q = await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      expect(q).toEqual({
        positionId: 0,
        allProduceQueue: [{ queueId: 1, type: WORKER, num: 10, startTime: g.now, endTime: g.now + ms, costTime: Math.round(ms / 1000) }],
      });
      const city = await reloadCity(g, p.cityId);
      expectResources(resourcesOf(city), minus(resourcesOf(before), trainCost(WORKER, 10)));
      expect(city.population).toBe(before.population - 10);
      expect(city.troopQueues).toEqual([
        { positionId: 0, nextQueueId: 2, queue: [{ queueId: 1, troopId: WORKER, count: 10, costTime: ms, startTime: g.now, endTime: g.now + ms }] },
      ]);
      expect(g.events('train')).toEqual([
        { type: 'train', dueAt: g.now + ms, playerId: p.id, cityId: p.cityId, refKey: `train:${p.cityId}:0`, payload: { positionId: 0 } },
      ]);
      expect(g.pushes(PushCmd.TROOP_QUEUE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId, positionId: 0 } });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('completes on time: troops, prestige and a troop update', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      const due = g.events('train')[0].dueAt;
      await g.runDue(due - 1);
      expect((await reloadCity(g, p.cityId)).troops.peasants ?? 0).toBe(0);

      expect(await g.runDue(due)).toBe(1);
      const city = await reloadCity(g, p.cityId);
      expect(city.troops.peasants).toBe(10);
      expect(city.troopQueues[0].queue).toEqual([]);
      expect((await reloadPlayer(g, p)).prestige).toBe(10 * prestigeOf(PrestigeAction.TRAIN, WORKER, 1, 1));
      expect(g.pushes(PushCmd.TROOP_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, troop: { peasants: 10 } });
      expect(g.events('train')).toEqual([]);
    }));

  it('a second batch waits, then starts when the first ends', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      const q = await training.train(g, p.id, p.cityId, WARRIOR, 5, 0);
      const ms1 = await batchMs(g, p, WORKER, 10);
      const ms2 = await batchMs(g, p, WARRIOR, 5);
      expect(q.allProduceQueue[1]).toMatchObject({ queueId: 2, type: WARRIOR, num: 5, startTime: 0, endTime: 0 });
      expect(g.events('train')).toHaveLength(1);

      const end1 = g.now + ms1;
      await g.runDue(end1);
      const [second] = await queueOf(g, p, 0);
      expect(second).toMatchObject({ queueId: 2, startTime: end1, endTime: end1 + ms2 });
      expect(g.events('train')[0].dueAt).toBe(end1 + ms2);

      await g.runDue(end1 + ms2);
      expect((await reloadCity(g, p.cityId)).troops).toMatchObject({ peasants: 10, militia: 5 });
    }));

  it("gives the mayor the batch's prestige and training experience", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      const heroId = await addHero(g, p);
      await heroes.appointMayor(g, p.id, heroId);
      const before = await getHero(g, heroId);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      await g.runDue(g.events('train')[0].dueAt);
      const gain = 10 * prestigeOf(PrestigeAction.TRAIN, WORKER, 1, 1);
      const exp = 10 * unitExp(WORKER) * BALANCE.heroExpPerTrain;
      expect((await getHero(g, heroId)).experience).toBeCloseTo(before.experience + gain + exp, 6);
      expect(g.pushes(PushCmd.HERO_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, updateType: 2 });
    }));

  it('a mayor strong enough to train in no time finishes the batch at once', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      const heroId = await addHero(g, p);
      await heroes.appointMayor(g, p.id, heroId);
      const h = await getHero(g, heroId);
      h.power = 5000;
      await saveHero(g, h);
      expect(troopUnitSeconds(WORKER, { power: 5000, management: 0, stratagem: 0 }, {})).toBe(0);

      const q = await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      expect(q).toEqual({ positionId: 0, allProduceQueue: [] });
      expect((await reloadCity(g, p.cityId)).troops.peasants).toBe(10);
      expect(g.events('train')).toEqual([]);
    }));

  it('pays the discounted cost while a Quartermaster buff runs, and remembers it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await giveItems(g, p, { [ItemId.QUARTERMASTERS_SEAL]: 1 });
      await shop.useItem(g, p.id, ItemId.QUARTERMASTERS_SEAL, null);
      const before = await reloadCity(g, p.cityId);
      const share = 1 - BALANCE.trainCostReduction;
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      expectResources(resourcesOf(await reloadCity(g, p.cityId)), minus(resourcesOf(before), trainCost(WORKER, 10, share)));
      expect((await queueOf(g, p, 0))[0].paidShare).toBe(share);
    }));

  it('trains fortifications at the walls, at full cost', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 1);
      await giveItems(g, p, { [ItemId.QUARTERMASTERS_SEAL]: 1 });
      await shop.useItem(g, p.id, ItemId.QUARTERMASTERS_SEAL, null);
      const before = await reloadCity(g, p.cityId);
      const q = await training.train(g, p.id, p.cityId, FortType.TRAP, 10, WALLS_QUEUE);
      expect(q).toMatchObject({ positionId: WALLS_QUEUE, allProduceQueue: [{ type: FortType.TRAP, num: 10 }] });
      expectResources(resourcesOf(await reloadCity(g, p.cityId)), minus(resourcesOf(before), trainCost(FortType.TRAP, 10)));
      expect(g.pushes(PushCmd.FORTIFICATIONS_QUEUE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, positionId: WALLS_QUEUE });
      expect(g.events('train')[0].refKey).toBe(`train:${p.cityId}:${WALLS_QUEUE}`);

      await g.runDue(g.events('train')[0].dueAt);
      const city = await reloadCity(g, p.cityId);
      expect(city.forts).toEqual({ trap: 10 });
      expect(city.fortQueue).toEqual({ queue: [], nextQueueId: 2 });
      expect(g.pushes(PushCmd.FORTIFICATIONS_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, fortification: { trap: 10 } });
    }));

  it('fortifications need wall space, counting built and queued ones', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 2);
      const max = wallCapacity((await reloadCity(g, p.cityId)).buildings);
      await editCity(g, p, (c) => (c.forts = { trap: max - 6 }));
      await training.train(g, p.id, p.cityId, FortType.TRAP, 3, WALLS_QUEUE);
      await expectRefused(training.train(g, p.id, p.cityId, FortType.TRAP, 4, WALLS_QUEUE), msg('training.wallSpaceFull'));
      await training.train(g, p.id, p.cityId, FortType.TRAP, 3, WALLS_QUEUE);
    }));

  it('checks the requirements, the troop type and the amount', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1, 0), msg('building.troopRequirementsNotMet'));
      await withBarracks(g, p, [2]);
      await expectRefused(training.train(g, p.id, p.cityId, SCOUT, 1, 0), msg('building.troopRequirementsNotMet'));
      await setResearch(g, p, TechType.INFORMATICS, 1);
      await training.train(g, p.id, p.cityId, SCOUT, 1, 0);

      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 0, 0), msg('common.invalidAmount'));
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1.5, 0), msg('common.invalidAmount'));
      await expectRefused(training.train(g, p.id, p.cityId, 99, 1, 0), msg('common.invalidTroopType'));
      await expectRefused(training.train(g, p.id, p.cityId, FortType.TRAP, 1, 0), msg('common.invalidTroopType'));
      await withWalls(g, p, 1);
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1, WALLS_QUEUE), msg('common.invalidTroopType'));
    }));

  it('needs a barracks (or the walls) at the position, with room in its queue', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      const barracks = msg('training.invalidBarracks', { building: ref.building(BuildingType.BARRACKS) });
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1, 5), barracks);
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1, -1), barracks);
      await training.train(g, p.id, p.cityId, WORKER, 1, 0);
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1, 0), msg('training.queueFull'));

      // walls built off their position: the requirement is met, but there is no wall queue
      await setBuildings(g, p, [[7, BuildingType.WALLS, 1]]);
      await expectRefused(
        training.train(g, p.id, p.cityId, FortType.TRAP, 1, WALLS_QUEUE),
        msg('training.wallsNeeded', { building: ref.building(BuildingType.WALLS) }),
      );
    }));

  it('needs idle population and the resources', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      const { population } = await reloadCity(g, p.cityId);
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, population + 1, 0), msg('training.notEnoughPopulation'));
      await setResources(g, p, { wood: 0 });
      await expectRefused(training.train(g, p.id, p.cityId, WORKER, 1, 0), msg('common.notEnoughResources'));
      expect(await queueOf(g, p, 0)).toEqual([]);
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await withBarracks(g, b, [1]);
      await expectRefused(training.train(g, a.id, b.cityId, WORKER, 1, 0), msg('common.invalidCastle'));
    }));
});

describe(training.trainMany.name, () => {
  it('queues every order and counts the units', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      const r = await training.trainMany(
        g,
        p.id,
        p.cityId,
        [
          { troopId: WORKER, count: 4 },
          { troopId: WARRIOR, count: 6 },
        ],
        { fort: false, split: false, positionId: 0 },
      );
      expect(r).toEqual({ orders: 2, units: 10 });
      expect((await queueOf(g, p, 0)).map((q) => [q.troopId, q.count])).toEqual([
        [WORKER, 4],
        [WARRIOR, 6],
      ]);
    }));

  it('sends fortifications to the walls and split orders over the barracks', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 2);
      await withBarracks(g, p, [1, 1]);
      await training.trainMany(g, p.id, p.cityId, [{ troopId: FortType.TRAP, count: 2 }], { fort: true, split: false });
      expect((await queueOf(g, p, WALLS_QUEUE)).map((q) => q.count)).toEqual([2]);
      await training.trainMany(g, p.id, p.cityId, [{ troopId: WORKER, count: 10 }], { fort: false, split: true });
      expect([...(await queueOf(g, p, 0)), ...(await queueOf(g, p, 1))].map((q) => q.count)).toEqual([5, 5]);
    }));

  it('refuses no orders, too many, duplicates and bad counts', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      const opts = { fort: false, split: false, positionId: 0 };
      const limit = msg('training.orderLimit', { max: 20 });
      await expectRefused(training.trainMany(g, p.id, p.cityId, [], opts), limit);
      const many = Array.from({ length: 21 }, (_, i) => ({ troopId: i + 1, count: 1 }));
      await expectRefused(training.trainMany(g, p.id, p.cityId, many, opts), limit);
      await expectRefused(
        training.trainMany(
          g,
          p.id,
          p.cityId,
          [
            { troopId: WORKER, count: 1 },
            { troopId: WORKER, count: 2 },
          ],
          opts,
        ),
        msg('training.duplicateOrder'),
      );
      await expectRefused(training.trainMany(g, p.id, p.cityId, [{ troopId: WORKER, count: 0 }], opts), msg('common.invalidAmount'));
      await expectRefused(training.trainMany(g, p.id, p.cityId, [{ troopId: WORKER, count: 1 }], { fort: false, split: false }), 'training.invalidBarracks');
    }));

  it('is all or nothing: a failing order undoes the ones before it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      const before = await reloadCity(g, p.cityId);
      // the second order finds the queue full
      const orders = [
        { troopId: WORKER, count: 1 },
        { troopId: WARRIOR, count: 1 },
      ];
      await expectRefused(
        savepoint(g, (ctx) => training.trainMany(ctx, p.id, p.cityId, orders, { fort: false, split: false, positionId: 0 })),
        msg('training.queueFull'),
      );
      const after = await reloadCity(g, p.cityId);
      expectResources(resourcesOf(after), resourcesOf(before));
      expect(after.troopQueues).toEqual(before.troopQueues);
    }));
});

describe(training.trainSplit.name, () => {
  it('shares an order equally over idle barracks, paid as one order', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1, 1]);
      const before = await reloadCity(g, p.cityId);
      const unitMs = troopUnitSeconds(WORKER, null, {}) * 1000;
      const r = await training.trainSplit(g, p.id, p.cityId, WORKER, 10);
      expect(r.batches).toEqual([
        { positionId: 0, count: 5, endTime: g.now + 5 * unitMs },
        { positionId: 1, count: 5, endTime: g.now + 5 * unitMs },
      ]);
      expect(r.finishAt).toBe(g.now + 5 * unitMs);
      const city = await reloadCity(g, p.cityId);
      expectResources(resourcesOf(city), minus(resourcesOf(before), trainCost(WORKER, 10)));
      expect(city.population).toBe(before.population - 10);
      expect(g.events('train').map((e) => e.refKey)).toEqual([`train:${p.cityId}:0`, `train:${p.cityId}:1`]);
      expect(g.pushes(PushCmd.TROOP_QUEUE_UPDATE)).toHaveLength(2);
    }));

  it('gives a busy barracks fewer units so all finish together', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withPopulation(g, p, 1000);
      await withBarracks(g, p, [2, 1]);
      await training.train(g, p.id, p.cityId, WORKER, 20, 0);
      const unitMs = troopUnitSeconds(WORKER, null, {}) * 1000;
      const expected = splitTraining(
        [
          { positionId: 0, freeAt: g.now + 20 * unitMs },
          { positionId: 1, freeAt: g.now },
        ],
        30,
        unitMs,
      );
      const r = await training.trainSplit(g, p.id, p.cityId, WORKER, 30);
      const counts = Object.fromEntries(r.batches.map((b) => [b.positionId, b.count]));
      expect(counts).toEqual(Object.fromEntries(expected.map((e) => [e.positionId, e.count])));
      expect(counts[1]).toBeGreaterThan(counts[0]);
      // the busy barracks' share waits behind its first batch
      expect((await queueOf(g, p, 0))[1]).toMatchObject({ count: counts[0], startTime: 0, endTime: 0 });
    }));

  it('skips barracks whose queue is full, and refuses when all are', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1, 1]);
      await training.train(g, p.id, p.cityId, WORKER, 1, 0);
      const r = await training.trainSplit(g, p.id, p.cityId, WORKER, 4);
      expect(r.batches).toEqual([expect.objectContaining({ positionId: 1, count: 4 })]);
      await expectRefused(training.trainSplit(g, p.id, p.cityId, WORKER, 1), msg('training.allQueuesFull', { building: ref.building(BuildingType.BARRACKS) }));
    }));

  it('refuses fortifications, unmet requirements and too little population', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(training.trainSplit(g, p.id, p.cityId, WORKER, 1), msg('building.troopRequirementsNotMet'));
      await withBarracks(g, p, [1]);
      await withWalls(g, p, 1);
      // assertCanTrain refuses a fortification before the dedicated training.fortsAtWalls check is reached
      await expectRefused(training.trainSplit(g, p.id, p.cityId, FortType.TRAP, 1), msg('common.invalidTroopType'));
      await expectRefused(training.trainSplit(g, p.id, p.cityId, WORKER, 0), msg('common.invalidAmount'));
      const { population } = await reloadCity(g, p.cityId);
      await expectRefused(training.trainSplit(g, p.id, p.cityId, WORKER, population + 1), msg('training.notEnoughPopulation'));
      await setResources(g, p, { food: 0 });
      await expectRefused(training.trainSplit(g, p.id, p.cityId, WORKER, 1), msg('common.notEnoughResources'));
    }));
});

describe(training.cancelTraining.name, () => {
  it('cancelling the batch in progress refunds part of it and starts the next', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      await training.train(g, p.id, p.cityId, WARRIOR, 5, 0);
      const before = await reloadCity(g, p.cityId);
      await training.cancelTraining(g, p.id, p.cityId, 0, 1);

      const city = await reloadCity(g, p.cityId);
      expectResources(resourcesOf(city), minus(resourcesOf(before), trainCost(WORKER, 10), -BALANCE.cancelTrainInProgressRefund));
      expect(city.population).toBe(before.population + 10);
      const ms2 = await batchMs(g, p, WARRIOR, 5);
      expect(city.troopQueues[0]).toMatchObject({ nextQueueId: 3, queue: [{ queueId: 2, startTime: g.now, endTime: g.now + ms2 }] });
      expect(g.events('train').map((e) => e.dueAt)).toEqual([g.now + ms2]);
      expect(g.pushes(PushCmd.TROOP_QUEUE_UPDATE).at(-1)?.data).toMatchObject({ allProduceQueue: [{ queueId: 2 }] });
    }));

  it('cancelling a waiting batch refunds it in full and leaves the head alone', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      const before = await reloadCity(g, p.cityId);
      const head = (await queueOf(g, p, 0))[0];
      await training.train(g, p.id, p.cityId, WARRIOR, 5, 0);
      await training.cancelTraining(g, p.id, p.cityId, 0, 2);
      expect(BALANCE.cancelTrainQueuedRefund).toBe(1);
      const city = await reloadCity(g, p.cityId);
      expectResources(resourcesOf(city), resourcesOf(before));
      expect(city.population).toBe(before.population);
      expect(await queueOf(g, p, 0)).toEqual([head]);
    }));

  it('refunds what was paid under a discount, and unschedules an emptied queue', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await giveItems(g, p, { [ItemId.QUARTERMASTERS_SEAL]: 1 });
      await shop.useItem(g, p.id, ItemId.QUARTERMASTERS_SEAL, null);
      const before = await reloadCity(g, p.cityId);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      await training.cancelTraining(g, p.id, p.cityId, 0, 1);
      const paid = trainCost(WORKER, 10, 1 - BALANCE.trainCostReduction);
      expectResources(resourcesOf(await reloadCity(g, p.cityId)), minus(resourcesOf(before), paid, 1 - BALANCE.cancelTrainInProgressRefund));
      expect(await queueOf(g, p, 0)).toEqual([]);
      expect(g.events('train')).toEqual([]);
    }));

  it('cancels fortifications on the walls queue', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 1);
      await training.train(g, p.id, p.cityId, FortType.TRAP, 3, WALLS_QUEUE);
      await training.cancelTraining(g, p.id, p.cityId, WALLS_QUEUE, 1);
      expect((await reloadCity(g, p.cityId)).fortQueue).toEqual({ queue: [], nextQueueId: 2 });
      expect(g.pushes(PushCmd.FORTIFICATIONS_QUEUE_UPDATE).at(-1)?.data).toMatchObject({ allProduceQueue: [] });
    }));

  it('refuses a batch that is not there', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1, 1]);
      await training.train(g, p.id, p.cityId, WORKER, 1, 0);
      await expectRefused(training.cancelTraining(g, p.id, p.cityId, 0, 9), msg('training.batchNotFound'));
      await expectRefused(training.cancelTraining(g, p.id, p.cityId, 1, 1), msg('training.batchNotFound'));
    }));
});

describe(training.speedupTraining.name, () => {
  it("Napoleon's Diary cuts the batch in progress by a share of its full time", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await giveItems(g, p, { [ItemId.NAPOLEONS_DIARY]: 2 });
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      const [head] = await queueOf(g, p, 0);
      const cut = Math.floor((head.endTime - head.startTime) * BALANCE.items.batchSpeedupShare);
      await training.speedupTraining(g, p.id, p.cityId, 0, 1);

      expect((await queueOf(g, p, 0))[0]).toMatchObject({ startTime: head.startTime - cut, endTime: head.endTime - cut });
      expect((await reloadPlayer(g, p)).items[ItemId.NAPOLEONS_DIARY]).toBe(1);
      expect(g.events('train')[0].dueAt).toBe(head.endTime - cut);
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)?.data).toEqual({ items: [{ id: ItemId.NAPOLEONS_DIARY, count: 1 }] });
    }));

  it('without the item it is bought with the city gold, and refused without enough', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      const price = itemGoldPrice(ItemId.NAPOLEONS_DIARY)!;
      await setResources(g, p, { gold: price });
      await training.speedupTraining(g, p.id, p.cityId, 0, 1);
      expect((await reloadCity(g, p.cityId)).gold).toBe(0);
      await expectRefused(training.speedupTraining(g, p.id, p.cityId, 0, 1), msg('common.notEnoughGoldFor', { amount: price }));
    }));

  it('four speed-ups finish a batch: it completes straight away', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await giveItems(g, p, { [ItemId.NAPOLEONS_DIARY]: 4 });
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      for (let i = 0; i < 4; i++) await training.speedupTraining(g, p.id, p.cityId, 0, 1);
      expect((await queueOf(g, p, 0))[0].endTime).toBe(g.now);
      expect(await g.runDue()).toBe(1);
      expect((await reloadCity(g, p.cityId)).troops.peasants).toBe(10);
    }));

  it('a waiting batch gets shorter, and starts part way through', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [2]);
      await giveItems(g, p, { [ItemId.NAPOLEONS_DIARY]: 1 });
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      await training.train(g, p.id, p.cityId, WARRIOR, 10, 0);
      const full = await batchMs(g, p, WARRIOR, 10);
      const cut = Math.floor(full * BALANCE.items.batchSpeedupShare);
      await training.speedupTraining(g, p.id, p.cityId, 0, 2);
      expect((await queueOf(g, p, 0))[1]).toMatchObject({ costTime: full - cut, fullTime: full, startTime: 0, endTime: 0 });

      const end1 = g.events('train')[0].dueAt;
      await g.runDue(end1);
      expect((await queueOf(g, p, 0))[0]).toMatchObject({ queueId: 2, startTime: end1 - cut, endTime: end1 + full - cut });
    }));

  it("fortifications use Archimedes' Note", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 1);
      await giveItems(g, p, { [ItemId.ARCHIMEDES_NOTE]: 1, [ItemId.NAPOLEONS_DIARY]: 1 });
      await training.train(g, p.id, p.cityId, FortType.TRAP, 10, WALLS_QUEUE);
      await training.speedupTraining(g, p.id, p.cityId, WALLS_QUEUE, 1);
      const { items } = await reloadPlayer(g, p);
      expect(items[ItemId.ARCHIMEDES_NOTE] ?? 0).toBe(0);
      expect(items[ItemId.NAPOLEONS_DIARY]).toBe(1);
      expect(g.pushes(PushCmd.FORTIFICATIONS_QUEUE_UPDATE).length).toBeGreaterThan(1);
    }));

  it('refuses a batch that is not there, without using the item', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await giveItems(g, p, { [ItemId.NAPOLEONS_DIARY]: 1 });
      await expectRefused(training.speedupTraining(g, p.id, p.cityId, 0, 1), msg('training.batchNotFound'));
      expect((await reloadPlayer(g, p)).items[ItemId.NAPOLEONS_DIARY]).toBe(1);
    }));
});

describe(training.disbandTroops.name, () => {
  it('returns the troops to the population, up to its maximum', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[20, BuildingType.COTTAGE, 1]]);
      await setCityStats(g, p, { troops: { peasants: 20 } });
      const before = await reloadCity(g, p.cityId);
      const max = BALANCE.basePopulation + BALANCE.cottagePopulation[1];
      await training.disbandTroops(g, p.id, p.cityId, WORKER, 5);
      let city = await reloadCity(g, p.cityId);
      expect(city.troops.peasants).toBe(15);
      expect(city.population).toBe(Math.min(max, before.population + 5));
      // troops with no refund credit (never trained here) refund nothing
      expectResources(resourcesOf(city), resourcesOf(before));
      expect(g.pushes(PushCmd.TROOP_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, troop: { peasants: 15 } });

      await setCityStats(g, p, { population: max - 2 });
      await training.disbandTroops(g, p.id, p.cityId, WORKER, 15);
      city = await reloadCity(g, p.cityId);
      expect(city.troops.peasants ?? 0).toBe(0);
      expect(city.population).toBe(max);
    }));

  it('refunds BALANCE.disbandRefund of what discounted training paid, out of the refund credit', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withBarracks(g, p, [1]);
      await giveItems(g, p, { [ItemId.QUARTERMASTERS_SEAL]: 1 });
      await shop.useItem(g, p.id, ItemId.QUARTERMASTERS_SEAL, null);
      const share = 1 - BALANCE.trainCostReduction;
      await training.train(g, p.id, p.cityId, WORKER, 10, 0);
      await g.runDue(g.events('train')[0].dueAt);
      expect((await reloadPlayer(g, p)).misc.refundCredit).toEqual({ peasants: 10 * share });

      const before = await reloadCity(g, p.cityId);
      await training.disbandTroops(g, p.id, p.cityId, WORKER, 10);
      const { refund } = disbandRefund(WORKER, 10, 10 * share);
      expect(refund.food).toBeGreaterThan(0);
      expectResources(resourcesOf(await reloadCity(g, p.cityId)), minus(resourcesOf(before), refund, -1));
      for (const k of RESOURCE_KEYS) expect(refund[k]).toBeLessThanOrEqual(trainCost(WORKER, 10, share)[k] * BALANCE.disbandRefund);
      expect((await reloadPlayer(g, p)).misc.refundCredit).toEqual({});
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('refunds only as many units as the credit covers, and uses it up', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { peasants: 20, militia: 5 } });
      const player = await reloadPlayer(g, p);
      player.misc = { ...player.misc, refundCredit: { peasants: 6, militia: 5 } };
      await savePlayer(g, player);
      const before = await reloadCity(g, p.cityId);
      await training.disbandTroops(g, p.id, p.cityId, WORKER, 4);
      await training.disbandTroops(g, p.id, p.cityId, WORKER, 4);
      expect((await reloadPlayer(g, p)).misc.refundCredit).toEqual({ militia: 5 });
      const refunded = disbandRefund(WORKER, 6, 6).refund;
      expectResources(resourcesOf(await reloadCity(g, p.cityId)), minus(resourcesOf(before), refunded, -1));
    }));

  it('refuses a bad type, a bad count and more than the city has', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { peasants: 2 } });
      await expectRefused(training.disbandTroops(g, p.id, p.cityId, FortType.TRAP, 1), msg('common.invalidTroopType'));
      await expectRefused(training.disbandTroops(g, p.id, p.cityId, WORKER, 0), msg('common.invalidTroopCount'));
      await expectRefused(training.disbandTroops(g, p.id, p.cityId, WORKER, 1.5), msg('common.invalidTroopCount'));
      await expectRefused(training.disbandTroops(g, p.id, p.cityId, WORKER, 3), msg('training.notEnoughUnits', { unit: ref.troop(WORKER) }));
    }));
});

describe(training.destroyForts.name, () => {
  it('removes fortifications from the walls', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.forts = { trap: 10, abatis: 2 }));
      await training.destroyForts(g, p.id, p.cityId, FortType.TRAP, 4);
      expect((await reloadCity(g, p.cityId)).forts).toEqual({ trap: 6, abatis: 2 });
      expect(g.pushes(PushCmd.FORTIFICATIONS_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, fortification: { trap: 6, abatis: 2 } });
    }));

  it('refunds trained fortifications like troops', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await withWalls(g, p, 1);
      await training.train(g, p.id, p.cityId, FortType.TRAP, 10, WALLS_QUEUE);
      await g.runDue(g.events('train')[0].dueAt);
      expect((await reloadPlayer(g, p)).misc.refundCredit).toEqual({ trap: 10 });
      const before = await reloadCity(g, p.cityId);
      await training.destroyForts(g, p.id, p.cityId, FortType.TRAP, 4);
      expectResources(resourcesOf(await reloadCity(g, p.cityId)), minus(resourcesOf(before), disbandRefund(FortType.TRAP, 4, 10).refund, -1));
      expect((await reloadPlayer(g, p)).misc.refundCredit).toEqual({ trap: 6 });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('refuses a bad type, a bad count and more than the walls hold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.forts = { trap: 1 }));
      await expectRefused(training.destroyForts(g, p.id, p.cityId, WORKER, 1), msg('training.invalidFort'));
      await expectRefused(training.destroyForts(g, p.id, p.cityId, FortType.TRAP, 0), msg('common.invalidAmount'));
      await expectRefused(training.destroyForts(g, p.id, p.cityId, FortType.TRAP, 2), msg('training.notEnoughUnits', { unit: ref.troop(FortType.TRAP) }));
    }));
});

describe(training.cureInjured.name, () => {
  it('heals for a share of the training cost', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => {
        c.injuredTroops = INJURED;
        c.troops = { peasants: 1 };
      });
      const before = await reloadCity(g, p.cityId);
      await training.cureInjured(g, p.id, p.cityId, { peasants: 6, militia: 4 });
      const city = await reloadCity(g, p.cityId);
      expect(city.injuredTroops).toEqual({ peasants: 4 });
      expect(city.troops).toEqual({ peasants: 7, militia: 4 });
      expectResources(resourcesOf(city), minus(resourcesOf(before), healCost({ peasants: 6, militia: 4 })));
      expect(g.pushes(PushCmd.TROOP_UPDATE).at(-1)?.data.troop).toMatchObject({ peasants: 7, militia: 4 });
      expect(g.pushes(PushCmd.INJURED_TROOP_UPDATE).at(-1)?.data.troop).toMatchObject({ peasants: 4, militia: 0 });
    }));

  it('or for honor, leaving the resources alone', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.injuredTroops = INJURED));
      const honor = healHonorCost(INJURED);
      const player = await reloadPlayer(g, p);
      player.honor = honor + 5;
      await savePlayer(g, player);
      const before = await reloadCity(g, p.cityId);
      await training.cureInjured(g, p.id, p.cityId, INJURED, 'honor');
      expect((await reloadPlayer(g, p)).honor).toBe(5);
      const city = await reloadCity(g, p.cityId);
      expectResources(resourcesOf(city), resourcesOf(before));
      expect(city.troops).toEqual(INJURED);
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE)).toHaveLength(1);
    }));

  it('refuses without the honor or the resources', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.injuredTroops = INJURED));
      await expectRefused(training.cureInjured(g, p.id, p.cityId, INJURED, 'honor'), msg('training.notEnoughHonor', { amount: healHonorCost(INJURED) }));
      await setResources(g, p, { food: 0 });
      await expectRefused(training.cureInjured(g, p.id, p.cityId, INJURED), msg('common.notEnoughResources'));
      expect((await reloadCity(g, p.cityId)).injuredTroops).toEqual(INJURED);
    }));

  it('refuses bad counts and more than are injured', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.injuredTroops = INJURED));
      await expectRefused(training.cureInjured(g, p.id, p.cityId, { peasants: -1 }), msg('common.invalidTroopCount'));
      await expectRefused(training.cureInjured(g, p.id, p.cityId, { peasants: 1.5 }), msg('common.invalidTroopCount'));
      await expectRefused(training.cureInjured(g, p.id, p.cityId, { peasants: 11 }), msg('training.notEnoughInjured'));
      await expectRefused(training.cureInjured(g, p.id, p.cityId, { scouter: 1 }), msg('training.notEnoughInjured'));
    }));
});

describe(training.disbandInjured.name, () => {
  it('dismisses injured troops', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.injuredTroops = INJURED));
      const before = await reloadCity(g, p.cityId);
      await training.disbandInjured(g, p.id, p.cityId, { peasants: 10, militia: 1 });
      const city = await reloadCity(g, p.cityId);
      expect(city.injuredTroops).toEqual({ militia: 3 });
      expect(city.troops).toEqual(before.troops);
      expect(city.population).toBe(before.population);
      expect(g.pushes(PushCmd.INJURED_TROOP_UPDATE).at(-1)?.data.troop).toMatchObject({ peasants: 0, militia: 3 });
    }));

  it('refuses bad counts and more than are injured', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await editCity(g, p, (c) => (c.injuredTroops = INJURED));
      await expectRefused(training.disbandInjured(g, p.id, p.cityId, { militia: -2 }), msg('common.invalidTroopCount'));
      await expectRefused(training.disbandInjured(g, p.id, p.cityId, { militia: 5 }), msg('training.notEnoughInjured'));
    }));
});
