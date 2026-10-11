import { describe, expect, it, vi } from 'vitest';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { BALANCE, msg, Relation, stateBounds, stateOf, TileType, tileId, tileXY, valleyUpgradeCost } from '@marchlands/core';
import { tiles, worldState, type Db } from '@marchlands/db';
import { alliance, getTile, saveTile, world } from '../../src/index.ts';
import { testDb } from '../support/db.ts';
import { expectRefused } from '../support/expect.ts';
import { createTestPlayer, reloadCity, setResources, setTownHall, type TestPlayer } from '../support/factories.ts';
import { game, type TestGame } from '../support/game.ts';

const { MAP_VIEW_MAX } = world;
const SIZE = BALANCE.mapSize;
const VALLEYS = [TileType.FOREST, TileType.DESERT, TileType.HILL, TileType.SWAMP, TileType.GRASS, TileType.LAKE];

// refreshZoneStats / zoneStats take a Db; the game transaction serves as one, so what they write is rolled back too
const asDb = (g: TestGame) => g.tx as unknown as Db;

const hex = (n: number) => n.toString(16);

/** Where a player's city stands. */
async function cityTile(g: TestGame, p: TestPlayer) {
  const c = await reloadCity(g, p.cityId);
  return { id: c.tileId, ...tileXY(c.tileId), name: c.name };
}

/** A free tile of one of `types` near (x, y) (the map is seeded, so there is always one). */
async function freeTileNear(g: TestGame, x: number, y: number, types: readonly number[]) {
  for (const type of types) {
    const found = (await world.searchTiles(g, x, y, 10, type)).find((t) => t.cityId == null && t.ownerCityId == null);
    if (found) return getTile(g, found.id);
  }
  throw new Error('no free tile near');
}

/** Hand a valley to a player's city, as occupying it does. */
async function holdValley(g: TestGame, p: TestPlayer) {
  const c = await cityTile(g, p);
  const t = await freeTileNear(g, c.x, c.y, VALLEYS);
  await saveTile(g, { ...t, ownerCityId: p.cityId, ownerPlayerId: p.id });
  return getTile(g, t.id);
}

/** Each player founds an alliance; `a`'s alliance then sets its relation towards `b`'s. */
async function allied(g: TestGame, a: TestPlayer, b: TestPlayer, relation: number) {
  for (const p of [a, b]) {
    await setResources(g, p, { gold: BALANCE.allianceCreateGold });
    await alliance.createAlliance(g, p.id, p.cityId, `Band ${p.id}`);
  }
  await alliance.setRelation(g, a.id, `Band ${b.id}`, relation);
}

/** The map string the original sends for these tiles, from the stored rows (castles drawn at their Town Hall level). */
async function expectedMapStr(g: TestGame, ids: number[], castleLevel: (cityId: number) => number) {
  let s = '';
  for (const id of ids) {
    const t = await getTile(g, id);
    s += t.cityId != null ? hex(TileType.CASTLE) + hex(castleLevel(t.cityId)) : hex(t.type) + hex(t.level);
  }
  return s;
}

const area = (x1: number, y1: number, x2: number, y2: number) => {
  const ids: number[] = [];
  for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) ids.push(tileId(x, y));
  return ids;
};

describe(world.getWorldInfo.name, () => {
  it('describes the seeded map', () =>
    game(async (g) => {
      const info = await world.getWorldInfo(g.tx);
      expect(info).toMatchObject({ mapSize: SIZE });
      expect(['generated', 'legacy']).toContain(info!.source);
    }));
});

describe(world.ensureWorld.name, () => {
  it('leaves a seeded world as it is', async () => {
    const before = await game((g) => world.getWorldInfo(g.tx));
    const log = vi.fn();
    expect(await world.ensureWorld(testDb(), { source: 'generated', seed: 'another seed', log })).toEqual(before);
    expect(log).not.toHaveBeenCalled();
  });
});

describe(world.refreshZoneStats.name, () => {
  it('counts the castles, barbarian cities and open flats of each zone', () =>
    game(async (g) => {
      const stats = await world.refreshZoneStats(asDb(g));
      expect(stats.map((s) => s.id)).toEqual(Array.from({ length: BALANCE.stateGrid ** 2 }, (_, i) => i));
      const [{ open }] = (
        await g.tx.execute<{ open: number }>(
          sql`select count(*)::int as open from tiles where type = ${TileType.FLAT} and city_id is null and owner_city_id is null`,
        )
      ).rows;
      expect(stats.reduce((n, s) => n + s.openFlats, 0)).toBe(Number(open));
      for (const s of stats) {
        expect(s.castleCount).toBeGreaterThanOrEqual(s.playerCount);
        expect(s.settled).toBeGreaterThanOrEqual(0);
        expect(s.settled).toBeLessThanOrEqual(1);
      }
      const [cached] = await g.tx.select().from(worldState).where(eq(worldState.key, 'zones'));
      expect(cached.value).toEqual(stats);
    }));

  it('a new city takes an open flat of its zone', () =>
    game(async (g) => {
      const before = (await world.refreshZoneStats(asDb(g)))[5];
      await createTestPlayer(g, { zone: 5 });
      const after = (await world.refreshZoneStats(asDb(g)))[5];
      expect(after).toMatchObject({ playerCount: before.playerCount + 1, castleCount: before.castleCount + 1, openFlats: before.openFlats - 1 });
      expect(after.settled).toBeGreaterThan(before.settled);
    }));
});

describe(world.zoneStats.name, () => {
  it('reads the cached statistics, computing them when there are none', () =>
    game(async (g) => {
      await g.tx.delete(worldState).where(eq(worldState.key, 'zones'));
      const fresh = await world.zoneStats(asDb(g));
      expect(fresh).toHaveLength(BALANCE.stateGrid ** 2);
      await createTestPlayer(g, { zone: 2 });
      expect(await world.zoneStats(asDb(g))).toEqual(fresh); // cached: the new city is not counted yet
    }));
});

describe(world.pickOpenFlat.name, () => {
  it('picks a free flat in the zone asked for', () =>
    game(async (g) => {
      for (const zone of [0, 7, 15]) {
        const t = await getTile(g, await world.pickOpenFlat(g, zone));
        expect(t).toMatchObject({ type: TileType.FLAT, cityId: null, ownerCityId: null });
        expect(stateOf(t.id)).toBe(zone);
      }
    }));

  it('picks anywhere for a negative zone', () =>
    game(async (g) => {
      const t = await getTile(g, await world.pickOpenFlat(g, -1));
      expect(t).toMatchObject({ type: TileType.FLAT, cityId: null, ownerCityId: null });
    }));

  it('refuses a zone with no open flat', () =>
    game(async (g) => {
      const b = stateBounds(3);
      await g.tx
        .update(tiles)
        .set({ type: TileType.FOREST })
        .where(
          and(eq(tiles.type, TileType.FLAT), sql`${tiles.id} / ${SIZE} between ${b.y1} and ${b.y2} and ${tiles.id} % ${SIZE} between ${b.x1} and ${b.x2}`),
        );
      await expectRefused(world.pickOpenFlat(g, 3), msg('world.noOpenFlat'));
    }));
});

describe(world.permissions.name, () => {
  it('friends may be sent to and supplied, everyone else attacked and scouted', () => {
    const friendly = { canLoot: false, canOccupy: false, canScout: false, canSend: true, canTrans: true };
    for (const r of [Relation.SELF, Relation.ALLY, Relation.ALLIANCE]) expect(world.permissions(r)).toEqual(friendly);
    expect(world.permissions(Relation.ENEMY)).toEqual({ canLoot: true, canOccupy: true, canScout: true, canSend: true, canTrans: true });
    for (const r of [Relation.NEUTRAL, Relation.NO_RELATION]) {
      expect(world.permissions(r)).toEqual({ canLoot: true, canOccupy: true, canScout: true, canSend: false, canTrans: false });
    }
  });
});

describe(world.mapView.name, () => {
  it('draws every tile, with the castles at their Town Hall level', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setTownHall(g, p, 7);
      const c = await cityTile(g, p);
      const view = await world.mapView(g, p.id, c.x - 10, c.y - 10, c.x + 10, c.y + 10);
      const ids = area(c.x - 10, c.y - 10, c.x + 10, c.y + 10);
      expect(view).toMatchObject({ x1: c.x - 10, y1: c.y - 10, x2: c.x + 10, y2: c.y + 10 });
      expect(view.mapStr).toHaveLength(2 * MAP_VIEW_MAX * MAP_VIEW_MAX);
      // other players' castles: draw them at whatever level the view gave
      const levels = new Map(view.castles.filter((k) => !k.npc).map((k) => [k.cityId!, k.level]));
      expect(view.mapStr).toBe(await expectedMapStr(g, ids, (cityId) => levels.get(cityId) ?? -1));
      expect(view.mapStr.slice(2 * 220, 2 * 221)).toBe(hex(TileType.CASTLE) + '7');

      const npcIds: number[] = [];
      for (const id of ids) if ((await getTile(g, id)).type === TileType.NPC) npcIds.push(id);
      expect(view.castles.filter((k) => k.npc).map((k) => k.id)).toEqual(npcIds);
      const npc = view.castles.find((k) => k.npc);
      if (npc) {
        const t = await getTile(g, npc.id);
        expect(npc).toEqual({ id: t.id, ...tileXY(t.id), npc: true, level: t.level, zoneId: stateOf(t.id), ...world.permissions(Relation.NO_RELATION) });
      }
    }));

  it("shows the viewer's own castle with its player and the relation", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const c = await cityTile(g, p);
      const own = (await world.mapView(g, p.id, c.x, c.y, c.x, c.y)).castles;
      expect(own).toEqual([
        expect.objectContaining({
          id: c.id,
          x: c.x,
          y: c.y,
          name: c.name,
          npc: false,
          level: 1,
          cityId: p.cityId,
          playerId: p.id,
          userName: p.name,
          allianceName: '',
          relation: Relation.SELF,
          zoneId: stateOf(c.id),
          ...world.permissions(Relation.SELF),
        }),
      ]);
      expect((await world.mapView(g, null, c.x, c.y, c.x, c.y)).castles[0]).toMatchObject({ relation: Relation.NO_RELATION, canSend: false });
    }));

  it('wraps around the edge of the map', () =>
    game(async (g) => {
      const view = await world.mapView(g, null, -1, -1, 1, 1);
      expect(view).toMatchObject({ x1: -1, y1: -1, x2: 1, y2: 1 });
      expect(view.mapStr).toBe(await expectedMapStr(g, area(-1, -1, 1, 1), () => 1));
      expect(area(-1, -1, 1, 1)[0]).toBe(SIZE * SIZE - 1);
    }));

  it('shows the relation between alliances', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await allied(g, a, b, Relation.ALLY);
      const cb = await cityTile(g, b);
      const ca = await cityTile(g, a);
      const [seenByA] = (await world.mapView(g, a.id, cb.x, cb.y, cb.x, cb.y)).castles;
      expect(seenByA).toMatchObject({ playerId: b.id, allianceName: `Band ${b.id}`, relation: Relation.ALLY, ...world.permissions(Relation.ALLY) });
      // one-sided: b's alliance set nothing towards a's
      const [seenByB] = (await world.mapView(g, b.id, ca.x, ca.y, ca.x, ca.y)).castles;
      expect(seenByB).toMatchObject({ allianceName: `Band ${a.id}`, relation: Relation.NO_RELATION });
      await alliance.setRelation(g, a.id, `Band ${b.id}`, Relation.ENEMY);
      expect((await world.mapView(g, b.id, ca.x, ca.y, ca.x, ca.y)).castles[0]).toMatchObject({
        relation: Relation.ENEMY,
        ...world.permissions(Relation.ENEMY),
      });
    }));

  it('lists the valleys held by a city, with the holder', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const t = await holdValley(g, a);
      const { x, y } = tileXY(t.id);
      const expected = {
        id: t.id,
        x,
        y,
        type: t.type,
        level: t.level,
        cityId: a.cityId,
        cityName: (await cityTile(g, a)).name,
        playerId: a.id,
        userName: a.name,
        allianceName: '',
      };
      expect((await world.mapView(g, a.id, x - 1, y - 1, x + 1, y + 1)).valleys).toContainEqual({ ...expected, relation: Relation.SELF });
      expect((await world.mapView(g, b.id, x, y, x, y)).valleys).toEqual([{ ...expected, relation: Relation.NO_RELATION }]);
      // a held flat or barbarian city is not a valley
      const flat = await freeTileNear(g, x, y, [TileType.FLAT]);
      await saveTile(g, { ...flat, ownerCityId: a.cityId, ownerPlayerId: a.id });
      const fx = tileXY(flat.id);
      expect((await world.mapView(g, a.id, fx.x, fx.y, fx.x, fx.y)).valleys).toEqual([]);
    }));

  it('refuses an inverted or too large area', () =>
    game(async (g) => {
      await expectRefused(world.mapView(g, null, 5, 5, 4, 5), msg('world.invalidArea'));
      await expectRefused(world.mapView(g, null, 5, 5, 5, 4), msg('world.invalidArea'));
      await expectRefused(world.mapView(g, null, 0, 0, MAP_VIEW_MAX, 0), msg('world.areaTooLarge', { max: MAP_VIEW_MAX }));
      await expectRefused(world.mapView(g, null, 0, 0, 0, MAP_VIEW_MAX), msg('world.areaTooLarge', { max: MAP_VIEW_MAX }));
    }));
});

describe(world.fieldInfo.name, () => {
  it('a castle tile shows the city as on the map', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const c = await cityTile(g, p);
      const info = await world.fieldInfo(g, p.id, c.id);
      const [castle] = (await world.mapView(g, p.id, c.x, c.y, c.x, c.y)).castles;
      expect(info).toEqual({ ...castle, type: TileType.CASTLE });
      expect(info).toMatchObject({ cityId: p.cityId, relation: Relation.SELF });
    }));

  it('a free valley shows what raising it costs', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const c = await cityTile(g, p);
      const t = await freeTileNear(g, c.x, c.y, VALLEYS);
      expect(await world.fieldInfo(g, p.id, t.id)).toEqual({
        id: t.id,
        ...tileXY(t.id),
        type: t.type,
        level: t.level,
        zoneId: stateOf(t.id),
        npc: false,
        owner: null,
        relation: Relation.NO_RELATION,
        upgradeCost: valleyUpgradeCost(t.level),
        ...world.permissions(Relation.NO_RELATION),
      });
      await saveTile(g, { ...t, level: BALANCE.valleyUpgrade.maxLevel });
      expect(await world.fieldInfo(g, p.id, t.id)).toMatchObject({ upgradeCost: null });
    }));

  it('a held valley shows its holder and the relation to it', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const t = await holdValley(g, a);
      const owner = { cityId: a.cityId, cityName: (await cityTile(g, a)).name, playerId: a.id, userName: a.name };
      expect(await world.fieldInfo(g, a.id, t.id)).toMatchObject({ owner, relation: Relation.SELF, upgradeCost: null, ...world.permissions(Relation.SELF) });
      expect(await world.fieldInfo(g, b.id, t.id)).toMatchObject({ owner, relation: Relation.NO_RELATION, canLoot: true });
      expect(await world.fieldInfo(g, null, t.id)).toMatchObject({ owner, relation: Relation.NO_RELATION });
      await allied(g, b, a, Relation.ENEMY);
      expect(await world.fieldInfo(g, b.id, t.id)).toMatchObject({ relation: Relation.ENEMY, ...world.permissions(Relation.ENEMY) });
    }));

  it('a barbarian city can be raised too', () =>
    game(async (g) => {
      const t = await freeTileNear(g, 400, 400, [TileType.NPC]);
      expect(await world.fieldInfo(g, null, t.id)).toMatchObject({ type: TileType.NPC, npc: true, owner: null, upgradeCost: valleyUpgradeCost(t.level) });
    }));

  it('refuses a tile off the map, or one that does not exist', () =>
    game(async (g) => {
      for (const id of [-1, 1.5, SIZE * SIZE, Number.NaN]) await expectRefused(world.fieldInfo(g, null, id), msg('world.invalidTile'));
      const t = await freeTileNear(g, 300, 300, VALLEYS);
      await g.tx.delete(tiles).where(and(eq(tiles.id, t.id), isNull(tiles.cityId)));
      await expectRefused(world.fieldInfo(g, null, t.id), msg('world.invalidTile'));
    }));
});

describe(world.searchTiles.name, () => {
  it('finds the tiles of a type in the square around a point', () =>
    game(async (g) => {
      const found = await world.searchTiles(g, 400, 400, 10, TileType.NPC);
      const view = await world.mapView(g, null, 390, 390, 410, 410);
      expect(found.map((t) => t.id).sort((a, b) => a - b)).toEqual(view.castles.filter((k) => k.npc).map((k) => k.id));
      for (const t of found) {
        expect(t).toEqual({ id: t.id, type: TileType.NPC, level: t.level, ownerCityId: t.ownerCityId, cityId: t.cityId, ...tileXY(t.id) });
      }
    }));

  it('searches 1 to 30 tiles around, at most 200 tiles', () =>
    game(async (g) => {
      const near = await world.searchTiles(g, 400, 400, 0, TileType.FOREST);
      expect(near.every((t) => Math.abs(t.x - 400) <= 1 && Math.abs(t.y - 400) <= 1)).toBe(true);
      const far = await world.searchTiles(g, 400, 400, 1000, TileType.FLAT);
      expect(far.length).toBeGreaterThan(0);
      expect(far.length).toBeLessThanOrEqual(200);
      expect(far.every((t) => Math.abs(t.x - 400) <= 30 && Math.abs(t.y - 400) <= 30)).toBe(true);
    }));

  it('finds nothing of a type that is not on the map', () =>
    game(async (g) => {
      expect(await world.searchTiles(g, 400, 400, 30, 99)).toEqual([]);
    }));
});
