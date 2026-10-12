// Army and valley routes (src/routes/military.ts): the armies a player sees, sending, recalling and dismissing
// armies, march parameters and estimates, allied troops stationed in a city, and giving up or raising valleys.
// The rules are covered by the armies and combat service tests.

import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ArmyDirection, BuildingType, HeroStatus, Mission, TileType } from '@marchlands/core';
import { armies, cities, heroes, tiles } from '@marchlands/db';
import { apiTest, type TestApi } from '#test/support/api.ts';
import {
  addHero,
  allies,
  arrive,
  atWar,
  expectClientError,
  expectInvalid,
  HUGE_ID,
  itGuards,
  itNeedsPlayer,
  lords,
  patchTile,
  RICH,
  setBuildings,
  setCityStats,
  setResources,
  type Lord,
} from '#test/support/city-fixtures.ts';

type Army = { armyId: number; missionType: number; direction: number; targetFieldId: number; troop: Record<string, number> | null; hero: string };
type Tile = { id: number; type: number; level: number; cityId: number | null; ownerCityId: number | null; x: number; y: number };

const cityRow = async (api: TestApi, id: number) => (await api.db.select().from(cities).where(eq(cities.id, id)))[0];
const armyRow = async (api: TestApi, id: number) => (await api.db.select().from(armies).where(eq(armies.id, id)))[0];
const tileRow = async (api: TestApi, id: number) => (await api.db.select().from(tiles).where(eq(tiles.id, id)))[0];

/** A Rally Spot, Feasting Hall and Embassy, troops, resources, people, no beginner protection, and a hero. */
async function warCity(api: TestApi, p: Lord, troops: Record<string, number> = { lightCavalry: 5000, scouter: 500 }) {
  await setBuildings(api, p, [
    [0, BuildingType.RALLY_SPOT, 10],
    [1, BuildingType.FEASTING_HALL, 5],
    [2, BuildingType.EMBASSY, 1],
  ]);
  await setResources(api, p, RICH);
  await setCityStats(api, p, { population: 50_000, troops });
  await atWar(api, p);
  return addHero(api, p);
}

/** A free level-1 valley near the player's city, found with the map search. */
async function valleyNear(api: TestApi, p: Lord): Promise<Tile> {
  const { x, y } = await api.ok<{ x: number; y: number }>('GET', `cities/${p.cityId}`, { token: p.token });
  for (const type of [TileType.GRASS, TileType.FOREST, TileType.LAKE, TileType.HILL]) {
    const found = await api.ok<Tile[]>('GET', 'map/search', { token: p.token, query: { x: String(x), y: String(y), radius: '12', type: String(type) } });
    const free = found.find((t) => t.cityId == null && t.ownerCityId == null && t.level === 1);
    if (free) return free;
  }
  throw new Error(`no free valley near city ${p.cityId}`);
}

const attack = (api: TestApi, p: Lord, heroId: number, targetTileId: number) =>
  api.ok<Army>('POST', `cities/${p.cityId}/armies`, {
    token: p.token,
    body: { targetTileId, mission: Mission.ATTACK, troops: { lightCavalry: 100 }, heroId },
  });

/** a's troops stationed in b's city (allies, b accepts allied troops); returns the army id. */
async function stationed(api: TestApi, a: Lord, b: Lord) {
  await warCity(api, a);
  await warCity(api, b);
  await allies(api, a, b);
  await api.ok('PATCH', `cities/${b.cityId}`, { token: b.token, body: { allowAlliance: true } });
  const target = (await cityRow(api, b.cityId)).tileId;
  const army = await api.ok<Army>('POST', `cities/${a.cityId}/armies`, {
    token: a.token,
    body: { targetTileId: target, mission: Mission.REINFORCE, troops: { lightCavalry: 100 } },
  });
  await arrive(api, army.armyId);
  expect((await armyRow(api, army.armyId)).direction).toBe(ArmyDirection.STAY);
  return army.armyId;
}

describe('GET /armies', () => {
  itNeedsPlayer('GET', 'armies');

  it("answers the player's own armies and the hostile ones heading for them", () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      await warCity(api, a);
      await warCity(api, b);
      const scout = await api.ok<Army>('POST', `cities/${a.cityId}/armies`, {
        token: a.token,
        body: { targetTileId: (await cityRow(api, b.cityId)).tileId, mission: Mission.SCOUT, troops: { scouter: 10 } },
      });
      expect(await api.ok('GET', 'armies', { token: a.token })).toEqual({
        self: [expect.objectContaining({ armyId: scout.armyId, missionType: Mission.SCOUT, troop: expect.objectContaining({ scouter: 10 }) })],
        friend: [],
        enemy: [],
      });
      // without a Beacon Tower the troops are hidden
      expect(await api.ok('GET', 'armies', { token: b.token })).toEqual({
        self: [],
        friend: [],
        enemy: [expect.objectContaining({ armyId: scout.armyId, troop: null })],
      });
    }));
});

describe('POST /cities/{cityId}/armies', () => {
  itGuards('POST', (c) => `cities/${c}/armies`, { body: { targetTileId: 0, mission: Mission.SCOUT, troops: { scouter: 1 } } });

  it('sends an army with its hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const heroId = await warCity(api, a);
      const valley = await valleyNear(api, a);
      const army = await attack(api, a, heroId, valley.id);
      expect(army).toMatchObject({
        missionType: Mission.ATTACK,
        direction: ArmyDirection.FORWARD,
        cityId: a.cityId,
        heroId,
        targetFieldId: valley.id,
        troop: expect.objectContaining({ lightCavalry: 100 }),
      });
      expect(await armyRow(api, army.armyId)).toMatchObject({ playerId: a.playerId, targetTileId: valley.id, troops: { lightCavalry: 100 } });
      expect((await cityRow(api, a.cityId)).troops).toMatchObject({ lightCavalry: 4900 });
      expect((await api.db.select().from(heroes).where(eq(heroes.id, heroId)))[0].status).toBe(HeroStatus.ATTACK);
    }));

  it('refuses a malformed body', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const url = `cities/${a.cityId}/armies`;
      const ok = { targetTileId: 1, mission: Mission.ATTACK, troops: { lightCavalry: 1 } };
      await expectInvalid(api, a.token, [
        ['POST', url, { body: { ...ok, targetTileId: undefined } }],
        ['POST', url, { body: { ...ok, mission: 6 } }],
        ['POST', url, { body: { ...ok, mission: 0 } }],
        ['POST', url, { body: { ...ok, troops: { lightCavalry: -1 } } }],
        ['POST', url, { body: { ...ok, resources: { gold: -5 } } }],
        ['POST', url, { body: { ...ok, restTime: -1 } }],
      ]);
    }));

  it('passes on the game refusals with their codes', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const heroId = await warCity(api, a);
      const valley = await valleyNear(api, a);
      const url = `cities/${a.cityId}/armies`;
      const send = (body: object) => ({ token: a.token, body: { targetTileId: valley.id, mission: Mission.ATTACK, heroId, ...body }, status: 400 });
      expect((await api.refused('POST', url, 'army.insufficientTroops', send({ troops: { lightCavalry: 5001 } }))).body.ok).toBe(-29);
      expect((await api.refused('POST', url, 'army.heroRequiredAttack', send({ troops: { lightCavalry: 1 }, heroId: null }))).body.ok).toBe(-71);
      const own = (await cityRow(api, a.cityId)).tileId;
      expect((await api.refused('POST', url, 'army.invalidTarget', send({ troops: { lightCavalry: 1 }, targetTileId: own }))).body.ok).toBe(-13);
      await api.refused('POST', url, 'common.invalidCoordinates', { ...send({ troops: { lightCavalry: 1 }, targetTileId: 2_000_000_000 }), status: 404 });
    }));
});

describe('POST /armies/{armyId}/recall', () => {
  itNeedsPlayer('POST', 'armies/1/recall');

  it('turns a marching army around', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const heroId = await warCity(api, a);
      const army = await attack(api, a, heroId, (await valleyNear(api, a)).id);
      expect(await api.ok('POST', `armies/${army.armyId}/recall`, { token: a.token })).toMatchObject({
        armyId: army.armyId,
        direction: ArmyDirection.BACKWARD,
      });
      expect((await armyRow(api, army.armyId)).direction).toBe(ArmyDirection.BACKWARD);
      await api.refused('POST', `armies/${army.armyId}/recall`, 'army.alreadyReturning', { token: a.token, status: 400 });
    }));

  it("refuses a malformed id and another player's army", () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const heroId = await warCity(api, a);
      const army = await attack(api, a, heroId, (await valleyNear(api, a)).id);
      await expectInvalid(api, b.token, [['POST', 'armies/x/recall']]);
      await api.refused('POST', `armies/${army.armyId}/recall`, 'army.notFound', { token: b.token, status: 404 });
      await api.refused('POST', 'armies/2000000000/recall', 'army.notFound', { token: b.token, status: 404 });
      expect((await armyRow(api, army.armyId)).direction).toBe(ArmyDirection.FORWARD);
    }));

  it('answers an id past the integer range as an unknown army', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectClientError(api, a.token, 'POST', `armies/${HUGE_ID}/recall`);
    }));
});

describe('POST /armies/{armyId}/dismiss', () => {
  itNeedsPlayer('POST', 'armies/1/dismiss');

  it('sends allied troops stationed in the city home', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const armyId = await stationed(api, a, b);
      expect(await api.ok('GET', 'armies', { token: b.token })).toMatchObject({ friend: [expect.objectContaining({ armyId, direction: ArmyDirection.STAY })] });
      expect(await api.ok('POST', `armies/${armyId}/dismiss`, { token: b.token })).toBeNull();
      expect((await armyRow(api, armyId)).direction).toBe(ArmyDirection.BACKWARD);
    }));

  it('refuses an army that is not a guest of the player', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const armyId = await stationed(api, a, b);
      await expectInvalid(api, b.token, [['POST', 'armies/-1/dismiss']]);
      await api.refused('POST', `armies/${armyId}/dismiss`, 'army.notFound', { token: a.token, status: 404 });
      expect((await armyRow(api, armyId)).direction).toBe(ArmyDirection.STAY);
    }));
});

describe('GET /cities/{cityId}/armies/params', () => {
  itGuards('GET', (c) => `cities/${c}/armies/params`);

  it('answers the march parameters and the army caps', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setBuildings(api, a, [[0, BuildingType.RALLY_SPOT, 3]]);
      expect(await api.ok('GET', `cities/${a.cityId}/armies/params`, { token: a.token })).toEqual({
        marchSkillParam: 0,
        loadSkillParam: 0,
        driveSkillParam: 0,
        transportStationParam: expect.any(Number),
        maxArmies: expect.any(Number),
        maxTroops: 30_000,
      });
    }));
});

describe('POST /cities/{cityId}/armies/estimate', () => {
  itGuards('POST', (c) => `cities/${c}/armies/estimate`, { body: { targetTileId: 0, troops: { lightCavalry: 1 } } });

  it('answers the march time and load', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const valley = await valleyNear(api, a);
      const est = await api.ok<{ marchTime: number; load: number }>('POST', `cities/${a.cityId}/armies/estimate`, {
        token: a.token,
        body: { targetTileId: valley.id, troops: { lightCavalry: 100 } },
      });
      expect(est.marchTime).toBeGreaterThan(0);
      expect(est.load).toBeGreaterThan(0);
    }));

  it('refuses a malformed body and an unknown tile', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/armies/estimate`, { body: { targetTileId: 1 } }],
        ['POST', `cities/${a.cityId}/armies/estimate`, { body: { targetTileId: 1, troops: { lightCavalry: 'many' } } }],
      ]);
      await api.refused('POST', `cities/${a.cityId}/armies/estimate`, 'common.invalidCoordinates', {
        token: a.token,
        body: { targetTileId: 2_000_000_000, troops: { lightCavalry: 1 } },
        status: 404,
      });
    }));
});

describe('GET /cities/{cityId}/stationed', () => {
  itGuards('GET', (c) => `cities/${c}/stationed`);

  it('lists allied troops stationed in the city', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      expect(await api.ok('GET', `cities/${b.cityId}/stationed`, { token: b.token })).toEqual([]);
      const armyId = await stationed(api, a, b);
      expect(await api.ok('GET', `cities/${b.cityId}/stationed`, { token: b.token })).toEqual([
        expect.objectContaining({ armyId, playerId: a.playerId, direction: ArmyDirection.STAY, troop: expect.objectContaining({ lightCavalry: 100 }) }),
      ]);
    }));
});

describe('DELETE /valleys/{tileId}', () => {
  itGuards('DELETE', () => 'valleys/1', { city: false });

  it('gives up a valley the city holds', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const valley = await valleyNear(api, a);
      await patchTile(api, valley.id, { ownerCityId: a.cityId, ownerPlayerId: a.playerId });
      expect(await api.ok('DELETE', `valleys/${valley.id}`, { token: a.token })).toBeNull();
      expect(await tileRow(api, valley.id)).toMatchObject({ ownerCityId: null, ownerPlayerId: null });
    }));

  it("refuses a malformed id, a free valley and another player's valley", () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const valley = await valleyNear(api, a);
      await expectInvalid(api, a.token, [['DELETE', 'valleys/abc']]);
      await api.refused('DELETE', `valleys/${valley.id}`, 'army.valleyNotHeld', { token: a.token, status: 400 });
      await patchTile(api, valley.id, { ownerCityId: b.cityId, ownerPlayerId: b.playerId });
      await api.refused('DELETE', `valleys/${valley.id}`, 'army.valleyNotHeld', { token: a.token, status: 400 });
      expect((await tileRow(api, valley.id)).ownerPlayerId).toBe(b.playerId);
    }));

  it('answers an id past the integer range as an unknown tile', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectClientError(api, a.token, 'DELETE', `valleys/${HUGE_ID}`);
    }));
});

describe('POST /valleys/{tileId}/upgrade', () => {
  itGuards('POST', () => 'valleys/1/upgrade', { bodyFor: (cityId) => ({ cityId }) });

  it('raises a free valley one level for the city gold', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResources(api, a, RICH);
      const valley = await valleyNear(api, a);
      const res = await api.ok<{ gold: number }>('POST', `valleys/${valley.id}/upgrade`, { token: a.token, body: { cityId: a.cityId } });
      expect(res).toEqual({ tileId: valley.id, level: 2, gold: expect.any(Number), nextCost: expect.any(Number) });
      expect((await tileRow(api, valley.id)).level).toBe(2);
      expect((await cityRow(api, a.cityId)).gold).toBeCloseTo(RICH.gold - res.gold, 0);
    }));

  it('refuses a malformed body, a held valley and a city', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      await setResources(api, a, RICH);
      const valley = await valleyNear(api, a);
      await expectInvalid(api, a.token, [
        ['POST', `valleys/${valley.id}/upgrade`, { body: {} }],
        ['POST', `valleys/${valley.id}/upgrade`, { body: { cityId: String(a.cityId) } }],
      ]);
      await api.refused('POST', `valleys/${(await cityRow(api, b.cityId)).tileId}/upgrade`, 'army.upgradeTarget', {
        token: a.token,
        body: { cityId: a.cityId },
        status: 400,
      });
      await patchTile(api, valley.id, { ownerCityId: b.cityId, ownerPlayerId: b.playerId });
      await api.refused('POST', `valleys/${valley.id}/upgrade`, 'army.upgradeHeld', { token: a.token, body: { cityId: a.cityId }, status: 400 });
    }));

  it('answers a city id past the integer range as an unknown city', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectClientError(api, a.token, 'POST', 'valleys/1/upgrade', { cityId: HUGE_ID });
    }));
});
