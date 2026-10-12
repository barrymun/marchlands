// Set-up for the city and military route tests: players whose names are known (the admin tools find players by
// name), and city state made with the game's own code (the admin service and the repo), never with hand-written
// rows. See api.ts for the harness.

import { expect, it } from 'vitest';
import type { ResourceSet } from '@marchlands/core';
import { admin, alliance, runGame } from '@marchlands/game';
import { getArmy, getHero, getTile, processArmy, saveHero, saveTile, type HeroRow, type TileRow } from '@marchlands/game/testing';
import { apiTest, type Session, type TestApi } from '#test/support/api.ts';

let serial = 0;

/** A player made through the API (account, player, starting city) with the name the admin tools know it by. */
export type Lord = Session & { playerId: number; cityId: number; name: string };

export const RICH: ResourceSet = { gold: 10_000_000, food: 10_000_000, wood: 10_000_000, stone: 10_000_000, iron: 10_000_000 };

/** The operator first (the first account of a test), then `n` ordinary players. */
export async function lords(api: TestApi, n: number): Promise<Lord[]> {
  await api.operator();
  const out: Lord[] = [];
  for (let i = 0; i < n; i++) {
    const name = `Lord${++serial}x${i}`;
    out.push({ ...(await api.player(name)), name });
  }
  return out;
}

/** Put buildings in a city: [positionId, typeId, level]. Town Hall is position -1, Walls -2. */
export const setBuildings = (api: TestApi, p: Lord, list: [positionId: number, typeId: number, level: number][], cityId = p.cityId) =>
  api.game(async (ctx) => {
    for (const [pos, type, level] of list) await admin.setBuilding(ctx, cityId, p.playerId, pos, type, level);
  });

export const setResources = (api: TestApi, p: Lord, res: Partial<ResourceSet> = RICH, cityId = p.cityId) =>
  api.game((ctx) => admin.setResources(ctx, cityId, p.playerId, res));

export const setCityStats = (api: TestApi, p: Lord, stats: { population?: number; troops?: Record<string, number> }, cityId = p.cityId) =>
  api.game((ctx) => admin.setCityStats(ctx, cityId, p.playerId, stats));

export const giveItems = (api: TestApi, p: Lord, items: Record<string, number>) => api.game((ctx) => admin.grantItems(ctx, p.name, items));

export const setResearch = (api: TestApi, p: Lord, techId: number, level: number) => api.game((ctx) => admin.setTechnology(ctx, p.name, techId, level));

/** Beginner protection off, so the player can attack and be attacked. */
export const atWar = (api: TestApi, p: Lord) => api.game((ctx) => admin.setPlayerFlags(ctx, p.name, { beginner: false }));

/** A hired hero in the city; returns its id. */
export const addHero = (api: TestApi, p: Lord, cityId = p.cityId) => api.game((ctx) => admin.addHero(ctx, cityId, p.playerId, 1));

/** Change a stored hero through the repo (as the game service tests do). */
export const patchHero = (api: TestApi, id: number, fields: Partial<HeroRow>) =>
  api.game(async (ctx) => {
    const h = await getHero(ctx, id);
    Object.assign(h, fields);
    await saveHero(ctx, h);
    return getHero(ctx, id);
  });

export const readHero = (api: TestApi, id: number) => api.game((ctx) => getHero(ctx, id));

/** Change a stored tile through the repo (e.g. a valley held by a city, as a won battle leaves it). */
export const patchTile = (api: TestApi, id: number, fields: Partial<TileRow>) =>
  api.game(async (ctx) => {
    const t = await getTile(ctx, id);
    Object.assign(t, fields);
    await saveTile(ctx, t);
    return getTile(ctx, id);
  });

/** a and b in one alliance (each needs an Embassy). */
export const allies = (api: TestApi, a: Lord, b: Lord) =>
  api.game(async (ctx) => {
    const name = `Alliance ${a.playerId}`;
    await alliance.createAlliance(ctx, a.playerId, a.cityId, name);
    await alliance.invite(ctx, a.playerId, b.name);
    await alliance.acceptInvite(ctx, b.playerId, name);
  });

/** Run an army's timed event at its reach time (arrival, or getting home), as the worker would. */
export async function arrive(api: TestApi, armyId: number) {
  const a = await api.game((ctx) => getArmy(ctx, armyId));
  if (!a) throw new Error(`army ${armyId} is gone`);
  await runGame(api.db, (ctx) => processArmy(ctx, armyId), { now: Math.max(Date.now(), a.reachTime), retries: 0 });
}

export type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type Send = { body?: unknown; query?: Record<string, string> };

/** No token (or a bad one) is 401 auth.notLoggedIn; an account without a player is 404 auth.needPlayer. */
async function expectNeedsPlayer(api: TestApi, method: Method, url: string, send: Send) {
  for (const token of [undefined, 'not-a-token']) {
    const r = await api.call(method, url, { ...send, token });
    expect(r.status, `${method} ${url} with token ${token}`).toBe(401);
    expect(r.body).toMatchObject({ ok: -2, error: { code: 'auth.notLoggedIn' } });
  }
  const noPlayer = await api.register();
  const r = await api.call(method, url, { ...send, token: noPlayer.token });
  expect(r.status).toBe(404);
  expect(r.body).toMatchObject({ ok: -4, error: { code: 'auth.needPlayer' } });
}

/**
 * The checks every route of a player shares: no token (or a bad one) is 401, an account without a player is 404
 * auth.needPlayer. City routes (`url` builds the path for a city) also refuse another player's city with 403
 * common.invalidCastle (or `refusedForOther`) and an unknown one with 404 common.cityNotFound; `city: false` skips
 * those. `body` may depend on the city (when the city is in the body).
 */
export function itGuards(
  method: Method,
  url: (cityId: number) => string,
  opts: {
    body?: unknown;
    bodyFor?: (cityId: number) => unknown;
    query?: Record<string, string>;
    city?: boolean;
    refusedForOther?: { code: string; status: number };
  } = {},
) {
  const city = opts.city ?? true;
  const send = (cityId: number): Send => ({ body: opts.bodyFor ? opts.bodyFor(cityId) : opts.body, query: opts.query });
  it(city ? 'needs a token and a player, and refuses a city of another player' : 'needs a token and a player', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      await expectNeedsPlayer(api, method, url(a.cityId), send(a.cityId));
      if (!city) return;
      const other = opts.refusedForOther ?? { code: 'common.invalidCastle', status: 403 };
      const r = await api.call(method, url(b.cityId), { ...send(b.cityId), token: a.token });
      expect(r.status).toBe(other.status);
      expect(r.body).toMatchObject({ ok: expect.any(Number), error: { code: other.code } });
      if (!opts.refusedForOther) {
        const r2 = await api.call(method, url(2_000_000_000), { ...send(2_000_000_000), token: a.token });
        expect(r2.status).toBe(404);
        expect(r2.body.error?.code).toBe('common.cityNotFound');
      }
    }),
  );
}

/**
 * The same for hero routes (`url` builds the path for a hero): another player's hero and an unknown one are 404
 * common.heroNotFound (or `refusedForOther`).
 */
export function itGuardsHero(
  method: Method,
  url: (heroId: number) => string,
  opts: { body?: unknown; refusedForOther?: { code: string; status: number } } = {},
) {
  it("needs a token and a player, and refuses another player's hero", () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const mine = await addHero(api, a);
      const theirs = await addHero(api, b);
      await expectNeedsPlayer(api, method, url(mine), { body: opts.body });
      const other = opts.refusedForOther ?? { code: 'common.heroNotFound', status: 404 };
      for (const id of [theirs, 2_000_000_000]) {
        const r = await api.call(method, url(id), { body: opts.body, token: a.token });
        expect(r.status, `hero ${id}`).toBe(id === theirs ? other.status : 404);
        expect(r.body.error?.code).toBe(id === theirs ? other.code : 'common.heroNotFound');
      }
      expect(await readHero(api, theirs)).toMatchObject({ playerId: b.playerId, cityId: b.cityId });
    }));
}

/** Routes of a player that name no city or hero: only the token and the player are checked. */
export const itNeedsPlayer = (method: Method, url: string, send: Send = {}) =>
  it('needs a token and a player', () =>
    apiTest(async (api) => {
      await lords(api, 0);
      await expectNeedsPlayer(api, method, url, send);
    }));

/** Each of the requests is refused before reaching the game with 400 common.invalidRequest and its issues. */
export async function expectInvalid(
  api: TestApi,
  token: string,
  requests: [method: Method, url: string, opts?: { body?: unknown; query?: Record<string, string> }][],
) {
  for (const [method, url, opts] of requests) {
    const r = await api.call(method, url, { ...opts, token });
    expect(r.status, `${method} ${url} ${JSON.stringify(opts ?? {})}`).toBe(400);
    expect(r.body).toMatchObject({ ok: -87, error: { code: 'common.invalidRequest' }, issues: expect.any(Array) });
  }
}

/**
 * The request is answered as a client error (4xx), never a server error. Ids past Postgres' integer range should be
 * answered like any unknown id.
 */
export async function expectClientError(api: TestApi, token: string, method: Method, url: string, body?: unknown) {
  const r = await api.call(method, url, { token, body });
  expect(r.status, `${method} ${url} answered ${r.status} ${JSON.stringify(r.body)}`).toBeGreaterThanOrEqual(400);
  expect(r.status, `${method} ${url} answered ${r.status} ${JSON.stringify(r.body)}`).toBeLessThan(500);
}

/** An id past Postgres' integer range (zId has no upper bound). */
export const HUGE_ID = 9_999_999_999;
