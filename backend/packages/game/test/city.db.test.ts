import { and, eq, sql } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import { BALANCE, BuildingType, HOUR, msg, type ReportBody, ReportBodyKind, TileType, tileXY } from '@marchlands/core';
import { reports as reportRows } from '@marchlands/db';

import { cityStats, loadBundle, openCity, openOwnCity, settle, settleAndReport, viewCity, viewOwnCity } from '#/city.ts';
import { troopBean } from '#/dto.ts';
import { heroes } from '#/index.ts';
import { getCity, getPlayer, saveCity } from '#/repo.ts';
import { holdValley, insertArmy, withStarvationDesertion } from '#test/support/city-data.ts';
import { expectRefused } from '#test/support/expect.ts';
import { addHero, createTestPlayer, reloadCity, setBuildings, setCityStats, setResources, type TestPlayer } from '#test/support/factories.ts';
import { game, T0, type TestGame } from '#test/support/game.ts';
import { lockedTables, recordSql, writes } from '#test/support/sql-log.ts';

const START = BALANCE.startingResources;
const BASE = BALANCE.baseProductionPerHour;
/** the gold a new city's people pay per hour */
const BASE_TAX = BALANCE.startPopulation * BALANCE.baseTaxShare;
/** food an archer eats per hour */
const ARCHER_UPKEEP = 9;
const TICKS_PER_HOUR = HOUR / BALANCE.cityTickMs;

/** The desertion reports of a player, newest first (read from the rows: opening one marks it read). */
async function desertions(g: TestGame, p: TestPlayer) {
  const rows = await g.tx
    .select()
    .from(reportRows)
    .where(and(eq(reportRows.playerId, p.id), sql`${reportRows.body}->>'kind' = ${ReportBodyKind.DESERTION}`));
  return rows.map((r) => (r.body as Extract<ReportBody, { kind: typeof ReportBodyKind.DESERTION }>).desertion);
}

/** A city with 100 archers and no food. */
async function hungryCity(g: TestGame) {
  const p = await createTestPlayer(g);
  await setCityStats(g, p, { troops: { archer: 100 } });
  await setResources(g, p, { food: 0 });
  return p;
}

describe(loadBundle.name, () => {
  it("gathers the city's heroes (not the Inn's offers), its valleys and its troops away", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[1, BuildingType.INN, 1]]);
      const offers = await heroes.tavern(g, p.id, p.cityId);
      expect(offers.heros.length).toBeGreaterThan(0);
      const heroId = await addHero(g, p);
      const lake = await holdValley(g, p, TileType.LAKE);
      const hill = await holdValley(g, p, TileType.HILL);
      await insertArmy(g, p, { archer: 10, militia: 5 });
      await insertArmy(g, p, { archer: 3 });

      const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
      expect(b.heroes.map((h) => h.id)).toEqual([heroId]);
      expect(b.valleys.map((v) => v.id)).toEqual([lake, hill].sort((x, y) => x - y));
      expect(b.awayTroops).toEqual({ archer: 13, militia: 5 });
      expect(b.deserted).toBeUndefined();
    }));

  it('leaves out the troops of other cities', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await insertArmy(g, b, { archer: 50 });
      const bundle = await loadBundle(g, await getCity(g, a.cityId), await getPlayer(g, a.id));
      expect(bundle.awayTroops).toEqual({});
    }));
});

describe(settle.name, () => {
  it('adds what the city produced over the elapsed time, in memory', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g.advance(HOUR);
      const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
      const r = settle(g, b);
      expect(b.city).toMatchObject({ gold: START + BASE_TAX, food: START + BASE, wood: START + BASE, stone: START + BASE, iron: START + BASE });
      expect(b.city.resourcesAt).toBe(g.now);
      expect(r.ticks).toBe(TICKS_PER_HOUR);
      expect(r.deserted).toEqual({});
      expect(r.flows.produced).toMatchObject({ food: BASE, gold: BASE_TAX });
      expect((await reloadCity(g, p.cityId)).food).toBe(START); // nothing saved
    }));

  it('changes nothing when no time has passed', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
      const before = structuredClone(b.city);
      expect(settle(g, b)).toMatchObject({ ticks: 0, deserted: {} });
      expect(b.city).toEqual(before);
    }));

  it('fields add to the base output, up to the storage', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[1001, BuildingType.FARM, 2]]);
      const farm = BALANCE.fieldProductionPerF * BALANCE.fieldFactor[2];
      const b = await openOwnCity(g, p.id, p.cityId);
      const storage = cityStats(b, g.now).storage.food;
      await setResources(g, p, { food: storage - farm, wood: storage + 5 });
      g.advance(2 * HOUR);
      const after = await openOwnCity(g, p.id, p.cityId);
      expect(after.city.food).toBe(storage); // 2 hours of farm + base would overflow it
      expect(after.city.wood).toBe(storage + 5); // an over-full store is kept, never topped up
      expect(after.city.stone).toBe(START + 2 * BASE);
    }));

  it('grows the population towards the maximum one step each city tick', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[1, BuildingType.COTTAGE, 1]]);
      const max = BALANCE.basePopulation + BALANCE.cottagePopulation[1];
      const step = Math.floor(max * BALANCE.populationStep);
      g.advance(BALANCE.cityTickMs - 1);
      expect((await openOwnCity(g, p.id, p.cityId)).city.population).toBe(BALANCE.startPopulation);
      g.advance(1);
      expect((await openOwnCity(g, p.id, p.cityId)).city.population).toBe(BALANCE.startPopulation + step);
      g.advance(HOUR - BALANCE.cityTickMs);
      expect((await openOwnCity(g, p.id, p.cityId)).city.population).toBe(BALANCE.startPopulation + TICKS_PER_HOUR * step);
      g.advance(10 * HOUR);
      expect((await openOwnCity(g, p.id, p.cityId)).city.population).toBe(max);
    }));

  it('shrinks a population above the maximum', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { population: 200 });
      const step = Math.floor(BALANCE.basePopulation * BALANCE.populationStep);
      g.advance(HOUR);
      expect((await openOwnCity(g, p.id, p.cityId)).city.population).toBe(200 - TICKS_PER_HOUR * step);
      g.advance(100 * HOUR);
      expect((await openOwnCity(g, p.id, p.cityId)).city.population).toBe(BALANCE.basePopulation);
    }));

  it('troops at home and away eat food', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { archer: 100 } });
      await insertArmy(g, p, { archer: 50 });
      g.advance(HOUR);
      const b = await openOwnCity(g, p.id, p.cityId);
      expect(cityStats(b, g.now).upkeep).toBe(150 * ARCHER_UPKEEP);
      expect(b.city.food).toBe(START + BASE - 150 * ARCHER_UPKEEP);
    }));

  it('heroes are paid from the gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await addHero(g, p);
      const b0 = await openOwnCity(g, p.id, p.cityId);
      const salary = b0.heroes[0]!.level * BALANCE.heroSalaryPerLevel;
      g.advance(HOUR);
      expect((await openOwnCity(g, p.id, p.cityId)).city.gold).toBeCloseTo(START + BASE_TAX - salary, 6);
    }));

  it('food runs out at 0 and, with desertion off, the troops stay', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { archer: 100 } });
      await setResources(g, p, { food: 100 });
      g.advance(HOUR);
      const b = await openOwnCity(g, p.id, p.cityId);
      expect(b.city.food).toBe(0);
      expect(b.city.troops.archer).toBe(100);
      expect(g.pushes(PushCmd.TROOP_UPDATE)).toEqual([]);
    }));

  it('counts what it produced when the settled city is saved, once', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g.advance(HOUR);
      const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
      settle(g, b);
      g._stats.clear();
      await saveCity(g, b.city);
      expect(g._stats.get(`${p.id}|${p.cityId}`)).toMatchObject({ 'produced.food': BASE, 'produced.gold': BASE_TAX });
      g._stats.clear();
      await saveCity(g, b.city); // and only once
      expect(g._stats.size).toBe(0);
    }));

  describe('with starvation desertion', () => {
    withStarvationDesertion();

    it('troops desert while there is no food, and the client is told', () =>
      game(async (g) => {
        const p = await hungryCity(g);
        g.advance(HOUR);
        const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
        const r = settle(g, b);
        expect(r.deserted.archer).toBeGreaterThan(0);
        expect(b.city.troops.archer).toBe(100 - r.deserted.archer!);
        expect(g.pushes(PushCmd.TROOP_UPDATE)).toEqual([
          expect.objectContaining({ playerIds: [p.id], data: { castleId: p.cityId, troop: troopBean(b.city.troops) } }),
        ]);
        expect(await desertions(g, p)).toEqual([]); // settle alone files no report
      }));
  });
});

describe(settleAndReport.name, () => {
  withStarvationDesertion();

  it('files a desertion report with the food situation after it', () =>
    game(async (g) => {
      const p = await hungryCity(g);
      g.advance(HOUR);
      const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
      const r = await settleAndReport(g, b);
      const left = b.city.troops.archer!;
      const upkeep = left * ARCHER_UPKEEP;
      const { x, y } = tileXY(b.city.tileId);
      expect(await desertions(g, p)).toEqual([
        {
          cityId: p.cityId,
          city: b.city.name,
          troops: r.deserted,
          from: T0,
          to: g.now,
          food: { production: BASE, upkeep, net: BASE - upkeep },
          last: { from: T0, troops: r.deserted },
        },
      ]);
      const [row] = await g.tx.select().from(reportRows).where(eq(reportRows.playerId, p.id));
      expect(row!.startPos).toEqual(msg('world.position.city', { name: b.city.name, x, y }));
    }));

  it('files nothing while the troops are fed', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { archer: 100 } });
      g.advance(HOUR);
      const b = await loadBundle(g, await getCity(g, p.cityId), await getPlayer(g, p.id));
      expect((await settleAndReport(g, b)).deserted).toEqual({});
      expect(await desertions(g, p)).toEqual([]);
    }));
});

describe(openOwnCity.name, () => {
  it('locks the player, then the city, and settles it to now without saving it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g.advance(HOUR);
      let b: Awaited<ReturnType<typeof openOwnCity>> | undefined;
      const sqls = await recordSql(g, async () => {
        b = await openOwnCity(g, p.id, p.cityId);
      });
      expect(lockedTables(sqls)).toEqual(['players', 'cities']);
      expect(writes(sqls)).toEqual([]);
      expect(b!.player.id).toBe(p.id);
      expect(b!.city).toMatchObject({ food: START + BASE, resourcesAt: g.now });
    }));

  it("refuses another player's city, and an unknown city or player", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(openOwnCity(g, a.id, b.cityId), msg('common.invalidCastle'));
      await expectRefused(openOwnCity(g, a.id, 999_999_999), msg('common.cityNotFound'));
      await expectRefused(openOwnCity(g, 999_999_999, a.cityId), msg('common.playerNotFound'));
    }));

  describe('with starvation desertion', () => {
    withStarvationDesertion();

    it('reports troops that deserted', () =>
      game(async (g) => {
        const p = await hungryCity(g);
        g.advance(HOUR);
        const b = await openOwnCity(g, p.id, p.cityId);
        const [d] = await desertions(g, p);
        expect(d!.troops.archer).toBe(100 - b.city.troops.archer!);
      }));
  });
});

describe(openCity.name, () => {
  it('locks the current owner, then the city, and settles it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g.advance(HOUR);
      let b: Awaited<ReturnType<typeof openCity>> = null;
      const sqls = await recordSql(g, async () => {
        b = await openCity(g, p.cityId);
      });
      expect(lockedTables(sqls)).toEqual(['players', 'cities']);
      expect(b!.player.id).toBe(p.id);
      expect(b!.city).toMatchObject({ food: START + BASE, resourcesAt: g.now });
    }));

  it('is null for a city that does not exist', () =>
    game(async (g) => {
      expect(await openCity(g, 999_999_999)).toBeNull();
    }));
});

describe(viewCity.name, () => {
  it('settles in memory, without locking or writing anything', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      g.advance(HOUR);
      let b: Awaited<ReturnType<typeof viewCity>> | undefined;
      const sqls = await recordSql(g, async () => {
        b = await viewCity(g, p.cityId);
      });
      expect(lockedTables(sqls)).toEqual([]);
      expect(writes(sqls)).toEqual([]);
      expect(b!.city).toMatchObject({ food: START + BASE, resourcesAt: g.now });
      expect((await reloadCity(g, p.cityId)).resourcesAt).toBe(T0);
    }));

  it("uses the owner's row when given it, and loads the owner otherwise", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      const owner = await getPlayer(g, a.id);
      expect((await viewCity(g, a.cityId, owner)).player).toBe(owner);
      const seen = await viewCity(g, a.cityId, await getPlayer(g, b.id));
      expect(seen.player.id).toBe(a.id);
      expect((await viewCity(g, a.cityId)).player.id).toBe(a.id);
    }));

  it('refuses an unknown city', () =>
    game(async (g) => {
      await expectRefused(viewCity(g, 999_999_999), msg('common.cityNotFound'));
    }));

  describe('with starvation desertion', () => {
    withStarvationDesertion();

    it('notes the troops that would desert, but reports and pushes nothing', () =>
      game(async (g) => {
        const p = await hungryCity(g);
        g.advance(HOUR);
        const b = await viewCity(g, p.cityId);
        expect(b.deserted?.archer).toBeGreaterThan(0);
        expect(b.city.troops.archer).toBe(100 - b.deserted!.archer!);
        expect(g.pushes(PushCmd.TROOP_UPDATE)).toEqual([]);
        expect(await desertions(g, p)).toEqual([]);
        expect((await reloadCity(g, p.cityId)).troops.archer).toBe(100);
      }));
  });
});

describe(viewOwnCity.name, () => {
  it('is the read-only view while no troops deserted', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setCityStats(g, p, { troops: { archer: 100 } });
      g.advance(HOUR);
      let b: Awaited<ReturnType<typeof viewOwnCity>> | undefined;
      const sqls = await recordSql(g, async () => {
        b = await viewOwnCity(g, p.id, p.cityId);
      });
      expect(lockedTables(sqls)).toEqual([]);
      expect(writes(sqls)).toEqual([]);
      expect(b!.city.food).toBe(START + BASE - 100 * ARCHER_UPKEEP);
    }));

  describe('with starvation desertion', () => {
    withStarvationDesertion();

    it('settles for real when troops deserted: saved and reported straight away', () =>
      game(async (g) => {
        const p = await hungryCity(g);
        g.advance(HOUR);
        const b = await viewOwnCity(g, p.id, p.cityId);
        const left = b.city.troops.archer!;
        expect(left).toBeLessThan(100);
        expect(await reloadCity(g, p.cityId)).toMatchObject({ resourcesAt: g.now, troops: { archer: left } });
        const [d] = await desertions(g, p);
        expect(d!.troops).toEqual({ archer: 100 - left });
      }));

    it("only views another player's city, even with deserters", () =>
      game(async (g) => {
        const p = await hungryCity(g);
        const other = await createTestPlayer(g);
        g.advance(HOUR);
        const b = await viewOwnCity(g, other.id, p.cityId);
        expect(b.deserted?.archer).toBeGreaterThan(0);
        expect((await reloadCity(g, p.cityId)).troops.archer).toBe(100);
        expect(await desertions(g, p)).toEqual([]);
      }));
  });
});
