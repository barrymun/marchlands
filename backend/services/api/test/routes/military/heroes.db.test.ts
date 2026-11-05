// Hero routes (src/routes/military.ts): the city's heroes, the tavern, the mayor, hero commands, the lord's gear.
// The rules are covered by the heroes service tests.

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BuildingType, gearStarCost, HeroStatus, ItemId, medalId, TechType } from '@marchlands/core';
import { cities, heroes, players } from '@marchlands/db';

import { apiTest, type TestApi } from '#test/support/api.ts';
import {
  addHero,
  expectClientError,
  expectInvalid,
  giveItems,
  HUGE_ID,
  itGuards,
  itGuardsHero,
  itNeedsPlayer,
  type Lord,
  lords,
  patchHero,
  readHero,
  RICH,
  setBuildings,
  setResearch,
  setResources,
} from '#test/support/city-fixtures.ts';

const INN = 2;
const HALL = 3;

type Hero = { id: number; name: string; status: number; level: number; loyalty: number; experience: number; power: number; locked: boolean };

const gold = async (api: TestApi, cityId: number) => (await api.db.select({ gold: cities.gold }).from(cities).where(eq(cities.id, cityId)))[0]!.gold;
const heroRow = async (api: TestApi, id: number) => (await api.db.select().from(heroes).where(eq(heroes.id, id)))[0];
const items = async (api: TestApi, p: Lord) => (await api.db.select({ items: players.items }).from(players).where(eq(players.id, p.playerId)))[0]!.items;

/** An Inn and a Feasting Hall (hero slots), and gold. */
async function heroHall(api: TestApi, p: Lord, inn = 5, hall = 5) {
  await setBuildings(api, p, [
    [INN, BuildingType.INN, inn],
    [HALL, BuildingType.FEASTING_HALL, hall],
  ]);
  await setResources(api, p, RICH);
}

describe('GET /cities/{cityId}/heroes', () => {
  itGuards('GET', (c) => `cities/${c}/heroes`);

  it("lists the city's heroes and its slots", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await heroHall(api, a, 1, 4);
      const id = await addHero(api, a);
      const list = await api.ok('GET', `cities/${a.cityId}/heroes`, { token: a.token });
      expect(list).toEqual({ heroes: [expect.objectContaining({ id, cityId: a.cityId, status: HeroStatus.IDLE })], slots: 4 });
    }));
});

describe('GET /cities/{cityId}/tavern', () => {
  itGuards('GET', (c) => `cities/${c}/tavern`);

  it('answers the offers', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await heroHall(api, a, 3, 2);
      const tavern = await api.ok<{ heros: Hero[] }>('GET', `cities/${a.cityId}/tavern`, { token: a.token });
      expect(tavern).toMatchObject({ posCount: 2, refreshCost: expect.any(Number) });
      expect(tavern.heros).toHaveLength(3);
      // the same offers until refreshed
      expect((await api.ok<{ heros: Hero[] }>('GET', `cities/${a.cityId}/tavern`, { token: a.token })).heros.map((h) => h.id)).toEqual(
        tavern.heros.map((h) => h.id),
      );
    }));

  it('refuses a city without an Inn', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const r = await api.refused('GET', `cities/${a.cityId}/tavern`, 'hero.needInn', { token: a.token, status: 400 });
      expect(r.body).toMatchObject({ ok: -1, error: { params: { building: { ref: 'building', id: BuildingType.INN } } } });
    }));
});

describe('POST /cities/{cityId}/tavern/refresh', () => {
  itGuards('POST', (c) => `cities/${c}/tavern/refresh`);

  it('pays gold for new offers', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await heroHall(api, a, 2);
      const old = await api.ok<{ heros: Hero[] }>('GET', `cities/${a.cityId}/tavern`, { token: a.token });
      const before = await gold(api, a.cityId);
      const fresh = await api.ok<{ heros: Hero[]; refreshCost: number }>('POST', `cities/${a.cityId}/tavern/refresh`, { token: a.token });
      expect(fresh.heros).toHaveLength(2);
      expect(fresh.heros.map((h) => h.id)).not.toEqual(old.heros.map((h) => h.id));
      expect(before - (await gold(api, a.cityId))).toBeCloseTo(fresh.refreshCost, 0);
    }));

  it('refuses a city without an Inn', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('POST', `cities/${a.cityId}/tavern/refresh`, 'hero.needInn', { token: a.token, status: 400 });
    }));
});

describe('POST /cities/{cityId}/tavern/{heroId}/hire', () => {
  itGuards('POST', (c) => `cities/${c}/tavern/1/hire`);

  it('hires an offer', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await heroHall(api, a);
      const { heros } = await api.ok<{ heros: Hero[] }>('GET', `cities/${a.cityId}/tavern`, { token: a.token });
      const hero = await api.ok<Hero>('POST', `cities/${a.cityId}/tavern/${heros[0]!.id}/hire`, { token: a.token });
      expect(hero).toMatchObject({ id: heros[0]!.id, name: heros[0]!.name, cityId: a.cityId, status: HeroStatus.IDLE });
      expect(await heroRow(api, hero.id)).toMatchObject({ playerId: a.playerId, inTavern: false });
    }));

  it('refuses a malformed id, a hero not on offer and a full Feasting Hall', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await heroHall(api, a, 2, 1);
      const { heros } = await api.ok<{ heros: Hero[] }>('GET', `cities/${a.cityId}/tavern`, { token: a.token });
      await expectInvalid(api, a.token, [['POST', `cities/${a.cityId}/tavern/abc/hire`]]);
      const own = await addHero(api, a);
      await api.refused('POST', `cities/${a.cityId}/tavern/${heros[0]!.id}/hire`, 'hero.noVacancy', { token: a.token, status: 400 });
      await setBuildings(api, a, [[HALL, BuildingType.FEASTING_HALL, 3]]);
      await api.refused('POST', `cities/${a.cityId}/tavern/${own}/hire`, 'common.heroNotFound', { token: a.token, status: 404 });
    }));
});

describe('DELETE /cities/{cityId}/mayor', () => {
  itGuards('DELETE', (c) => `cities/${c}/mayor`);

  it('dismisses the mayor', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await api.ok('POST', `heroes/${id}/mayor`, { token: a.token });
      expect(await api.ok('DELETE', `cities/${a.cityId}/mayor`, { token: a.token })).toBeNull();
      expect((await heroRow(api, id))!.status).toBe(HeroStatus.IDLE);
    }));

  it('refuses a city without a mayor', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await api.refused('DELETE', `cities/${a.cityId}/mayor`, 'hero.noMayor', { token: a.token, status: 400 });
    }));
});

describe('POST /heroes/{heroId}/fire', () => {
  itGuardsHero('POST', (h) => `heroes/${h}/fire`);

  it('dismisses the hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      expect(await api.ok('POST', `heroes/${id}/fire`, { token: a.token })).toBeNull();
      expect(await heroRow(api, id)).toBeUndefined();
    }));

  it('refuses a malformed id and a locked hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['POST', 'heroes/x/fire'],
        ['POST', 'heroes/-2/fire'],
      ]);
      const id = await addHero(api, a);
      await patchHero(api, id, { locked: true });
      const r = await api.refused('POST', `heroes/${id}/fire`, 'hero.locked', { token: a.token, status: 400 });
      expect(r.body.ok).toBe(-80);
      expect(await heroRow(api, id)).toBeDefined();
    }));

  it('answers an id past the integer range as an unknown hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectClientError(api, a.token, 'POST', `heroes/${HUGE_ID}/fire`);
    }));
});

describe('PUT /cities/{cityId}/heroes/order', () => {
  itGuards('PUT', (c) => `cities/${c}/heroes/order`, { body: { heroIds: [] } });

  it("puts the city's heroes in the order given", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const first = await addHero(api, a);
      const second = await addHero(api, a);
      const list = await api.ok<{ heroes: Hero[] }>('PUT', `cities/${a.cityId}/heroes/order`, { token: a.token, body: { heroIds: [second, first] } });
      expect(list.heroes.map((h) => h.id)).toEqual([second, first]);
      expect((await api.ok<{ heros: Hero[] }>('GET', `cities/${a.cityId}`, { token: a.token })).heros.map((h) => h.id)).toEqual([second, first]);
    }));

  it('refuses a malformed body', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['PUT', `cities/${a.cityId}/heroes/order`, { body: {} }],
        ['PUT', `cities/${a.cityId}/heroes/order`, { body: { heroIds: ['x'] } }],
        ['PUT', `cities/${a.cityId}/heroes/order`, { body: { heroIds: Array.from({ length: 101 }, (_, i) => i) } }],
      ]);
    }));
});

describe('PUT /heroes/{heroId}/lock', () => {
  itGuardsHero('PUT', (h) => `heroes/${h}/lock`, { body: { locked: true } });

  it('locks and unlocks the hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      expect(await api.ok('PUT', `heroes/${id}/lock`, { token: a.token, body: { locked: true } })).toMatchObject({ id, locked: true });
      expect((await heroRow(api, id))!.locked).toBe(true);
      expect(await api.ok('PUT', `heroes/${id}/lock`, { token: a.token, body: { locked: false } })).toMatchObject({ id, locked: false });
    }));

  it('refuses a malformed body', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await expectInvalid(api, a.token, [['PUT', `heroes/${id}/lock`, { body: { locked: 'yes' } }]]);
    }));
});

describe('PUT /heroes/{heroId}/gear-stat', () => {
  itGuardsHero('PUT', (h) => `heroes/${h}/gear-stat`, { body: { stat: 'power' } });

  it('chooses the attribute the gear boosts', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      expect(await api.ok('PUT', `heroes/${id}/gear-stat`, { token: a.token, body: { stat: 'stratagem' } })).toMatchObject({ id, gearStat: 'stratagem' });
      expect((await api.ok<{ heros: { id: number; gearStat: string }[] }>('GET', `cities/${a.cityId}`, { token: a.token })).heros[0]!.gearStat).toBe(
        'stratagem',
      );
    }));

  it('refuses an unknown attribute', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await expectInvalid(api, a.token, [['PUT', `heroes/${id}/gear-stat`, { body: { stat: 'luck' } }]]);
    }));
});

describe('GET /gear', () => {
  itNeedsPlayer('GET', 'gear');

  it("answers the lord's gear", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      expect(await api.ok('GET', 'gear', { token: a.token })).toEqual({ level: 0, stars: {} });
      await setResearch(api, a, TechType.HERO_ENHANCEMENT, 2);
      expect(await api.ok('GET', 'gear', { token: a.token })).toEqual({ level: 2, stars: {} });
    }));
});

describe('POST /gear/{pieceId}/star', () => {
  itNeedsPlayer('POST', 'gear/weapon/star');

  it('adds a star for a medal', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResearch(api, a, TechType.HERO_ENHANCEMENT, 1);
      const cost = gearStarCost(1);
      await giveItems(api, a, { [cost.itemId]: cost.count });
      expect(await api.ok('POST', 'gear/weapon/star', { token: a.token })).toEqual({ level: 1, stars: { weapon: 1 } });
      expect((await items(api, a))[cost.itemId]).toBeUndefined();
    }));

  it('refuses an unknown piece and a lord without medals', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResearch(api, a, TechType.HERO_ENHANCEMENT, 1);
      await api.refused('POST', 'gear/hat/star', 'hero.invalidGearPiece', { token: a.token, status: 400 });
      const r = await api.refused('POST', 'gear/weapon/star', 'hero.notEnoughMedals', { token: a.token, status: 400 });
      expect(r.body.error?.params).toEqual({ item: { ref: 'item', id: medalId(1) }, amount: gearStarCost(1).count });
    }));
});

describe('POST /heroes/{heroId}/mayor', () => {
  itGuardsHero('POST', (h) => `heroes/${h}/mayor`);

  it('appoints the mayor, replacing the last one', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const first = await addHero(api, a);
      const second = await addHero(api, a);
      expect(await api.ok('POST', `heroes/${first}/mayor`, { token: a.token })).toBeNull();
      expect(await api.ok('POST', `heroes/${second}/mayor`, { token: a.token })).toBeNull();
      expect((await heroRow(api, first))!.status).toBe(HeroStatus.IDLE);
      expect((await heroRow(api, second))!.status).toBe(HeroStatus.MAYOR);
    }));

  it('refuses a hero away from the city', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await patchHero(api, id, { status: HeroStatus.ATTACK });
      const r = await api.refused('POST', `heroes/${id}/mayor`, 'hero.notIdle', { token: a.token, status: 400 });
      expect(r.body.ok).toBe(-80);
    }));
});

describe('POST /heroes/{heroId}/reset', () => {
  itGuardsHero('POST', (h) => `heroes/${h}/reset`);

  it('resets the points with Holy Water', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      const h = await readHero(api, id);
      await patchHero(api, id, { power: h.basePower + h.remainPoint, remainPoint: 0 });
      await giveItems(api, a, { [ItemId.HOLY_WATER]: 1 });
      const bean = await api.ok<Hero>('POST', `heroes/${id}/reset`, { token: a.token });
      expect(bean).toMatchObject({ id, power: h.basePower, management: h.baseManagement, stratagem: h.baseStratagem, remainPoint: h.level });
      expect((await items(api, a))[ItemId.HOLY_WATER]).toBeUndefined();
    }));

  it('refuses a hero away from the city', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await patchHero(api, id, { status: HeroStatus.RETURN });
      await api.refused('POST', `heroes/${id}/reset`, 'hero.notIdle', { token: a.token, status: 400 });
    }));
});

describe('POST /heroes/{heroId}/points', () => {
  const unchanged = { power: 0, management: 0, stratagem: 0 };
  itGuardsHero('POST', (h) => `heroes/${h}/points`, { body: unchanged });

  it('assigns the free points', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      const h = await patchHero(api, id, {
        level: 3,
        remainPoint: 3,
        power: 10,
        management: 10,
        stratagem: 10,
        basePower: 10,
        baseManagement: 10,
        baseStratagem: 10,
      });
      const bean = await api.ok('POST', `heroes/${id}/points`, { token: a.token, body: { power: 12, management: 11, stratagem: h.stratagem } });
      expect(bean).toMatchObject({ id, power: 12, management: 11, stratagem: 10, remainPoint: 0 });
      expect(await heroRow(api, id)).toMatchObject({ power: 12, management: 11, remainPoint: 0 });
    }));

  it('refuses a malformed body and lower or too many points', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await patchHero(api, id, { level: 3, remainPoint: 3, power: 10, management: 10, stratagem: 10, basePower: 10, baseManagement: 10, baseStratagem: 10 });
      await expectInvalid(api, a.token, [
        ['POST', `heroes/${id}/points`, { body: { power: 11, management: 10 } }],
        ['POST', `heroes/${id}/points`, { body: { power: '11', management: 10, stratagem: 10 } }],
      ]);
      await api.refused('POST', `heroes/${id}/points`, 'hero.invalidPoints', {
        token: a.token,
        body: { power: 9, management: 10, stratagem: 10 },
        status: 400,
      });
      await api.refused('POST', `heroes/${id}/points`, 'hero.invalidPoints', {
        token: a.token,
        body: { power: 14, management: 10, stratagem: 10 },
        status: 400,
      });
    }));
});

describe('POST /heroes/{heroId}/level-up', () => {
  itGuardsHero('POST', (h) => `heroes/${h}/level-up`);

  it('levels up with the experience the hero has', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      const h = await readHero(api, id);
      await patchHero(api, id, { experience: h.upgradeExp });
      const bean = await api.ok<Hero>('POST', `heroes/${id}/level-up`, { token: a.token });
      expect(bean.level).toBeGreaterThan(h.level);
      expect((await heroRow(api, id))!.level).toBe(bean.level);
    }));

  it('refuses a hero without the experience', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await patchHero(api, id, { experience: 0 });
      await api.refused('POST', `heroes/${id}/level-up`, 'hero.notEnoughExperience', { token: a.token, status: 400 });
    }));
});

describe('POST /heroes/{heroId}/reward', () => {
  itGuardsHero('POST', (h) => `heroes/${h}/reward`);

  it('adds loyalty for gold', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await setResources(api, a, RICH);
      const id = await addHero(api, a);
      await patchHero(api, id, { loyalty: 60 });
      const before = await gold(api, a.cityId);
      expect(await api.ok('POST', `heroes/${id}/reward`, { token: a.token })).toMatchObject({ id, loyalty: 65 });
      expect(await gold(api, a.cityId)).toBeLessThan(before);
    }));

  it('refuses a fully loyal hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await patchHero(api, id, { loyalty: 100 });
      await api.refused('POST', `heroes/${id}/reward`, 'hero.fullyLoyal', { token: a.token, status: 400 });
    }));
});

describe('POST /heroes/{heroId}/items', () => {
  itGuardsHero('POST', (h) => `heroes/${h}/items`, { body: { itemId: ItemId.ANABASIS } });

  it('uses an experience book on the hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await patchHero(api, id, { experience: 0 });
      await giveItems(api, a, { [ItemId.ANABASIS]: 1 });
      const bean = await api.ok<Hero>('POST', `heroes/${id}/items`, { token: a.token, body: { itemId: ItemId.ANABASIS } });
      expect(bean.experience).toBeGreaterThan(0);
      expect((await items(api, a))[ItemId.ANABASIS]).toBeUndefined();
    }));

  it('refuses a malformed body, an item that is not for heroes and a medal bought with gold', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await expectInvalid(api, a.token, [
        ['POST', `heroes/${id}/items`, { body: {} }],
        ['POST', `heroes/${id}/items`, { body: { itemId: ItemId.ANABASIS, payWith: 'gems' } }],
      ]);
      await api.refused('POST', `heroes/${id}/items`, 'hero.invalidItem', { token: a.token, body: { itemId: ItemId.HOLY_WATER }, status: 400 });
      await api.refused('POST', `heroes/${id}/items`, 'hero.itemNotForGold', { token: a.token, body: { itemId: medalId(1), payWith: 'gold' }, status: 400 });
    }));
});

describe('PATCH /heroes/{heroId}', () => {
  itGuardsHero('PATCH', (h) => `heroes/${h}`, { body: { name: 'Aldric' } });

  it('renames the hero', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      expect(await api.ok('PATCH', `heroes/${id}`, { token: a.token, body: { name: '  Aldric   the Bold ' } })).toMatchObject({ id, name: 'Aldric the Bold' });
      expect((await heroRow(api, id))!.name).toBe('Aldric the Bold');
    }));

  it('refuses a malformed body and a bad name', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const id = await addHero(api, a);
      await expectInvalid(api, a.token, [['PATCH', `heroes/${id}`, { body: { name: 5 } }]]);
      const r = await api.refused('PATCH', `heroes/${id}`, 'common.nameLength', { token: a.token, body: { name: '   ' }, status: 400 });
      expect(r.body).toMatchObject({ ok: -87, error: { params: { min: 1, max: 20 } } });
    }));
});
