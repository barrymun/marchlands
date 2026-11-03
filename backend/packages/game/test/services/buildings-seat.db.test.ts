// A held historic city's buildings (docs/features/historical-cities.md, Fields): its fields go up to its own level and no
// further, can be demolished and built back up to it; everything else stops at 10, as in any city.

import { describe, expect, it } from 'vitest';

import { BALANCE, buildingMaxLevel, BuildingStatus, BuildingType, fullDemolishRefund, HISTORIC_LEVELS, type HistoricLevel, msg, ref } from '@marchlands/core';

import { buildings } from '#/index.ts';
import { buildingAt } from '#test/support/buildings.ts';
import { expectRefused } from '#test/support/expect.ts';
import { createTestPlayer, reloadCity, setBuildings, setResources, setTownHall, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { makeSeat } from '#test/support/historic.ts';

const { FARM, SAWMILL, QUARRY, IRONMINE, COTTAGE, BARRACKS, WAREHOUSE } = BuildingType;
const FIELDS = [FARM, SAWMILL, QUARRY, IRONMINE] as const;
const PLENTY = { gold: 1e12, food: 1e12, wood: 1e12, stone: 1e12, iron: 1e12 };
const FIELD = 1001;

/** A player whose city is a held historic city of `level`, with resources for any level and every field slot open. */
async function seat(g: TestGame, level: HistoricLevel | null) {
  const p = await createTestPlayer(g);
  await setTownHall(g, p, 10);
  if (level) await makeSeat(g, p, { level });
  await setResources(g, p, PLENTY);
  return p;
}

/** Upgrade a building and let it finish; its level after. */
async function upgradeDone(g: TestGame, p: TestPlayer, positionId: number) {
  const bean = await buildings.upgrade(g, p.id, p.cityId, positionId);
  await g.runDue(bean.endTime);
  await setResources(g, p, PLENTY);
  return (await buildingAt(g, p, positionId))?.level;
}

const maxed = (typeId: number) => msg('building.maxLevel', { building: ref.building(typeId) });

describe(`${buildings.upgrade.name}: a historic city’s fields`, () => {
  for (const level of HISTORIC_LEVELS)
    it(`raises every field of a level ${level} to ${level}, and no further`, () =>
      game(async (g) => {
        const p = await seat(g, level);
        for (const [i, t] of FIELDS.entries()) {
          await setBuildings(g, p, [[FIELD + i, t, 10]]);
          for (let l = 11; l <= level; l++) expect(await upgradeDone(g, p, FIELD + i)).toBe(l);
          await expectRefused(buildings.upgrade(g, p.id, p.cityId, FIELD + i), maxed(t));
          expect(await buildingAt(g, p, FIELD + i)).toMatchObject({ typeId: t, level, status: BuildingStatus.IDLE });
        }
      }));

  it('refuses a level 15 field in a level 14, a 13 in a 12 and a 17 in a 16', () =>
    game(async (g) => {
      for (const level of [12, 14, 16] as const) {
        const p = await seat(g, level);
        await setBuildings(g, p, [[FIELD, FARM, level]]);
        await expectRefused(buildings.upgrade(g, p.id, p.cityId, FIELD), maxed(FARM));
        // the admin tool can't set one past it either
        await expectRefused(setBuildings(g, p, [[FIELD, FARM, level + 1]]), msg('admin.invalidLevel', { max: level }));
        expect((await buildingAt(g, p, FIELD))?.level).toBe(level);
      }
    }));

  it('keeps an ordinary city’s fields at 10', () =>
    game(async (g) => {
      const p = await seat(g, null);
      for (const [i, t] of FIELDS.entries()) {
        await setBuildings(g, p, [[FIELD + i, t, 10]]);
        await expectRefused(buildings.upgrade(g, p.id, p.cityId, FIELD + i), maxed(t));
      }
    }));

  it('keeps everything but the fields at 10, whatever the city’s level', () =>
    game(async (g) => {
      const p = await seat(g, 18);
      for (const [pos, t] of [
        [0, COTTAGE],
        [1, BARRACKS],
        [2, WAREHOUSE],
      ] as const) {
        await setBuildings(g, p, [[pos, t, 10]]);
        await expectRefused(buildings.upgrade(g, p.id, p.cityId, pos), maxed(t));
      }
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, -1), maxed(BuildingType.TOWN_HALL));
    }));

  it('shows the city’s own level as the field’s highest, with no next level once there', () =>
    game(async (g) => {
      const p = await seat(g, 14);
      await setBuildings(g, p, [
        [FIELD, SAWMILL, 13],
        [0, COTTAGE, 9],
      ]);
      expect(await buildings.upgradeInfo(g, p.id, p.cityId, FIELD)).toMatchObject({ maxLevel: 14, next: { typeId: SAWMILL, level: 14 } });
      expect(await buildings.upgradeInfo(g, p.id, p.cityId, 0)).toMatchObject({ maxLevel: 10 });
      await upgradeDone(g, p, FIELD);
      expect(await buildings.upgradeInfo(g, p.id, p.cityId, FIELD)).toMatchObject({ maxLevel: 14, next: null });
    }));

  it('takes twice the time of the level before for each level past 10 (core tests the cost)', () =>
    game(async (g) => {
      const p = await seat(g, 12);
      await setBuildings(g, p, [[FIELD, FARM, 10]]);
      const eleven = await buildings.upgrade(g, p.id, p.cityId, FIELD);
      await g.runDue(eleven.endTime);
      const twelve = await buildings.upgrade(g, p.id, p.cityId, FIELD);
      expect(twelve.endTime - twelve.startTime).toBe((eleven.endTime - eleven.startTime) * BALANCE.historic.fieldLevelStep);
    }));
});

describe(`${buildings.demolish.name}: a historic city’s fields`, () => {
  it('demolishes a field at the city’s level, refunding every level, and it can be built back up to it', () =>
    game(async (g) => {
      const p = await seat(g, 14);
      await setBuildings(g, p, [[FIELD, QUARRY, 14]]);
      await setResources(g, p, { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 });
      await buildings.demolish(g, p.id, p.cityId, FIELD);
      expect(await buildingAt(g, p, FIELD)).toBeUndefined();
      const refund = fullDemolishRefund(QUARRY, 14);
      expect((await reloadCity(g, p.cityId)).stone).toBeCloseTo(refund.stone);
      expect(refund.stone).toBeGreaterThan(fullDemolishRefund(QUARRY, 10).stone);

      // a field of another kind in its place, built from level 1 to the city's 14
      await setResources(g, p, PLENTY);
      const built = await buildings.construct(g, p.id, p.cityId, IRONMINE, FIELD);
      await g.runDue(built.endTime);
      await setResources(g, p, PLENTY);
      for (let l = 2; l <= 14; l++) expect(await upgradeDone(g, p, FIELD)).toBe(l);
      await expectRefused(buildings.upgrade(g, p.id, p.cityId, FIELD), maxed(IRONMINE));
      expect(buildingMaxLevel(IRONMINE, 14)).toBe(14);
    }));
});
