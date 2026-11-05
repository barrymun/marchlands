// City interior routes (src/routes/cities.ts): city detail, settings, tax, work rates, store percent, comfort,
// production, teleporting and abandoning. The rules are covered by the interior service tests.

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BuildingType } from '@marchlands/core';
import { cities } from '@marchlands/db';
import { pickOpenFlat } from '@marchlands/game/testing';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { expectClientError, expectInvalid, HUGE_ID, itGuards, lords, RICH, setResources } from '#test/support/city-fixtures.ts';

const cityRow = async (api: TestApi, id: number) => (await api.db.select().from(cities).where(eq(cities.id, id)))[0];

describe('GET /cities/{cityId}', () => {
  itGuards('GET', (c) => `cities/${c}`);

  it("answers the player's city", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const city = await api.ok<Record<string, unknown>>('GET', `cities/${a.cityId}`, { token: a.token });
      expect(city).toMatchObject({
        id: a.cityId,
        name: `${a.name} City`,
        resource: expect.objectContaining({ gold: expect.any(Number) }),
        buildings: expect.arrayContaining([expect.objectContaining({ positionId: -1, typeId: BuildingType.TOWN_HALL, level: 1 })]),
        troop: expect.objectContaining({ militia: 0 }),
        heros: [],
        fields: [],
      });
      expect(city.fieldId).toBe((await cityRow(api, a.cityId))!.tileId);
    }));

  it('refuses a malformed city id', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['GET', 'cities/abc'],
        ['GET', 'cities/-1'],
        ['GET', 'cities/1.5'],
      ]);
    }));

  it('answers an id past the integer range as an unknown city', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectClientError(api, a.token, 'GET', `cities/${HUGE_ID}`);
    }));
});

describe('PATCH /cities/{cityId}', () => {
  itGuards('PATCH', (c) => `cities/${c}`, { body: { goOutForBattle: false } });

  it('renames the city and sets its flags, answering the city', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const logoUrl = 'images/icon/cityLogo/citylogo_02.png';
      const city = await api.ok('PATCH', `cities/${a.cityId}`, {
        token: a.token,
        body: { name: 'Northwatch', logoUrl, goOutForBattle: false, allowAlliance: true },
      });
      expect(city).toMatchObject({ id: a.cityId, name: 'Northwatch', logoUrl, goOutForBattle: false, allowAlliance: true });
      expect(await cityRow(api, a.cityId)).toMatchObject({ name: 'Northwatch', logoUrl, goOutForBattle: false, allowAlliance: true });
      // an empty body changes nothing
      expect(await api.ok('PATCH', `cities/${a.cityId}`, { token: a.token, body: {} })).toMatchObject({ name: 'Northwatch' });
    }));

  it('refuses a malformed body', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['PATCH', `cities/${a.cityId}`, { body: { name: 5 } }],
        ['PATCH', `cities/${a.cityId}`, { body: { goOutForBattle: 'no' } }],
      ]);
    }));

  it('passes on the game refusals', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const bad = await api.refused('PATCH', `cities/${a.cityId}`, 'common.nameInvalid', { token: a.token, body: { name: 'No<tags>' }, status: 400 });
      expect(bad.body).toMatchObject({ ok: -87, error: { params: { what: { code: 'common.cityName' } } } });
      await api.refused('PATCH', `cities/${a.cityId}`, 'city.invalidLogo', { token: a.token, body: { logoUrl: 'https://example.test/x.png' }, status: 400 });
      expect((await cityRow(api, a.cityId))!.name).toBe(`${a.name} City`);
    }));
});

describe('PUT /cities/{cityId}/tax', () => {
  itGuards('PUT', (c) => `cities/${c}/tax`, { body: { rate: 20 } });

  it('sets the tax rate', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      expect(await api.ok('PUT', `cities/${a.cityId}/tax`, { token: a.token, body: { rate: 35 } })).toBeNull();
      expect((await cityRow(api, a.cityId))!.taxRate).toBe(35);
    }));

  it('refuses a malformed body and a rate out of range', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['PUT', `cities/${a.cityId}/tax`, { body: {} }],
        ['PUT', `cities/${a.cityId}/tax`, { body: { rate: 'high' } }],
        ['PUT', `cities/${a.cityId}/tax`, { body: { rate: 12.5 } }],
      ]);
      const r = await api.refused('PUT', `cities/${a.cityId}/tax`, 'city.taxRateRange', { token: a.token, body: { rate: 101 }, status: 400 });
      expect(r.body.ok).toBe(-99);
    }));

  it('asks for a token before it validates the body', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const r = await api.call('PUT', `cities/${a.cityId}/tax`, { body: { rate: 'high' } });
      expect(r.status).toBe(401);
      expect(r.body.error?.code).toBe('auth.notLoggedIn');
    }));
});

describe('PUT /cities/{cityId}/work-rates', () => {
  itGuards('PUT', (c) => `cities/${c}/work-rates`, { body: { food: 50 } });

  it('sets the given work rates, keeping the others', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      expect(await api.ok('PUT', `cities/${a.cityId}/work-rates`, { token: a.token, body: { food: 40, iron: 0 } })).toBeNull();
      expect((await cityRow(api, a.cityId))!.workRates).toMatchObject({ food: 40, wood: 100, stone: 100, iron: 0 });
    }));

  it('refuses a malformed body and a rate out of range', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['PUT', `cities/${a.cityId}/work-rates`, { body: { food: 'all' } }]]);
      await api.refused('PUT', `cities/${a.cityId}/work-rates`, 'city.workRateRange', { token: a.token, body: { wood: 120 }, status: 400 });
    }));
});

describe('PUT /cities/{cityId}/store-percent', () => {
  itGuards('PUT', (c) => `cities/${c}/store-percent`, { body: { food: 10 } });

  it('sets the given store percentages, keeping the others', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      expect(await api.ok('PUT', `cities/${a.cityId}/store-percent`, { token: a.token, body: { food: 40, wood: 10 } })).toBeNull();
      expect((await cityRow(api, a.cityId))!.storePercent).toMatchObject({ food: 40, wood: 10, stone: 25, iron: 25 });
    }));

  it('refuses a malformed body and a total above 100', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['PUT', `cities/${a.cityId}/store-percent`, { body: { stone: 2.5 } }]]);
      await api.refused('PUT', `cities/${a.cityId}/store-percent`, 'city.storePercentTotal', { token: a.token, body: { food: 60 }, status: 400 });
    }));
});

describe('POST /cities/{cityId}/comfort', () => {
  itGuards('POST', (c) => `cities/${c}/comfort`, { body: { typeId: 3 } });

  it('a blessing turns gold into food; a second comfort waits for the cooldown', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const before = (await cityRow(api, a.cityId))!;
      const res = await api.ok<{ freeBlessing: boolean }>('POST', `cities/${a.cityId}/comfort`, { token: a.token, body: { typeId: 3 } });
      expect(res).toEqual({ freeBlessing: expect.any(Boolean) });
      const after = (await cityRow(api, a.cityId))!;
      expect(after.gold).toBeLessThan(before.gold);
      expect(after.food).toBeGreaterThan(before.food);
      const r = await api.refused('POST', `cities/${a.cityId}/comfort`, 'city.comfortCooldown', { token: a.token, body: { typeId: 3 }, status: 400 });
      expect(r.body).toMatchObject({ ok: -34, error: { params: { time: expect.anything() } } });
    }));

  it('refuses a malformed body and an unknown comfort', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/comfort`, { body: {} }],
        ['POST', `cities/${a.cityId}/comfort`, { body: { typeId: '3x' } }],
      ]);
      await api.refused('POST', `cities/${a.cityId}/comfort`, 'city.invalidComfortType', { token: a.token, body: { typeId: 1 }, status: 400 });
    }));
});

describe('GET /cities/{cityId}/production', () => {
  itGuards('GET', (c) => `cities/${c}/production`);

  it('answers a line per basic resource with the work rate set', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.ok('PUT', `cities/${a.cityId}/work-rates`, { token: a.token, body: { stone: 30 } });
      const lines = await api.ok<{ resource: string; typeid: number; commenceRate: number; totalOutput: number }[]>('GET', `cities/${a.cityId}/production`, {
        token: a.token,
      });
      expect(lines.map((l) => [l.typeid, l.resource])).toEqual([
        [1, 'food'],
        [2, 'wood'],
        [3, 'stone'],
        [4, 'iron'],
      ]);
      expect(lines[2]).toMatchObject({ commenceRate: 30, totalOutput: expect.any(Number) });
    }));
});

describe('POST /cities/{cityId}/move', () => {
  itGuards('POST', (c) => `cities/${c}/move`, { body: { targetTileId: 0 } });

  it('teleports the city to a free flat, then cools down', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResources(api, a, RICH);
      const flat = await api.game((ctx) => pickOpenFlat(ctx, -1));
      const moved = await api.ok('POST', `cities/${a.cityId}/move`, { token: a.token, body: { targetTileId: flat } });
      expect(moved).toEqual({ fieldId: flat, x: expect.any(Number), y: expect.any(Number) });
      expect((await cityRow(api, a.cityId))!.tileId).toBe(flat);
      const again = await api.game((ctx) => pickOpenFlat(ctx, -1));
      const r = await api.refused('POST', `cities/${a.cityId}/move`, 'city.teleportCooldown', { token: a.token, body: { targetTileId: again }, status: 400 });
      expect(r.body.ok).toBe(-90);
    }));

  it('refuses a malformed body and a tile that is not a free flat', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/move`, { body: {} }],
        ['POST', `cities/${a.cityId}/move`, { body: { targetTileId: -3 } }],
      ]);
      const taken = (await cityRow(api, b.cityId))!.tileId;
      const r = await api.refused('POST', `cities/${a.cityId}/move`, 'city.notFreeFlat', { token: a.token, body: { targetTileId: taken }, status: 400 });
      expect(r.body.ok).toBe(-25);
    }));

  it('answers a tile id past the integer range as an unknown tile', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResources(api, a, RICH);
      await expectClientError(api, a.token, 'POST', `cities/${a.cityId}/move`, { targetTileId: HUGE_ID });
    }));
});

describe('POST /cities/{cityId}/abandon', () => {
  itGuards('POST', (c) => `cities/${c}/abandon`);

  it("refuses a player's last city, with the game's message", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('POST', `cities/${a.cityId}/abandon`, 'city.abandonKeepRegular', { token: a.token });
    }));

  it('starts the hour with a second city to keep, and DELETE keeps the city', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const { id: _id, ...row } = (await cityRow(api, a.cityId))!;
      const flat = await api.game((ctx) => pickOpenFlat(ctx, -1));
      await api.db.insert(cities).values({ ...row, tileId: flat, name: 'Eastwold' });
      const { abandonAt } = await api.ok<{ abandonAt: number }>('POST', `cities/${a.cityId}/abandon`, { token: a.token });
      expect((await cityRow(api, a.cityId))!.abandonAt).toBe(abandonAt);
      await api.ok('DELETE', `cities/${a.cityId}/abandon`, { token: a.token });
      expect((await cityRow(api, a.cityId))!.abandonAt).toBe(0);
    }));
});

describe('DELETE /cities/{cityId}/abandon', () => {
  itGuards('DELETE', (c) => `cities/${c}/abandon`);

  it('refuses a city not being abandoned', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('DELETE', `cities/${a.cityId}/abandon`, 'city.abandonNotRunning', { token: a.token });
    }));
});
