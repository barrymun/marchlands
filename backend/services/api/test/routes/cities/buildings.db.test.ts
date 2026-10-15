// Building routes (src/routes/cities.ts): what can be built, next-level costs, construct, upgrade, demolish,
// cancel and speed up. The rules are covered by the buildings service tests.

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BuildingStatus, BuildingType, SpeedupId } from '@marchlands/core';
import { cities } from '@marchlands/db';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { expectInvalid, itGuards, type Lord, lords, RICH, setBuildings, setResources } from '#test/support/city-fixtures.ts';

const cityRow = async (api: TestApi, id: number) => (await api.db.select().from(cities).where(eq(cities.id, id)))[0];
const buildingAt = async (api: TestApi, cityId: number, positionId: number) => (await cityRow(api, cityId)).buildings.find((x) => x.positionId === positionId);

/** A cottage under construction at position 0. */
async function building(api: TestApi, p: Lord) {
  await setResources(api, p, RICH);
  return api.ok<{ endTime: number }>('POST', `cities/${p.cityId}/buildings`, { token: p.token, body: { typeId: BuildingType.COTTAGE, positionId: 0 } });
}

describe('GET /cities/{cityId}/buildings/available', () => {
  itGuards('GET', (c) => `cities/${c}/buildings/available`);

  it('lists the buildable types of an area', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      type Available = { buildings: ({ typeId: number; ok: boolean; info: { typeId: number } } | null)[]; unlockedOuterSlots: number };
      const inside = await api.ok<Available>('GET', `cities/${a.cityId}/buildings/available`, { token: a.token });
      expect(inside.unlockedOuterSlots).toEqual(expect.any(Number));
      expect(inside.buildings).toContainEqual(
        expect.objectContaining({ typeId: BuildingType.COTTAGE, info: expect.objectContaining({ typeId: BuildingType.COTTAGE }) }),
      );
      expect(inside.buildings.some((x) => x?.typeId === BuildingType.FARM)).toBe(false);
      const outside = await api.ok<Available>('GET', `cities/${a.cityId}/buildings/available`, { token: a.token, query: { area: 'outside' } });
      expect(outside.buildings.some((x) => x?.typeId === BuildingType.FARM)).toBe(true);
    }));

  it('refuses an unknown area', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['GET', `cities/${a.cityId}/buildings/available`, { query: { area: 'roof' } }]]);
    }));
});

describe('GET /cities/{cityId}/buildings/{positionId}', () => {
  itGuards('GET', (c) => `cities/${c}/buildings/-1`);

  it('answers the building and its next level', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const info = await api.ok('GET', `cities/${a.cityId}/buildings/-1`, { token: a.token });
      expect(info).toMatchObject({
        building: { positionId: -1, typeId: BuildingType.TOWN_HALL, level: 1, status: BuildingStatus.IDLE },
        info: { typeId: BuildingType.TOWN_HALL },
        maxLevel: 10,
        next: { typeId: BuildingType.TOWN_HALL, level: 2, requirements: expect.any(Array), ok: expect.any(Boolean) },
        demolishRefund: expect.objectContaining({ wood: expect.any(Number) }),
      });
    }));

  it('refuses a malformed position and an empty one', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['GET', `cities/${a.cityId}/buildings/x`],
        ['GET', `cities/${a.cityId}/buildings/1041`],
        ['GET', `cities/${a.cityId}/buildings/-3`],
      ]);
      await api.refused('GET', `cities/${a.cityId}/buildings/5`, 'building.notFound', { token: a.token, status: 404 });
    }));
});

describe('POST /cities/{cityId}/buildings', () => {
  itGuards('POST', (c) => `cities/${c}/buildings`, { body: { typeId: BuildingType.COTTAGE, positionId: 0 } });

  it('starts a construction and pays for it', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const before = await cityRow(api, a.cityId);
      const bean = await api.ok<{ endTime: number }>('POST', `cities/${a.cityId}/buildings`, {
        token: a.token,
        body: { typeId: BuildingType.COTTAGE, positionId: 0 },
      });
      expect(bean).toMatchObject({ positionId: 0, typeId: BuildingType.COTTAGE, level: 0, status: BuildingStatus.BUILDING });
      expect(bean.endTime).toBeGreaterThan(Date.now());
      const after = await cityRow(api, a.cityId);
      expect(after.buildings).toContainEqual(expect.objectContaining({ positionId: 0, typeId: BuildingType.COTTAGE, status: BuildingStatus.BUILDING }));
      expect(after.wood).toBeLessThan(before.wood);
    }));

  it('refuses a malformed body and a taken position', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/buildings`, { body: { typeId: BuildingType.COTTAGE } }],
        ['POST', `cities/${a.cityId}/buildings`, { body: { typeId: 'cottage', positionId: 0 } }],
      ]);
      await building(api, a);
      await api.refused('POST', `cities/${a.cityId}/buildings`, 'building.positionTaken', {
        token: a.token,
        body: { typeId: BuildingType.COTTAGE, positionId: 0 },
        status: 400,
      });
    }));
});

describe('POST /cities/{cityId}/buildings/{positionId}/upgrade', () => {
  itGuards('POST', (c) => `cities/${c}/buildings/-1/upgrade`);

  it('starts the next level', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResources(api, a, RICH);
      const bean = await api.ok('POST', `cities/${a.cityId}/buildings/-1/upgrade`, { token: a.token });
      expect(bean).toMatchObject({ positionId: -1, typeId: BuildingType.TOWN_HALL, level: 1, status: BuildingStatus.BUILDING });
      expect(await buildingAt(api, a.cityId, -1)).toMatchObject({ level: 1, status: BuildingStatus.BUILDING });
    }));

  it('refuses a malformed position, an empty one and a building already being built', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/buildings/2000/upgrade`]]);
      await api.refused('POST', `cities/${a.cityId}/buildings/7/upgrade`, 'building.notFound', { token: a.token, status: 404 });
      await building(api, a);
      const r = await api.refused('POST', `cities/${a.cityId}/buildings/0/upgrade`, 'building.statusChanged', { token: a.token, status: 400 });
      expect(r.body.ok).toBe(-45);
    }));
});

describe('POST /cities/{cityId}/buildings/{positionId}/demolish', () => {
  itGuards('POST', (c) => `cities/${c}/buildings/-1/demolish`);

  it('removes the whole building and refunds a share', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setBuildings(api, a, [[20, BuildingType.COTTAGE, 3]]);
      const before = await cityRow(api, a.cityId);
      const bean = await api.ok('POST', `cities/${a.cityId}/buildings/20/demolish`, { token: a.token });
      expect(bean).toMatchObject({ positionId: 20, typeId: 0, level: 0 });
      const after = await cityRow(api, a.cityId);
      expect(after.buildings.some((x) => x.positionId === 20)).toBe(false);
      expect(after.wood).toBeGreaterThan(before.wood);
    }));

  it('refuses the Town Hall and an empty position', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const r = await api.refused('POST', `cities/${a.cityId}/buildings/-1/demolish`, 'building.cannotDemolish', { token: a.token, status: 400 });
      expect(r.body.error?.params).toEqual({ building: expect.objectContaining({ id: BuildingType.TOWN_HALL }) });
      await api.refused('POST', `cities/${a.cityId}/buildings/9/demolish`, 'building.nothingToDemolish', { token: a.token, status: 400 });
    }));
});

describe('POST /cities/{cityId}/buildings/{positionId}/cancel', () => {
  itGuards('POST', (c) => `cities/${c}/buildings/0/cancel`);

  it('cancels a construction', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await building(api, a);
      expect(await api.ok('POST', `cities/${a.cityId}/buildings/0/cancel`, { token: a.token })).toBeNull();
      expect(await buildingAt(api, a.cityId, 0)).toBeUndefined();
    }));

  it('refuses a building that is not being built', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/buildings/zero/cancel`]]);
      await api.refused('POST', `cities/${a.cityId}/buildings/-1/cancel`, 'building.notInProgress', { token: a.token, status: 400 });
    }));
});

describe('GET /cities/{cityId}/buildings/{positionId}/speedup', () => {
  itGuards('GET', (c) => `cities/${c}/buildings/0/speedup`);

  it('answers the gold to finish now', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await building(api, a);
      const cost = await api.ok<{ goldNeed: number; timeLeft: number }>('GET', `cities/${a.cityId}/buildings/0/speedup`, { token: a.token });
      expect(cost.goldNeed).toBeGreaterThan(0);
      expect(cost.timeLeft).toBeGreaterThan(0);
    }));

  it('refuses a building that is not being built', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('GET', `cities/${a.cityId}/buildings/-1/speedup`, 'building.notInProgress', { token: a.token, status: 400 });
    }));
});

describe('POST /cities/{cityId}/buildings/{positionId}/speedup', () => {
  itGuards('POST', (c) => `cities/${c}/buildings/0/speedup`, { body: { itemId: SpeedupId.GOLD } });

  it('finishes the construction now for gold', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const started = await building(api, a);
      const gold = (await cityRow(api, a.cityId)).gold;
      const bean = await api.ok<{ endTime: number }>('POST', `cities/${a.cityId}/buildings/0/speedup`, { token: a.token, body: { itemId: SpeedupId.GOLD } });
      expect(bean).toMatchObject({ positionId: 0, typeId: BuildingType.COTTAGE, status: BuildingStatus.BUILDING });
      expect(bean.endTime).toBeLessThan(started.endTime);
      expect(bean.endTime).toBeLessThanOrEqual(Date.now());
      expect((await cityRow(api, a.cityId)).gold).toBeLessThan(gold);
    }));

  it('refuses a malformed body and an unknown speed-up', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await building(api, a);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/buildings/0/speedup`, { body: {} }],
        ['POST', `cities/${a.cityId}/buildings/0/speedup`, { body: { itemId: 7 } }],
      ]);
      await api.refused('POST', `cities/${a.cityId}/buildings/0/speedup`, 'common.invalidSpeedup', { token: a.token, body: { itemId: 'bogus' }, status: 400 });
    }));
});
