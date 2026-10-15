// Map routes (src/routes/military.ts): the map view, tile details and the tile search. They need a token but no
// player: an account without one sees the map with no relations. The rules are covered by the world service tests.

import { and, between, eq, isNull, ne } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { BALANCE, Relation, TileType, tileXY, valleyUpgradeCost } from '@marchlands/core';
import { cities, tiles } from '@marchlands/db';

import { apiTest, type TestApi } from '#test/support/api.ts';
import { expectInvalid, type Lord, lords, patchTile } from '#test/support/city-fixtures.ts';

type Castle = { id: number; cityId?: number; playerId?: number; relation?: number; name?: string };
type Tile = { id: number; type: number; level: number; cityId: number | null; ownerCityId: number | null; x: number; y: number };

const where = async (api: TestApi, p: Lord) => {
  const [c] = await api.db.select({ tileId: cities.tileId }).from(cities).where(eq(cities.id, p.cityId));
  return { tileId: c.tileId, x: c.tileId % BALANCE.mapSize, y: Math.floor(c.tileId / BALANCE.mapSize) };
};
const area = (x: number, y: number, r: number) => ({ x1: String(x - r), y1: String(y - r), x2: String(x + r), y2: String(y + r) });

/** A token is needed; an account without a player is served (as a viewer with no relations). */
async function expectTokenOnly(api: TestApi, url: string, query?: Record<string, string>) {
  for (const token of [undefined, 'not-a-token']) {
    const r = await api.call('GET', url, { query, token });
    expect(r.status).toBe(401);
    expect(r.body.error?.code).toBe('auth.notLoggedIn');
  }
  const noPlayer = await api.register();
  return api.ok('GET', url, { query, token: noPlayer.token });
}

describe('GET /map', () => {
  it('needs a token, not a player', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const { x, y } = await where(api, a);
      const view = await expectTokenOnly(api, 'map', area(x, y, 1));
      expect(view).toMatchObject({ castles: expect.arrayContaining([expect.objectContaining({ cityId: a.cityId, relation: Relation.NO_RELATION })]) });
    }));

  it('answers the tiles and castles of an area, with relations to the viewer', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const { tileId, x, y } = await where(api, a);
      const view = await api.ok<{ mapStr: string; castles: Castle[] }>('GET', 'map', { token: a.token, query: area(x, y, 2) });
      expect(view).toMatchObject({ x1: x - 2, y1: y - 2, x2: x + 2, y2: y + 2, valleys: [] });
      expect(view.mapStr).toHaveLength(5 * 5 * 2);
      // the centre tile (row 2, column 2) is a's castle
      expect(view.mapStr.slice(24, 26)).toBe(`${TileType.CASTLE.toString(16)}1`);
      expect(view.castles).toContainEqual(
        expect.objectContaining({ id: tileId, cityId: a.cityId, playerId: a.playerId, name: `${a.name} City`, relation: Relation.SELF }),
      );
      const seen = await api.ok<{ castles: Castle[] }>('GET', 'map', { token: b.token, query: area(x, y, 0) });
      expect(seen.castles).toEqual([expect.objectContaining({ cityId: a.cityId, relation: Relation.NO_RELATION, canScout: expect.any(Boolean) })]);
    }));

  it('refuses a malformed query and an area too large', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['GET', 'map', { query: { x1: '0', y1: '0', x2: '5' } }],
        ['GET', 'map', { query: { x1: 'a', y1: '0', x2: '5', y2: '5' } }],
      ]);
      const big = await api.call('GET', 'map', { token: a.token, query: { x1: '0', y1: '0', x2: '21', y2: '0' } });
      expect(big.status).toBe(400);
      expect(big.body).toMatchObject({ ok: -1, error: { code: 'world.areaTooLarge', params: { max: 21 } } });
      const inverted = await api.call('GET', 'map', { token: a.token, query: { x1: '5', y1: '0', x2: '4', y2: '0' } });
      expect(inverted.status).toBe(400);
      expect(inverted.body).toMatchObject({ ok: -1, error: { code: 'world.invalidArea' } });
    }));
});

describe('GET /map/tiles/{tileId}', () => {
  it('needs a token, not a player', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const { tileId } = await where(api, a);
      expect(await expectTokenOnly(api, `map/tiles/${tileId}`)).toMatchObject({
        id: tileId,
        type: TileType.CASTLE,
        cityId: a.cityId,
        relation: Relation.NO_RELATION,
      });
    }));

  it('answers a castle tile and a valley tile', () =>
    apiTest(async (api) => {
      const [a, b] = await lords(api, 2);
      const { tileId, x, y } = await where(api, a);
      expect(await api.ok('GET', `map/tiles/${tileId}`, { token: a.token })).toMatchObject({
        id: tileId,
        x,
        y,
        type: TileType.CASTLE,
        cityId: a.cityId,
        playerId: a.playerId,
        relation: Relation.SELF,
      });
      // terrain comes in regions, so a city may have no grass nearby: make a free tile next to it a level 3 grass valley
      const [free] = await api.db
        .select({ id: tiles.id })
        .from(tiles)
        .where(and(between(tiles.id, tileId - 40, tileId + 40), isNull(tiles.cityId), isNull(tiles.ownerCityId), ne(tiles.type, TileType.NPC)))
        .limit(1);
      await patchTile(api, free.id, { type: TileType.GRASS, level: 3 });
      const at = tileXY(free.id);
      const found = await api.ok<Tile[]>('GET', 'map/search', {
        token: a.token,
        query: { x: String(at.x), y: String(at.y), radius: '1', type: String(TileType.GRASS) },
      });
      const valley = found.find((t) => t.id === free.id);
      expect(valley).toMatchObject({ type: TileType.GRASS, level: 3, cityId: null, ownerCityId: null });
      expect(await api.ok('GET', `map/tiles/${free.id}`, { token: a.token })).toMatchObject({
        id: free.id,
        type: TileType.GRASS,
        level: 3,
        npc: false,
        owner: null,
        upgradeCost: valleyUpgradeCost(3),
      });
      // at the top level there is nothing left to upgrade
      await patchTile(api, free.id, { level: BALANCE.valleyUpgrade.maxLevel });
      expect(await api.ok('GET', `map/tiles/${free.id}`, { token: a.token })).toMatchObject({ owner: null, upgradeCost: null });
      await patchTile(api, free.id, { ownerCityId: b.cityId, ownerPlayerId: b.playerId });
      expect(await api.ok('GET', `map/tiles/${free.id}`, { token: a.token })).toMatchObject({
        owner: { cityId: b.cityId, playerId: b.playerId, userName: b.name, cityName: `${b.name} City` },
        upgradeCost: null,
      });
    }));

  it('refuses a malformed id and a tile off the map', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['GET', 'map/tiles/x'],
        ['GET', 'map/tiles/-1'],
      ]);
      await api.refused('GET', `map/tiles/${BALANCE.mapSize ** 2}`, 'world.invalidTile', { token: a.token, status: 400 });
    }));
});

describe('GET /map/search', () => {
  it('needs a token, not a player', () =>
    apiTest(async (api) => {
      await lords(api, 0);
      expect(await expectTokenOnly(api, 'map/search', { x: '100', y: '100', type: String(TileType.FLAT) })).toEqual(expect.any(Array));
    }));

  it('finds tiles of a type near a point', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      const { x, y } = await where(api, a);
      const found = await api.ok<Tile[]>('GET', 'map/search', {
        token: a.token,
        query: { x: String(x), y: String(y), radius: '3', type: String(TileType.CASTLE) },
      });
      expect(found).toContainEqual({
        id: (await where(api, a)).tileId,
        type: TileType.CASTLE,
        level: expect.any(Number),
        ownerCityId: null,
        cityId: a.cityId,
        x,
        y,
      });
      for (const t of found) {
        expect(Math.abs(t.x - x)).toBeLessThanOrEqual(3);
        expect(Math.abs(t.y - y)).toBeLessThanOrEqual(3);
      }
    }));

  it('refuses a malformed query', () =>
    apiTest(async (api) => {
      const [a] = await lords(api, 1);
      await expectInvalid(api, a.token, [
        ['GET', 'map/search', { query: { x: '1', y: '1' } }],
        ['GET', 'map/search', { query: { x: 'east', y: '1', type: '5' } }],
      ]);
    }));
});
