// Research routes (src/routes/cities.ts): the technology list, start, cancel and speed up. The rules are covered
// by the research service tests.

import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BuildingType, SpeedupId, TechType } from '@marchlands/core';
import { cities, players } from '@marchlands/db';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { expectInvalid, itGuards, type Lord, lords, RICH, setBuildings, setResources } from '#test/support/city-fixtures.ts';

const playerRow = async (api: TestApi, id: number) => (await api.db.select().from(players).where(eq(players.id, id)))[0];
const gold = async (api: TestApi, cityId: number) => (await api.db.select({ gold: cities.gold }).from(cities).where(eq(cities.id, cityId)))[0].gold;

/** An Academy, the Farm and Sawmill Agriculture and Lumbering need, and the resources to research. */
async function academy(api: TestApi, p: Lord) {
  await setBuildings(api, p, [
    [3, BuildingType.ACADEMY, 5],
    [1001, BuildingType.FARM, 1],
    [1002, BuildingType.SAWMILL, 1],
  ]);
  await setResources(api, p, RICH);
}

const start = (api: TestApi, p: Lord, techId: number) =>
  api.ok<{ endTime: number }>('POST', `cities/${p.cityId}/research`, { token: p.token, body: { techId } });

describe('GET /cities/{cityId}/research', () => {
  itGuards('GET', (c) => `cities/${c}/research`);

  it("lists the technologies and the city's research", () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await academy(api, a);
      await start(api, a, TechType.AGRICULTURE);
      const list = await api.ok<{ techs: { typeId: number }[] }>('GET', `cities/${a.cityId}/research`, { token: a.token });
      expect(list).toMatchObject({ academyLevel: 5, researching: TechType.AGRICULTURE, researchingIds: [TechType.AGRICULTURE], slots: expect.any(Number) });
      expect(list.techs.find((t) => t.typeId === TechType.AGRICULTURE)).toMatchObject({
        level: 0,
        upgrading: true,
        castleId: a.cityId,
        description: { code: expect.any(String) },
        next: expect.objectContaining({ time: expect.any(Number) }),
      });
    }));
});

describe('POST /cities/{cityId}/research', () => {
  itGuards('POST', (c) => `cities/${c}/research`, { body: { techId: TechType.AGRICULTURE } });

  it('starts a research for the player', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await academy(api, a);
      const r = await start(api, a, TechType.AGRICULTURE);
      expect(r).toMatchObject({ typeId: TechType.AGRICULTURE, level: 0, castleId: a.cityId, startTime: expect.any(Number) });
      expect(r.endTime).toBeGreaterThan(Date.now());
      expect((await playerRow(api, a.playerId)).research[TechType.AGRICULTURE]).toMatchObject({ level: 0, cityId: a.cityId, endTime: r.endTime });
    }));

  it('refuses a malformed body, a city without an Academy and a research already running', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/research`, { body: {} }],
        ['POST', `cities/${a.cityId}/research`, { body: { techId: 'farming' } }],
      ]);
      await api.refused('POST', `cities/${a.cityId}/research`, 'building.academyNeeded', {
        token: a.token,
        body: { techId: TechType.AGRICULTURE },
        status: 400,
      });
      await academy(api, a);
      await start(api, a, TechType.AGRICULTURE);
      const r = await api.refused('POST', `cities/${a.cityId}/research`, 'research.alreadyResearching', {
        token: a.token,
        body: { techId: TechType.AGRICULTURE },
        status: 400,
      });
      expect(r.body.error?.params).toEqual({ tech: { ref: 'tech', id: TechType.AGRICULTURE } });
    }));
});

describe('DELETE /cities/{cityId}/research', () => {
  itGuards('DELETE', (c) => `cities/${c}/research`);

  it('cancels the research picked by techId (or the only one)', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await academy(api, a);
      await start(api, a, TechType.AGRICULTURE);
      await start(api, a, TechType.LUMBERING);
      expect(await api.ok('DELETE', `cities/${a.cityId}/research`, { token: a.token, query: { techId: String(TechType.LUMBERING) } })).toBeNull();
      const research = (await playerRow(api, a.playerId)).research;
      expect(research[TechType.LUMBERING]).toEqual({ level: 0 });
      expect(research[TechType.AGRICULTURE].endTime).toBeGreaterThan(0);
      expect(await api.ok('DELETE', `cities/${a.cityId}/research`, { token: a.token })).toBeNull();
      expect((await playerRow(api, a.playerId)).research[TechType.AGRICULTURE]).toEqual({ level: 0 });
    }));

  it('refuses a malformed techId and a city with nothing to cancel', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['DELETE', `cities/${a.cityId}/research`, { query: { techId: 'x' } }]]);
      await api.refused('DELETE', `cities/${a.cityId}/research`, 'research.noResearch', { token: a.token, status: 400 });
    }));
});

describe('GET /cities/{cityId}/research/speedup', () => {
  // the cost is read from the caller's own research, so another player's city has none running
  itGuards('GET', (c) => `cities/${c}/research/speedup`, { refusedForOther: { code: 'research.noResearch', status: 400 } });

  it('answers the gold to finish now; techId picks one of two', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await academy(api, a);
      await start(api, a, TechType.AGRICULTURE);
      const cost = await api.ok<{ goldNeed: number; timeLeft: number }>('GET', `cities/${a.cityId}/research/speedup`, { token: a.token });
      expect(cost.goldNeed).toBeGreaterThan(0);
      expect(cost.timeLeft).toBeGreaterThan(0);
      await start(api, a, TechType.LUMBERING);
      await api.refused('GET', `cities/${a.cityId}/research/speedup`, 'research.chooseResearch', { token: a.token, status: 400 });
      const picked = await api.ok('GET', `cities/${a.cityId}/research/speedup`, { token: a.token, query: { techId: String(TechType.LUMBERING) } });
      expect(picked).toEqual({ goldNeed: expect.any(Number), timeLeft: expect.any(Number) });
    }));

  it('refuses a malformed techId', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [['GET', `cities/${a.cityId}/research/speedup`, { query: { techId: '1.5' } }]]);
    }));
});

describe('POST /cities/{cityId}/research/speedup', () => {
  itGuards('POST', (c) => `cities/${c}/research/speedup`, { body: { itemId: SpeedupId.GOLD } });

  it('finishes the research now for gold', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await academy(api, a);
      const started = await start(api, a, TechType.AGRICULTURE);
      const before = await gold(api, a.cityId);
      const r = await api.ok<{ endTime: number }>('POST', `cities/${a.cityId}/research/speedup`, {
        token: a.token,
        body: { itemId: SpeedupId.GOLD, techId: TechType.AGRICULTURE },
      });
      expect(r.endTime).toBeLessThan(started.endTime);
      expect(r.endTime).toBeLessThanOrEqual(Date.now());
      expect(await gold(api, a.cityId)).toBeLessThan(before);
    }));

  it('refuses a malformed body, an unknown speed-up and a city with nothing to speed up', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['POST', `cities/${a.cityId}/research/speedup`, { body: {} }],
        ['POST', `cities/${a.cityId}/research/speedup`, { body: { itemId: SpeedupId.GOLD, techId: 'x' } }],
      ]);
      await api.refused('POST', `cities/${a.cityId}/research/speedup`, 'research.noResearch', {
        token: a.token,
        body: { itemId: SpeedupId.GOLD },
        status: 400,
      });
      await academy(api, a);
      await start(api, a, TechType.AGRICULTURE);
      await api.refused('POST', `cities/${a.cityId}/research/speedup`, 'common.invalidSpeedup', { token: a.token, body: { itemId: 'bogus' }, status: 400 });
    }));
});
