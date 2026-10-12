import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ArmyDirection, BuildingType, heroGearBonus, heroGearStat, HeroStatus, msg, TechType, TileType } from '@marchlands/core';
import { players } from '@marchlands/db';
import {
  armiesOfCity,
  armiesStationedAt,
  citiesOf,
  findCity,
  findPlayerByName,
  gearOfHero,
  getArmy,
  getCity,
  getHero,
  getPlayer,
  getTile,
  heroesOfCity,
  lockPlayers,
  saveArmy,
  saveCity,
  saveHero,
  savePlayer,
  saveTile,
  valleysOfCity,
} from '#/repo.ts';
import { heroes } from '#/index.ts';
import { holdValley, insertArmy } from '#test/support/city-data.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addCity, addHero, createTestPlayer, reloadCity, reloadPlayer, setBuildings, setResearch, type TestPlayer } from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';
import { lockedTables, recordSql } from '#test/support/sql-log.ts';

const MISSING = 999_999_999;

/** Set a hero's columns as stored (saveHero, so the lord's gear is applied again). */
async function updateHero(g: TestGame, id: number, set: Partial<Awaited<ReturnType<typeof getHero>>>) {
  const h = await getHero(g, id);
  Object.assign(h, set);
  await saveHero(g, h);
  return h;
}

/** Hero Enhancement research for the lord (gear level). */
const enhance = (g: TestGame, p: TestPlayer, level: number) => setResearch(g, p, TechType.HERO_ENHANCEMENT, level);

describe('players', () => {
  it('getPlayer refuses an unknown id', () =>
    game(async (g) => {
      await expectRefused(getPlayer(g, MISSING), msg('common.playerNotFound'));
    }));

  it('lock variants select for update', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(lockedTables(await recordSql(g, () => getPlayer(g, p.id)))).toEqual([]);
      expect(lockedTables(await recordSql(g, () => getPlayer(g, p.id, { lock: true })))).toEqual(['players']);
    }));

  it('findPlayerByName ignores case', () =>
    game(async (g) => {
      const p = await createTestPlayer(g, { name: 'MixedCase' });
      expect((await findPlayerByName(g, 'mixedcase'))?.id).toBe(p.id);
      expect((await findPlayerByName(g, 'MIXEDCASE'))?.id).toBe(p.id);
      expect(await findPlayerByName(g, 'Mixed')).toBeUndefined();
    }));

  it('lockPlayers locks each player once, in id order, skipping unknown and empty ids', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      let locked = new Map<number, unknown>();
      const sqls = await recordSql(g, async () => {
        locked = await lockPlayers(g, [b.id, a.id, b.id, 0, -1, MISSING]);
      });
      expect([...locked.keys()]).toEqual([a.id, b.id]);
      expect(lockedTables(sqls)).toEqual(['players', 'players', 'players']); // a, b, then the unknown id
      expect(await lockPlayers(g, [])).toEqual(new Map());
    }));

  it('savePlayer writes the row but never its account or creation time', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const row = await getPlayer(g, a.id);
      const createdAt = row.createdAt;
      Object.assign(row, { accountId: b.accountId, createdAt: createdAt + 1, name: 'Renamed', honor: 42, research: { 1: { level: 2 } } });
      await savePlayer(g, row);
      const [stored] = await g.tx.select().from(players).where(eq(players.id, a.id));
      expect(stored).toMatchObject({ accountId: a.accountId, createdAt, name: 'Renamed', honor: 42, research: { 1: { level: 2 } } });
    }));
});

describe('cities', () => {
  it('findCity is undefined and getCity refuses for an unknown id', () =>
    game(async (g) => {
      expect(await findCity(g, MISSING)).toBeUndefined();
      await expectRefused(getCity(g, MISSING), msg('common.cityNotFound'));
    }));

  it("citiesOf lists a player's cities oldest first, and only theirs", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const second = await addCity(g, p);
      expect((await citiesOf(g, p.id)).map((c) => c.id)).toEqual([p.cityId, second]);
      expect((await citiesOf(g, other.id)).map((c) => c.id)).toEqual([other.cityId]);
      expect(lockedTables(await recordSql(g, () => citiesOf(g, p.id, { lock: true })))).toEqual(['cities']);
      expect(lockedTables(await recordSql(g, () => getCity(g, p.cityId, { lock: true })))).toEqual(['cities']);
    }));

  it('saveCity writes the row but never its creation time', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const c = await getCity(g, p.cityId);
      const createdAt = c.createdAt;
      Object.assign(c, { createdAt: createdAt + 1, name: 'Renamed', food: 123.5, troops: { archer: 7 } });
      await saveCity(g, c);
      expect(await reloadCity(g, p.cityId)).toMatchObject({ createdAt, name: 'Renamed', food: 123.5, troops: { archer: 7 } });
    }));

  it('saveCity counts no statistics for a city that was not settled', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g._stats.clear();
      await saveCity(g, await getCity(g, p.cityId));
      expect(g._stats.size).toBe(0);
    }));
});

describe('heroes', () => {
  it('getHero refuses an unknown hero, and locks with lock', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await addHero(g, p);
      await expectRefused(getHero(g, MISSING), msg('common.heroNotFound'));
      expect(lockedTables(await recordSql(g, () => getHero(g, id)))).toEqual([]);
      expect(lockedTables(await recordSql(g, () => getHero(g, id, { lock: true })))).toEqual(['heroes']);
    }));

  it("heroesOfCity lists the city's heroes in the lord's order, then the unplaced ones oldest first", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const [h1, h2, h3, h4] = [await addHero(g, p), await addHero(g, p), await addHero(g, p), await addHero(g, p)];
      await updateHero(g, h3, { sortOrder: 1 });
      await updateHero(g, h1, { sortOrder: 2 });
      expect((await heroesOfCity(g, p.cityId)).map((h) => h.id)).toEqual([h3, h1, h2, h4]);
      expect(lockedTables(await recordSql(g, () => heroesOfCity(g, p.cityId, { lock: true })))).toEqual(['heroes']);
    }));

  it("heroesOfCity leaves out the Inn's offers, or lists only them with tavern", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[1, BuildingType.INN, 2]]);
      const offers = (await heroes.tavern(g, p.id, p.cityId)).heros.map((h) => h.id);
      const hired = await addHero(g, p);
      expect((await heroesOfCity(g, p.cityId)).map((h) => h.id)).toEqual([hired]);
      expect((await heroesOfCity(g, p.cityId, { tavern: true })).map((h) => h.id).sort()).toEqual([...offers].sort());
    }));

  it("gearOfHero is the lord's gear: Hero Enhancement level and the stars bought", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await enhance(g, p, 3);
      const row = await reloadPlayer(g, p);
      row.misc = { ...row.misc, gearStars: { weapon: 2, shield: 0 } };
      await savePlayer(g, row);
      const h = await getHero(g, await addHero(g, p));
      expect(await gearOfHero(g, h)).toEqual({ level: 3, stars: { weapon: 2 } });
    }));

  it('gearOfHero is null for an Inn offer, a captive, a hero without a lord and a lord that is gone', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      expect(await gearOfHero(g, { playerId: p.id, inTavern: true, status: HeroStatus.IDLE })).toBeNull();
      expect(await gearOfHero(g, { playerId: p.id, inTavern: false, status: HeroStatus.SEIZED })).toBeNull();
      expect(await gearOfHero(g, { playerId: null, inTavern: false, status: HeroStatus.IDLE })).toBeNull();
      expect(await gearOfHero(g, { playerId: MISSING, inTavern: false, status: HeroStatus.IDLE })).toBeNull();
      expect(await gearOfHero(g, { playerId: p.id, inTavern: false, status: HeroStatus.MAYOR })).toEqual({ level: 0, stars: {} });
    }));

  it('saveHero puts the gear points on the gear attribute, and stores the row (not its creation time)', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await enhance(g, p, 3);
      const id = await addHero(g, p);
      const createdAt = (await getHero(g, id)).createdAt;
      const h = await updateHero(g, id, { level: 30, createdAt: createdAt + 1, name: 'Geared' });
      const bonus = heroGearBonus(30, { level: 3, stars: {} });
      expect(bonus).toBeGreaterThan(0);
      const stat = heroGearStat(h);
      const added = { powerAdded: 0, managementAdded: 0, stratagemAdded: 0, [`${stat}Added`]: bonus };
      expect(h).toMatchObject(added);
      expect(await getHero(g, id)).toMatchObject({ ...added, name: 'Geared', level: 30, createdAt });
    }));

  it('saveHero moves the gear to the chosen attribute, and takes it off a captive', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await enhance(g, p, 3);
      const id = await addHero(g, p);
      const bonus = heroGearBonus(30, { level: 3, stars: {} });
      expect(await updateHero(g, id, { level: 30, gearStat: 'stratagem' })).toMatchObject({ powerAdded: 0, managementAdded: 0, stratagemAdded: bonus });
      expect(await updateHero(g, id, { status: HeroStatus.SEIZED })).toMatchObject({ powerAdded: 0, managementAdded: 0, stratagemAdded: 0 });
    }));
});

describe('tiles', () => {
  it('getTile refuses an unknown tile, and locks with lock', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const { tileId } = await getCity(g, p.cityId);
      await expectRefused(getTile(g, -1), msg('common.invalidCoordinates'));
      expect(await getTile(g, tileId)).toMatchObject({ id: tileId, type: TileType.CASTLE, cityId: p.cityId });
      expect(lockedTables(await recordSql(g, () => getTile(g, tileId, { lock: true })))).toEqual(['tiles']);
    }));

  it('saveTile writes the tile', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const id = await holdValley(g, p, TileType.FOREST);
      const t = await getTile(g, id, { lock: true });
      t.level = 7;
      t.ownerCityId = null;
      await saveTile(g, t);
      expect(await getTile(g, id)).toMatchObject({ level: 7, ownerCityId: null });
    }));

  it('valleysOfCity lists the tiles the city holds, by id', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const v = [await holdValley(g, p, TileType.LAKE), await holdValley(g, p, TileType.FOREST)];
      await holdValley(g, other, TileType.HILL);
      expect((await valleysOfCity(g, p.cityId)).map((t) => t.id)).toEqual(v.sort((x, y) => x - y));
      expect(await valleysOfCity(g, (await createTestPlayer(g)).cityId)).toEqual([]);
    }));
});

describe('armies', () => {
  it('getArmy is undefined for an unknown army, and locks with lock', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const a = await insertArmy(g, p, { archer: 5 });
      expect(await getArmy(g, MISSING)).toBeUndefined();
      expect(await getArmy(g, a.id)).toEqual(a);
      expect(lockedTables(await recordSql(g, () => getArmy(g, a.id, { lock: true })))).toEqual(['armies']);
    }));

  it('saveArmy writes the army but never its creation time', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const a = await insertArmy(g, p, { archer: 5 });
      const createdAt = a.createdAt;
      Object.assign(a, { createdAt: createdAt + 1, direction: ArmyDirection.BACKWARD, troops: { archer: 3 } });
      await saveArmy(g, a);
      expect(await getArmy(g, a.id)).toMatchObject({ createdAt, direction: ArmyDirection.BACKWARD, troops: { archer: 3 } });
    }));

  it("armiesOfCity lists a city's armies by id", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const second = await addCity(g, p);
      const a1 = await insertArmy(g, p, { archer: 1 });
      const a2 = await insertArmy(g, p, { archer: 2 }, { cityId: second });
      const a3 = await insertArmy(g, p, { archer: 3 });
      await insertArmy(g, other, { archer: 4 });
      expect((await armiesOfCity(g, p.cityId)).map((a) => a.id)).toEqual([a1.id, a3.id]);
      expect((await armiesOfCity(g, second)).map((a) => a.id)).toEqual([a2.id]);
    }));

  it('armiesStationedAt lists the armies camped on a tile, not those marching to it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      const tile = await holdValley(g, p, TileType.FOREST);
      const camped = await insertArmy(g, p, { archer: 1 }, { targetTileId: tile, direction: ArmyDirection.STAY });
      await insertArmy(g, p, { archer: 1 }, { targetTileId: tile, direction: ArmyDirection.FORWARD });
      await insertArmy(g, p, { archer: 1 }, { targetTileId: tile, direction: ArmyDirection.BACKWARD });
      const theirs = await insertArmy(g, other, { archer: 1 }, { targetTileId: tile, direction: ArmyDirection.STAY });
      await insertArmy(g, p, { archer: 1 }, { targetTileId: tile + 1, direction: ArmyDirection.STAY });
      expect((await armiesStationedAt(g, tile)).map((a) => a.id)).toEqual([camped.id, theirs.id]);
      expect(lockedTables(await recordSql(g, () => armiesStationedAt(g, tile, { lock: true })))).toEqual(['armies']);
    }));
});
