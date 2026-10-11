import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  BuildingStatus,
  BuildingType,
  buildCost,
  buildingHeroExp,
  buildingMaxLevel,
  buildTimeMs,
  dur,
  fullDemolishRefund,
  goldForSpeedup,
  ItemId,
  MINUTE,
  msg,
  prestigeOf,
  PrestigeAction,
  ref,
  RESOURCE_KEYS,
  scaled,
  SpeedupId,
  speedupItemGold,
  TechType,
  TroopType,
  unlockedOuterSlots,
  type Resources,
} from '@marchlands/core';
import { PushCmd } from '@marchlands/contracts';
import { buildings, getHero, heroes, heroesOfCity, mayorStats, shop, training } from '../../src/index.ts';
import { expectRefused } from '../support/expect.ts';
import {
  addHero,
  cityBundle,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setCityStats,
  setResearch,
  setResources,
  setTownHall,
  type TestPlayer,
} from '../support/factories.ts';
import { game, T0, type TestGame } from '../support/game.ts';

const { COTTAGE, WAREHOUSE, FARM, MARKETPLACE, ACADEMY, BARRACKS, RALLY_SPOT, INN, TOWN_HALL, WALLS } = BuildingType;
const GONE = { typeId: 0, level: 0, status: 0, startTime: 0, endTime: 0 };

const res = (c: Resources): Resources => ({ gold: c.gold, food: c.food, wood: c.wood, stone: c.stone, iron: c.iron });
const plus = (a: Resources, b: Partial<Resources>, mult = 1): Resources =>
  Object.fromEntries(RESOURCE_KEYS.map((k) => [k, a[k] + (b[k] ?? 0) * mult])) as Resources;
const minus = (a: Resources, b: Partial<Resources>): Resources => Object.fromEntries(RESOURCE_KEYS.map((k) => [k, a[k] - (b[k] ?? 0)])) as Resources;

/** The city's resources settled to now (what the next service call starts from). */
const stock = async (g: TestGame, p: TestPlayer) => res((await cityBundle(g, p)).city);
/** The city's resources as stored. */
const stored = async (g: TestGame, p: TestPlayer) => res(await reloadCity(g, p.cityId));
const buildingAt = async (g: TestGame, p: TestPlayer, pos: number) => (await reloadCity(g, p.cityId)).buildings.find((b) => b.positionId === pos);

/** A hired hero appointed mayor of the player's city; returns its id. */
async function appointMayor(g: TestGame, p: TestPlayer) {
  const id = await addHero(g, p, 5);
  await heroes.appointMayor(g, p.id, id);
  return id;
}

describe(buildings.construct.name, () => {
  it('starts a level-0 building, pays its cost and schedules its completion', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = await stock(g, p);
      const bean = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);

      const end = T0 + buildTimeMs(COTTAGE, 1, null, {});
      const expected = { positionId: 0, typeId: COTTAGE, level: 0, status: BuildingStatus.BUILDING, startTime: T0, endTime: end };
      expect(bean).toEqual(expected);
      expect(await buildingAt(g, p, 0)).toEqual(expected);
      expect(await stored(g, p)).toEqual(minus(before, buildCost(COTTAGE, 1)));
      expect(g.events('building')).toEqual([
        { type: 'building', dueAt: end, playerId: p.id, cityId: p.cityId, refKey: `building:${p.cityId}:0`, payload: { positionId: 0 } },
      ]);
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId, buildingBean: expected } });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)).toMatchObject({ playerIds: [p.id], data: { castleId: p.cityId } });
    }));

  it('builds fields outside the walls, in the slots the Town Hall unlocks', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const last = 1000 + unlockedOuterSlots(1);
      expect(await buildings.construct(g, p.id, p.cityId, FARM, last)).toMatchObject({ positionId: last, typeId: FARM, level: 0 });
      await expectRefused(buildings.construct(g, p.id, p.cityId, FARM, last + 1), msg('building.slotLocked'));
    }));

  it('Construction research and the mayor shorten the build', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResearch(g, p, TechType.CONSTRUCTION, 3);
      await appointMayor(g, p);
      const b = await cityBundle(g, p);
      const bean = await buildings.construct(g, p.id, p.cityId, WAREHOUSE, 0);
      const ms = buildTimeMs(WAREHOUSE, 1, mayorStats(b.heroes), b.player.research);
      expect(bean.endTime - bean.startTime).toBe(ms);
      expect(ms).toBeLessThan(buildTimeMs(WAREHOUSE, 1, null, {}));
    }));

  it('refuses bad positions and building types', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(buildings.construct(g, p.id, p.cityId, COTTAGE, 50), msg('building.invalidPosition'));
      await expectRefused(buildings.construct(g, p.id, p.cityId, 999, 0), msg('building.cannotBuild'));
      await expectRefused(buildings.construct(g, p.id, p.cityId, BuildingType.TRAP, 0), msg('building.cannotBuild'));
      await expectRefused(buildings.construct(g, p.id, p.cityId, FARM, 0), msg('building.cannotBuildHere', { building: ref.building(FARM) }));
      await expectRefused(buildings.construct(g, p.id, p.cityId, COTTAGE, 1001), msg('building.cannotBuildHere', { building: ref.building(COTTAGE) }));
      await expectRefused(buildings.construct(g, p.id, p.cityId, TOWN_HALL, -1), msg('building.positionTaken'));
      expect(g.events('building')).toEqual([]);
    }));

  it('refuses a second building of a limited type', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, MARKETPLACE, 1]]);
      await expectRefused(buildings.construct(g, p.id, p.cityId, MARKETPLACE, 1), msg('building.limitReached', { building: ref.building(MARKETPLACE) }));
    }));

  it('refuses unmet requirements, then allows them once met', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(buildings.construct(g, p.id, p.cityId, ACADEMY, 0), msg('building.requirementsNotMet'));
      await setTownHall(g, p, 2);
      expect(await buildings.construct(g, p.id, p.cityId, ACADEMY, 0)).toMatchObject({ typeId: ACADEMY });
    }));

  it('refuses when the city cannot pay', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResources(g, p, { food: 0, wood: 0, stone: 0, iron: 0 });
      await expectRefused(buildings.construct(g, p.id, p.cityId, COTTAGE, 0), msg('common.notEnoughResources'));
      expect(await buildingAt(g, p, 0)).toBeUndefined();
    }));

  it('runs BALANCE.buildQueues constructions at once; Bernini’s Hammer adds one more', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (let i = 0; i < BALANCE.buildQueues; i++) await buildings.construct(g, p.id, p.cityId, COTTAGE, i);
      await expectRefused(buildings.construct(g, p.id, p.cityId, COTTAGE, 10), msg('building.queuesBusy'));

      await giveItems(g, p, { [ItemId.BERNINIS_HAMMER]: 1 });
      await shop.useItem(g, p.id, ItemId.BERNINIS_HAMMER, null);
      await buildings.construct(g, p.id, p.cityId, COTTAGE, 10);
      await expectRefused(buildings.construct(g, p.id, p.cityId, COTTAGE, 11), msg('building.queuesBusy'));
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(buildings.construct(g, a.id, b.cityId, COTTAGE, 0), msg('common.invalidCastle'));
    }));
});

describe(buildings.upgrade.name, () => {
  it('upgrades an idle building to the next level, paying that level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, COTTAGE, 1]]);
      const before = await stock(g, p);
      const bean = await buildings.upgrade(g, p.id, p.cityId, 0);

      const end = T0 + buildTimeMs(COTTAGE, 2, null, {});
      const expected = { positionId: 0, typeId: COTTAGE, level: 1, status: BuildingStatus.BUILDING, startTime: T0, endTime: end };
      expect(bean).toEqual(expected);
      expect(await buildingAt(g, p, 0)).toEqual(expected);
      expect(await stored(g, p)).toEqual(minus(before, buildCost(COTTAGE, 2)));
      expect(g.events('building')).toMatchObject([{ dueAt: end, cityId: p.cityId, payload: { positionId: 0 } }]);
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)?.data).toEqual({ castleId: p.cityId, buildingBean: expected });
    }));

  it('completes through its timed event', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const bean = await buildings.upgrade(g, p.id, p.cityId, -1);
      expect(await g.runDue(bean.endTime)).toBe(1);
      expect(await buildingAt(g, p, -1)).toEqual({ positionId: -1, typeId: TOWN_HALL, level: 2, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 });
    }));

  it('refuses a missing, busy or maxed building', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, 0), msg('building.notFound'));
      await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, 0), msg('building.statusChanged'));
      await setBuildings(g, p, [[1, WAREHOUSE, buildingMaxLevel(WAREHOUSE)]]);
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, 1), msg('building.maxLevel', { building: ref.building(WAREHOUSE) }));
    }));

  it('refuses when every queue is busy', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (let i = 0; i < BALANCE.buildQueues; i++) await buildings.construct(g, p.id, p.cityId, COTTAGE, i);
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, -1), msg('building.queuesBusy'));
    }));

  it('refuses unmet requirements and a city that cannot pay', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, BARRACKS, 1]]); // the next level needs a Rally Spot
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, 0), msg('building.requirementsNotMet'));
      await setResources(g, p, { food: 0, wood: 0, stone: 0, iron: 0 });
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, -1), msg('common.notEnoughResources'));
      expect(await buildingAt(g, p, -1)).toMatchObject({ level: 1, status: BuildingStatus.IDLE });
    }));
});

describe(buildings.demolish.name, () => {
  it('removes the whole building at once, refunding a share of every level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, COTTAGE, 3]]);
      const before = await stock(g, p);
      const bean = await buildings.demolish(g, p.id, p.cityId, 0);
      expect(bean).toEqual({ positionId: 0, ...GONE });
      expect(await buildingAt(g, p, 0)).toBeUndefined();
      expect(await stored(g, p)).toEqual(plus(before, fullDemolishRefund(COTTAGE, 3)));
      expect(g.events()).toEqual([]);
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)?.data).toEqual({ castleId: p.cityId, buildingBean: { positionId: 0, ...GONE } });
    }));

  it('a demolished Barracks takes its training queue with it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [
        [0, BARRACKS, 1],
        [1, BARRACKS, 1],
        [2, RALLY_SPOT, 1],
      ]);
      await setCityStats(g, p, { population: 1000 });
      await training.train(g, p.id, p.cityId, TroopType.WORKER, 1, 0);
      await training.train(g, p.id, p.cityId, TroopType.WORKER, 1, 1);
      expect((await reloadCity(g, p.cityId)).troopQueues.map((q) => q.positionId).sort()).toEqual([0, 1]);
      await buildings.demolish(g, p.id, p.cityId, 0);
      expect((await reloadCity(g, p.cityId)).troopQueues.map((q) => q.positionId)).toEqual([1]);
    }));

  it('refuses an empty or unfinished position, a busy building, the Town Hall and the Walls', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(buildings.demolish(g, p.id, p.cityId, 0), msg('building.nothingToDemolish'));
      await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      await expectRefused(buildings.demolish(g, p.id, p.cityId, 0), msg('building.nothingToDemolish'));
      await setBuildings(g, p, [
        [1, COTTAGE, 1],
        [-2, WALLS, 1],
      ]);
      await buildings.upgrade(g, p.id, p.cityId, 1);
      await expectRefused(buildings.demolish(g, p.id, p.cityId, 1), msg('building.busy'));
      await expectRefused(buildings.demolish(g, p.id, p.cityId, -1), msg('building.cannotDemolish', { building: ref.building(TOWN_HALL) }));
      await expectRefused(buildings.demolish(g, p.id, p.cityId, -2), msg('building.cannotDemolish', { building: ref.building(WALLS) }));
    }));
});

describe(buildings.cancel.name, () => {
  it('cancelling a new building removes it and refunds its cost in full', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = await stock(g, p);
      await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      g.advance(10_000);
      const settled = await stock(g, p);
      await buildings.cancel(g, p.id, p.cityId, 0);
      expect(await buildingAt(g, p, 0)).toBeUndefined();
      expect(await stored(g, p)).toEqual(plus(settled, buildCost(COTTAGE, 1), BALANCE.cancelBuildRefund));
      expect(settled.wood).toBeLessThan(before.wood);
      expect(g.events('building')).toEqual([]);
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)?.data).toEqual({ castleId: p.cityId, buildingBean: { positionId: 0, ...GONE } });
    }));

  it('cancelling an upgrade keeps the current level and refunds the next', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, COTTAGE, 1]]);
      await buildings.upgrade(g, p.id, p.cityId, 0);
      const before = await stock(g, p);
      await buildings.cancel(g, p.id, p.cityId, 0);
      const idle = { positionId: 0, typeId: COTTAGE, level: 1, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 };
      expect(await buildingAt(g, p, 0)).toEqual(idle);
      expect(await stored(g, p)).toEqual(plus(before, buildCost(COTTAGE, 2), BALANCE.cancelBuildRefund));
      expect(g.events('building')).toEqual([]);
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)?.data).toEqual({ castleId: p.cityId, buildingBean: idle });
    }));

  it('refuses where nothing is in progress', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(buildings.cancel(g, p.id, p.cityId, 0), msg('building.notInProgress'));
      await expectRefused(buildings.cancel(g, p.id, p.cityId, -1), msg('building.notInProgress'));
    }));
});

describe(buildings.speedup.name, () => {
  it('the free speed-up finishes a job in its last minutes', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      expect(built.endTime - T0).toBeLessThanOrEqual(scaled(BALANCE.freeSpeedupMs));
      g.advance(5_000);
      const bean = await buildings.speedup(g, p.id, p.cityId, 0, SpeedupId.FREE);
      expect(bean).toMatchObject({ endTime: g.now, startTime: built.startTime - (built.endTime - g.now), status: BuildingStatus.BUILDING });
      expect(g.events('building')).toMatchObject([{ dueAt: g.now }]);
      await g.runDue();
      expect(await buildingAt(g, p, 0)).toMatchObject({ level: 1, status: BuildingStatus.IDLE });
    }));

  it('refuses the free speed-up earlier, and allows it once that close', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.construct(g, p.id, p.cityId, WAREHOUSE, 0);
      const freeMs = scaled(BALANCE.freeSpeedupMs);
      expect(built.endTime - T0).toBeGreaterThan(freeMs);
      await expectRefused(buildings.speedup(g, p.id, p.cityId, 0, SpeedupId.FREE), msg('common.freeSpeedupTooEarly', { time: dur(freeMs) }));
      g.advance(built.endTime - freeMs - T0);
      expect(await buildings.speedup(g, p.id, p.cityId, 0, SpeedupId.FREE)).toMatchObject({ endTime: g.now });
    }));

  it('gold finishes the job at once for the time left', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setResources(g, p, { gold: 10_000_000 });
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      g.advance(60_000);
      const before = await stock(g, p);
      const bean = await buildings.speedup(g, p.id, p.cityId, -1, SpeedupId.GOLD);
      expect(bean).toMatchObject({ startTime: built.startTime - (built.endTime - g.now), endTime: g.now });
      expect(await stored(g, p)).toEqual({ ...before, gold: before.gold - goldForSpeedup(built.endTime - g.now) });
      await g.runDue();
      expect(await buildingAt(g, p, -1)).toMatchObject({ level: 2, status: BuildingStatus.IDLE });
    }));

  it('refuses gold the city does not have', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      await setResources(g, p, { gold: 0 });
      await expectRefused(
        buildings.speedup(g, p.id, p.cityId, -1, SpeedupId.GOLD),
        msg('common.notEnoughGoldFor', { amount: goldForSpeedup(built.endTime - g.now) }),
      );
      expect(await buildingAt(g, p, -1)).toMatchObject({ endTime: built.endTime });
    }));

  it('an owned guideline is used up and cuts its time; the job keeps its length', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.BEGINNER_GUIDELINES]: 1 });
      const before = (await reloadPlayer(g, p)).items[ItemId.BEGINNER_GUIDELINES];
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      const cut = BALANCE.items.speedups[ItemId.BEGINNER_GUIDELINES].cutMs!;
      expect(built.endTime - built.startTime).toBeGreaterThan(cut);
      const gold = (await stock(g, p)).gold;
      const bean = await buildings.speedup(g, p.id, p.cityId, -1, ItemId.BEGINNER_GUIDELINES);
      expect(bean).toMatchObject({ startTime: built.startTime - cut, endTime: built.endTime - cut });
      expect((await reloadPlayer(g, p)).items[ItemId.BEGINNER_GUIDELINES] ?? 0).toBe(before - 1);
      expect((await stored(g, p)).gold).toBe(gold);
      expect(g.events('building')).toMatchObject([{ dueAt: built.endTime - cut }]);
      expect(g.pushes(PushCmd.ITEM_UPDATE).at(-1)?.data).toEqual({ items: [{ id: ItemId.BEGINNER_GUIDELINES, count: before - 1 }] });
    }));

  it('an item the player lacks is bought with city gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      const before = await stock(g, p);
      await buildings.speedup(g, p.id, p.cityId, -1, ItemId.BEGINNER_GUIDELINES);
      expect((await stored(g, p)).gold).toBe(before.gold - speedupItemGold(ItemId.BEGINNER_GUIDELINES));
      expect(await buildingAt(g, p, -1)).toMatchObject({ endTime: built.endTime - BALANCE.items.speedups[ItemId.BEGINNER_GUIDELINES].cutMs! });
      await setResources(g, p, { gold: 0 });
      await expectRefused(
        buildings.speedup(g, p.id, p.cityId, -1, ItemId.BEGINNER_GUIDELINES),
        msg('common.notEnoughGoldFor', { amount: speedupItemGold(ItemId.BEGINNER_GUIDELINES) }),
      );
    }));

  it('a share speed-up always cuts a share of the full time', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.ULTIMATE_GUIDELINES]: 2 });
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      const total = built.endTime - built.startTime;
      const cut = scaled(total * BALANCE.items.speedups[ItemId.ULTIMATE_GUIDELINES].cutShare!);
      const once = await buildings.speedup(g, p.id, p.cityId, -1, ItemId.ULTIMATE_GUIDELINES);
      expect(once).toMatchObject({ endTime: built.endTime - cut, startTime: built.startTime - cut });
      const twice = await buildings.speedup(g, p.id, p.cityId, -1, ItemId.ULTIMATE_GUIDELINES);
      expect(twice).toMatchObject({ endTime: built.endTime - 2 * cut });
      expect(twice.endTime - twice.startTime).toBe(total);
    }));

  it('never ends a job before now', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.SENIOR_GUIDELINES]: 1 });
      const built = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      const bean = await buildings.speedup(g, p.id, p.cityId, 0, ItemId.SENIOR_GUIDELINES);
      expect(bean).toMatchObject({ endTime: g.now, startTime: built.startTime - (built.endTime - g.now) });
    }));

  it('refuses an unknown speed-up and a building not in progress', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(buildings.speedup(g, p.id, p.cityId, -1, SpeedupId.FREE), msg('building.notInProgress'));
      await expectRefused(buildings.speedup(g, p.id, p.cityId, 0, SpeedupId.FREE), msg('building.notInProgress'));
      await buildings.upgrade(g, p.id, p.cityId, -1);
      await expectRefused(buildings.speedup(g, p.id, p.cityId, -1, 'no.such.item'), msg('common.invalidSpeedup'));
    }));
});

describe(buildings.speedupCost.name, () => {
  it('prices finishing now in gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      expect(await buildings.speedupCost(g, p.id, p.cityId, -1)).toEqual({ goldNeed: goldForSpeedup(built.endTime - T0), timeLeft: built.endTime - T0 });
      g.advance(10 * MINUTE);
      expect(await buildings.speedupCost(g, p.id, p.cityId, -1)).toEqual({ goldNeed: goldForSpeedup(built.endTime - g.now), timeLeft: built.endTime - g.now });
    }));

  it('refuses a building not in progress, one already past its end, and a foreign city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      await expectRefused(buildings.speedupCost(g, p.id, p.cityId, 0), msg('building.notInProgress'));
      await expectRefused(buildings.speedupCost(g, p.id, p.cityId, -1), msg('building.notInProgress'));
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      await expectRefused(buildings.speedupCost(g, other.id, p.cityId, -1), msg('common.invalidCastle'));
      g.advance(built.endTime - T0 + 1);
      await expectRefused(buildings.speedupCost(g, p.id, p.cityId, -1), msg('building.notInProgress'));
    }));
});

describe(buildings.availableBuildings.name, () => {
  it('lists the buildings that may go inside, with their cost, time and requirements', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const out = await buildings.availableBuildings(g, p.id, p.cityId, 'inside');
      const types = out.buildings.map((b) => b!.typeId);
      expect(types).toContain(COTTAGE);
      expect(types).toContain(ACADEMY);
      for (const t of [TOWN_HALL, WALLS, FARM, BuildingType.TRAP]) expect(types).not.toContain(t);
      expect(out.unlockedOuterSlots).toBe(unlockedOuterSlots(1));

      const cottage = out.buildings.find((b) => b!.typeId === COTTAGE)!;
      expect(cottage).toMatchObject({ level: 1, time: Math.ceil(buildTimeMs(COTTAGE, 1, null, {}) / 1000), ok: true });
      expect(cottage).toMatchObject(buildCost(COTTAGE, 1));
      const academy = out.buildings.find((b) => b!.typeId === ACADEMY)!;
      expect(academy.ok).toBe(false);
      expect(academy.requirements).toEqual([{ kind: 'building', id: TOWN_HALL, required: 2, current: 1, ok: false }]);
    }));

  it('lists only fields outside, and only the Walls for the walls', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const outside = await buildings.availableBuildings(g, p.id, p.cityId, 'outside');
      expect(outside.buildings.map((b) => b!.typeId).sort((x, y) => x - y)).toEqual(
        [FARM, BuildingType.SAWMILL, BuildingType.QUARRY, BuildingType.IRONMINE].sort((x, y) => x - y),
      );
      const walls = await buildings.availableBuildings(g, p.id, p.cityId, 'walls');
      expect(walls.buildings.map((b) => b!.typeId)).toEqual([WALLS]);
    }));

  it('leaves out a limited building the city already has', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, MARKETPLACE, 1]]);
      const out = await buildings.availableBuildings(g, p.id, p.cityId, 'inside');
      expect(out.buildings.map((b) => b!.typeId)).not.toContain(MARKETPLACE);
      expect(out.buildings.map((b) => b!.typeId)).toContain(COTTAGE);
    }));

  it("refuses another player's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(buildings.availableBuildings(g, a.id, b.cityId, 'inside'), msg('common.invalidCastle'));
    }));
});

describe(buildings.upgradeInfo.name, () => {
  it('shows the next level and what demolishing returns', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, COTTAGE, 2]]);
      const info = await buildings.upgradeInfo(g, p.id, p.cityId, 0);
      expect(info).toMatchObject({
        building: { positionId: 0, typeId: COTTAGE, level: 2, status: BuildingStatus.IDLE },
        maxLevel: buildingMaxLevel(COTTAGE),
        demolishRefund: fullDemolishRefund(COTTAGE, 2),
      });
      // level 3 needs Town Hall 2
      expect(info.next).toMatchObject({
        typeId: COTTAGE,
        level: 3,
        time: Math.ceil(buildTimeMs(COTTAGE, 3, null, {}) / 1000),
        ok: false,
        requirements: [{ kind: 'building', id: TOWN_HALL, required: 2, current: 1, ok: false }],
        ...buildCost(COTTAGE, 3),
      });
      await setTownHall(g, p, 2);
      expect((await buildings.upgradeInfo(g, p.id, p.cityId, 0)).next).toMatchObject({ ok: true });
    }));

  it('has no next level at the top', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[0, COTTAGE, buildingMaxLevel(COTTAGE)]]);
      expect((await buildings.upgradeInfo(g, p.id, p.cityId, 0)).next).toBeNull();
    }));

  it('refuses a missing building and a foreign city', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(buildings.upgradeInfo(g, a.id, a.cityId, 0), msg('building.notFound'));
      await expectRefused(buildings.upgradeInfo(g, a.id, b.cityId, -1), msg('common.invalidCastle'));
    }));
});

describe(buildings.completeBuilding.name, () => {
  it('raises the level, awards prestige and tells the player', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const prestige = (await reloadPlayer(g, p)).prestige;
      const built = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      await g.runDue(built.endTime);
      const done = { positionId: 0, typeId: COTTAGE, level: 1, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 };
      expect(await buildingAt(g, p, 0)).toEqual(done);
      expect((await reloadPlayer(g, p)).prestige).toBe(prestige + prestigeOf(PrestigeAction.BUILDING, COTTAGE, 1, 1));
      expect(g.pushes(PushCmd.BUILD_COMPLETE).at(-1)?.data).toEqual({ castleId: p.cityId, buildingBean: done });
      expect(g.pushes(PushCmd.PLAYER_INFO_UPDATE).at(-1)?.playerIds).toEqual([p.id]);
      expect(g.events()).toEqual([]);
    }));

  it('gives the mayor experience', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const mayor = await appointMayor(g, p);
      const exp = (await getHero(g, mayor)).experience;
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      await g.runDue(built.endTime);
      expect((await getHero(g, mayor)).experience).toBeCloseTo(exp + buildingHeroExp(TOWN_HALL, 2, 2), 6);
      expect(g.pushes(PushCmd.HERO_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, hero: { id: mayor }, updateType: 2 });
    }));

  it('a Town Hall reaching the beginner limit ends beginner protection', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect((await reloadPlayer(g, p)).beginner).toBe(true);
      await setTownHall(g, p, BALANCE.beginnerTownHallLevel - 1);
      await setBuildings(g, p, [[-2, WALLS, buildingMaxLevel(WALLS)]]);
      await setResources(g, p, { food: 1e7, wood: 1e7, stone: 1e7, iron: 1e7 });
      const built = await buildings.upgrade(g, p.id, p.cityId, -1);
      await g.runDue(built.endTime);
      expect((await reloadPlayer(g, p)).beginner).toBe(false);
    }));

  it('a finished Inn clears its offers', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [
        [0, INN, 1],
        [1, COTTAGE, 2],
      ]);
      await heroes.tavern(g, p.id, p.cityId);
      expect((await heroesOfCity(g, p.cityId, { tavern: true })).length).toBeGreaterThan(0);
      const built = await buildings.upgrade(g, p.id, p.cityId, 0);
      await g.runDue(built.endTime);
      expect(await heroesOfCity(g, p.cityId, { tavern: true })).toEqual([]);
    }));

  it('a job that is not due yet is left alone and rescheduled', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const built = await buildings.construct(g, p.id, p.cityId, COTTAGE, 0);
      g.unschedule(`building:${p.cityId}:0`);
      await buildings.completeBuilding(g, p.cityId, 0);
      expect(await buildingAt(g, p, 0)).toMatchObject({ level: 0, status: BuildingStatus.BUILDING });
      expect(g.events('building')).toMatchObject([{ dueAt: built.endTime, payload: { positionId: 0 } }]);
    }));

  it('does nothing for an idle building or a missing city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await buildings.completeBuilding(g, p.cityId, -1);
      await buildings.completeBuilding(g, p.cityId, 0);
      await buildings.completeBuilding(g, 2_000_000_000, 0);
      expect(await buildingAt(g, p, -1)).toMatchObject({ level: 1, status: BuildingStatus.IDLE });
      expect(g.pushes(PushCmd.BUILD_COMPLETE)).toEqual([]);
    }));
});
