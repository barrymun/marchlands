import { and, eq, isNull } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { PushCmd } from '@marchlands/contracts';
import {
  BALANCE,
  BASIC_RESOURCES,
  BuffId,
  BuildingType,
  dur,
  itemGoldPrice,
  ItemId,
  Mission,
  msg,
  ref,
  scaled,
  setGameSpeed,
  TileType,
  tileXY,
  TimedEventType,
} from '@marchlands/core';
import { tiles } from '@marchlands/db';

import { cityStats } from '#/city.ts';
import { admin, armies, interior } from '#/index.ts';
import { getTile } from '#/repo.ts';
import { expectRefused } from '#test/support/expect.ts';
import {
  cityBundle,
  createTestPlayer,
  giveItems,
  reloadCity,
  reloadPlayer,
  setBuildings,
  setCityStats,
  setResources,
  type TestPlayer,
} from '#test/support/factories.ts';
import { game, type TestGame } from '#test/support/game.ts';

/** Max population of a city with one cottage of this level. */
const maxPopWithCottage = (level: number) => BALANCE.basePopulation + BALANCE.cottagePopulation[level]!;

/** A free flat tile (no city, not held by one), away from `avoid`. */
async function freeFlat(g: TestGame, avoid: number[] = []): Promise<number> {
  const rows = await g.tx
    .select({ id: tiles.id })
    .from(tiles)
    .where(and(eq(tiles.type, TileType.FLAT), isNull(tiles.cityId), isNull(tiles.ownerCityId)))
    .limit(10);
  return rows.find((r) => !avoid.includes(r.id))!.id;
}

/** A valley (non-flat tile without a city) nobody holds. */
async function freeValley(g: TestGame): Promise<number> {
  const [row] = await g.tx
    .select({ id: tiles.id })
    .from(tiles)
    .where(and(eq(tiles.type, TileType.FOREST), isNull(tiles.cityId), isNull(tiles.ownerCityId)))
    .limit(1);
  return row!.id;
}

/** `a` sends a scout at `b`'s city: an army out of a's city, and foreign troops headed for b's. */
async function scoutAt(g: TestGame, a: TestPlayer, b: TestPlayer) {
  await admin.setPlayerFlags(g, a.name, { beginner: false });
  await admin.setPlayerFlags(g, b.name, { beginner: false });
  await setBuildings(g, a, [[1, BuildingType.RALLY_SPOT, 1]]);
  await setCityStats(g, a, { troops: { scouter: 1 } });
  const target = (await reloadCity(g, b.cityId)).tileId;
  await armies.sendArmy(g, a.id, a.cityId, { targetTileId: target, mission: Mission.SCOUT, troops: { scouter: 1 } });
}

describe(interior.getCity.name, () => {
  it('shows the city as its owner sees it', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const city = await reloadCity(g, p.cityId);
      const bean = await interior.getCity(g, p.id, p.cityId);
      expect(bean).toMatchObject({ id: p.cityId, name: city.name, fieldId: city.tileId, ...tileXY(city.tileId) });
      expect(bean.buildings).toEqual([expect.objectContaining({ positionId: -1, typeId: BuildingType.TOWN_HALL, level: 1 })]);
      expect(bean.resource.gold).toBe(Math.floor(city.gold));
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(interior.getCity(g, a.id, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(interior.setTaxRate.name, () => {
  it('stores the rate and pushes the resources', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (const rate of [0, 35, 100]) {
        await interior.setTaxRate(g, p.id, p.cityId, rate);
        expect((await reloadCity(g, p.cityId)).taxRate).toBe(rate);
      }
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data).toMatchObject({ castleId: p.cityId, resource: { taxRate: 100 } });
    }));

  it('takes a whole number from 0 to 100', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (const rate of [-1, 101, 2.5, NaN]) await expectRefused(interior.setTaxRate(g, p.id, p.cityId, rate), msg('city.taxRateRange'));
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(interior.setTaxRate(g, a.id, b.cityId, 10), msg('common.invalidCastle'));
    }));
});

describe(interior.setWorkRates.name, () => {
  it('changes only the rates given, of the basic resources', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = (await reloadCity(g, p.cityId)).workRates;
      await interior.setWorkRates(g, p.id, p.cityId, { food: 40, iron: 0, gold: 7 });
      expect((await reloadCity(g, p.cityId)).workRates).toEqual({ ...before, food: 40, iron: 0 });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data.resource).toMatchObject({ food: { workRate: 40 }, iron: { workRate: 0 } });
    }));

  it('takes whole numbers from 0 to 100, changing nothing otherwise', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = (await reloadCity(g, p.cityId)).workRates;
      await expectRefused(interior.setWorkRates(g, p.id, p.cityId, { food: 50, wood: 101 }), msg('city.workRateRange'));
      await expectRefused(interior.setWorkRates(g, p.id, p.cityId, { stone: -1 }), msg('city.workRateRange'));
      await expectRefused(interior.setWorkRates(g, p.id, p.cityId, { iron: 0.5 }), msg('city.workRateRange'));
      expect((await reloadCity(g, p.cityId)).workRates).toEqual(before);
    }));
});

describe(interior.setStorePercent.name, () => {
  it('stores the warehouse shares', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await interior.setStorePercent(g, p.id, p.cityId, { food: 40, wood: 30, stone: 20, iron: 10 });
      expect((await reloadCity(g, p.cityId)).storePercent).toMatchObject({ food: 40, wood: 30, stone: 20, iron: 10 });
      expect(g.pushes(PushCmd.RESOURCE_UPDATE).at(-1)?.data.resource).toMatchObject({ food: { storePercent: 40 } });
    }));

  it('the shares may not add up to more than 100, counting those not given', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = (await reloadCity(g, p.cityId)).storePercent;
      const total = BASIC_RESOURCES.reduce((s, r) => s + before[r]!, 0);
      await expectRefused(interior.setStorePercent(g, p.id, p.cityId, { food: before.food! + 101 - total }), msg('city.storePercentTotal'));
      await interior.setStorePercent(g, p.id, p.cityId, { food: before.food! + 100 - total });
    }));

  it('takes whole numbers from 0 to 100', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await expectRefused(interior.setStorePercent(g, p.id, p.cityId, { food: 101 }), msg('city.invalidStorePercent'));
      await expectRefused(interior.setStorePercent(g, p.id, p.cityId, { food: -1 }), msg('city.invalidStorePercent'));
      await expectRefused(interior.setStorePercent(g, p.id, p.cityId, { food: 1.5 }), msg('city.invalidStorePercent'));
    }));
});

describe(interior.comfort.name, () => {
  it('blessing trades gold for food, sometimes twice the food', async () => {
    const seen = new Set<boolean>();
    for (let i = 0; i < 80 && seen.size < 2; i++) {
      await game(
        async (g) => {
          const p = await createTestPlayer(g);
          const before = await reloadCity(g, p.cityId);
          const max = cityStats(await cityBundle(g, p), g.now).maxPopulation;
          const { freeBlessing } = await interior.comfort(g, p.id, p.cityId, 3);
          const city = await reloadCity(g, p.cityId);
          expect(city.gold).toBe(before.gold - Math.floor(max / 10));
          expect(city.food).toBe(before.food + max * (freeBlessing ? 2 : 1));
          expect(city.misc.lastComfortAt).toBe(g.now);
          seen.add(freeBlessing);
        },
        { seed: `comfort-${i}` },
      );
    }
    expect(seen).toEqual(new Set([true, false]));
  });

  it('population raising trades food for people, up to the maximum', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [[20, BuildingType.COTTAGE, 1]]);
      const max = maxPopWithCottage(1);
      const before = await reloadCity(g, p.cityId);
      expect(await interior.comfort(g, p.id, p.cityId, 4)).toEqual({ freeBlessing: false });
      let city = await reloadCity(g, p.cityId);
      expect(city.food).toBe(before.food - max * 5);
      expect(city.population).toBe(before.population + Math.floor(max / 20));

      await setCityStats(g, p, { population: max - 1 });
      g.advance(scaled(BALANCE.comfortCooldownMs));
      await interior.comfort(g, p.id, p.cityId, 4);
      city = await reloadCity(g, p.cityId);
      expect(city.population).toBe(max);
    }));

  it('cools down between uses', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await interior.comfort(g, p.id, p.cityId, 3);
      const cd = scaled(BALANCE.comfortCooldownMs);
      g.advance(60_000);
      await expectRefused(interior.comfort(g, p.id, p.cityId, 3), msg('city.comfortCooldown', { time: dur(cd - 60_000) }));
      g.advance(cd - 60_000);
      await interior.comfort(g, p.id, p.cityId, 3);
    }));

  it('refuses an unknown kind and a city without the gold or food', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      for (const t of [0, 1, 2, 5]) await expectRefused(interior.comfort(g, p.id, p.cityId, t), msg('city.invalidComfortType'));
      await setResources(g, p, { gold: 0, food: 0 });
      await expectRefused(interior.comfort(g, p.id, p.cityId, 3), msg('common.notEnoughGold'));
      await expectRefused(interior.comfort(g, p.id, p.cityId, 4), msg('city.notEnoughFood'));
      expect((await reloadCity(g, p.cityId)).misc.lastComfortAt).toBeUndefined();
    }));
});

describe(interior.productionBreakdown.name, () => {
  it("gives each basic resource's output from the city's stats", () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await setBuildings(g, p, [
        [1001, BuildingType.FARM, 2],
        [1002, BuildingType.SAWMILL, 1],
      ]);
      await setCityStats(g, p, { troops: { militia: 10 } });
      await interior.setWorkRates(g, p.id, p.cityId, { wood: 50 });
      const s = cityStats(await cityBundle(g, p), g.now);
      const rows = await interior.productionBreakdown(g, p.id, p.cityId);
      expect(rows).toEqual(
        BASIC_RESOURCES.map((r, i) => ({
          typeid: i + 1,
          resource: r,
          basicOutput: BALANCE.baseProductionPerHour,
          fieldOutput: Math.round(s.fieldProduction[r] * s.efficiency),
          bonus: s.bonus[r],
          armyConsumption: r === 'food' ? Math.round(s.upkeep) : 0,
          totalOutput: Math.round(s.rates[r]),
          commenceRate: r === 'wood' ? 50 : 100,
          maxLabour: s.workers[r],
          storage: s.storage[r],
        })),
      );
      expect(rows[0]!.armyConsumption).toBeGreaterThan(0);
      expect(rows[0]!.fieldOutput).toBeGreaterThan(0);
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(interior.productionBreakdown(g, a.id, b.cityId), msg('common.invalidCastle'));
    }));
});

describe(interior.renameCity.name, () => {
  it('changes the name and the logo, and pushes the city', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await interior.renameCity(g, p.id, p.cityId, '  New   Haven ', 'images/icon/cityLogo/logo-2.png');
      const city = await reloadCity(g, p.cityId);
      expect(city.name).toBe('New Haven');
      expect(city.logoUrl).toBe('images/icon/cityLogo/logo-2.png');
      expect(g.pushes(PushCmd.CASTLE_UPDATE).at(-1)?.data).toMatchObject({ updateType: 2, castleBean: { name: 'New Haven' } });

      await interior.renameCity(g, p.id, p.cityId, undefined, 'images/icon/cityLogo/x.png');
      expect(await reloadCity(g, p.cityId)).toMatchObject({ name: 'New Haven', logoUrl: 'images/icon/cityLogo/x.png' });
    }));

  it('refuses a bad name or logo', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const what = msg('common.cityName');
      await expectRefused(interior.renameCity(g, p.id, p.cityId, ' '), msg('common.nameLength', { what, min: 1, max: 20 }));
      await expectRefused(interior.renameCity(g, p.id, p.cityId, 'x'.repeat(21)), msg('common.nameLength', { what, min: 1, max: 20 }));
      await expectRefused(interior.renameCity(g, p.id, p.cityId, 'City<1>'), msg('common.nameInvalid', { what }));
      await expectRefused(interior.renameCity(g, p.id, p.cityId, 'Shitville'), msg('common.nameNotAllowed'));
      await expectRefused(interior.renameCity(g, p.id, p.cityId, undefined, 'http://evil.test/logo.png'), msg('city.invalidLogo'));
      await expectRefused(interior.renameCity(g, p.id, p.cityId, undefined, 'images/icon/cityLogo/../x'), msg('city.invalidLogo'));
    }));
});

describe(interior.setCityFlags.name, () => {
  it('sets only the flags given', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const before = await reloadCity(g, p.cityId);
      await interior.setCityFlags(g, p.id, p.cityId, { goOutForBattle: !before.goOutForBattle });
      expect(await reloadCity(g, p.cityId)).toMatchObject({ goOutForBattle: !before.goOutForBattle, allowAlliance: before.allowAlliance });
      await interior.setCityFlags(g, p.id, p.cityId, { allowAlliance: !before.allowAlliance });
      expect(await reloadCity(g, p.cityId)).toMatchObject({ goOutForBattle: !before.goOutForBattle, allowAlliance: !before.allowAlliance });
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(interior.setCityFlags(g, a.id, b.cityId, { goOutForBattle: true }), msg('common.invalidCastle'));
    }));
});

describe(interior.moveCity.name, () => {
  it('cools down for real time, whatever the game speed', () =>
    game(async (g) => {
      setGameSpeed(4);
      try {
        const p = await createTestPlayer(g);
        await giveItems(g, p, { [ItemId.CITY_TELEPORTER]: 1 });
        await interior.moveCity(g, p.id, p.cityId, await freeFlat(g, [(await reloadCity(g, p.cityId)).tileId]));
        const player = await reloadPlayer(g, p);
        expect(player.buffs).toContainEqual(expect.objectContaining({ id: BuffId.TELEPORT_COOLDOWN, endTime: g.now + BALANCE.teleportCooldownMs }));
      } finally {
        setGameSpeed(1);
      }
    }));

  it('moves the city to a free flat with a City Teleporter, then cools down', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.CITY_TELEPORTER]: 1 });
      const from = (await reloadCity(g, p.cityId)).tileId;
      const to = await freeFlat(g, [from]);
      const before = await reloadCity(g, p.cityId);

      expect(await interior.moveCity(g, p.id, p.cityId, to)).toEqual({ fieldId: to, ...tileXY(to) });
      const city = await reloadCity(g, p.cityId);
      expect(city.tileId).toBe(to);
      expect(city.gold).toBe(before.gold);
      expect(await getTile(g, from)).toMatchObject({ type: TileType.FLAT, cityId: null, ownerPlayerId: null });
      expect(await getTile(g, to)).toMatchObject({ type: TileType.CASTLE, cityId: p.cityId, ownerPlayerId: p.id, ownerCityId: null });

      const player = await reloadPlayer(g, p);
      expect(player.items[ItemId.CITY_TELEPORTER] ?? 0).toBe(0);
      const end = g.now + BALANCE.teleportCooldownMs;
      expect(player.buffs).toContainEqual(expect.objectContaining({ id: BuffId.TELEPORT_COOLDOWN, endTime: end }));
      expect(g.events(TimedEventType.BUFF_EXPIRE)).toContainEqual(expect.objectContaining({ dueAt: end, refKey: `buff:${p.id}:${BuffId.TELEPORT_COOLDOWN}` }));
      expect(g.pushes(PushCmd.CASTLE_UPDATE).at(-1)?.data).toMatchObject({ castleBean: { fieldId: to } });

      await giveItems(g, p, { [ItemId.CITY_TELEPORTER]: 1 });
      const again = await freeFlat(g, [from, to]);
      await expectRefused(interior.moveCity(g, p.id, p.cityId, again), msg('city.teleportCooldown', { item: ref.item(ItemId.CITY_TELEPORTER) }));
      g.advance(BALANCE.teleportCooldownMs);
      await interior.moveCity(g, p.id, p.cityId, again);
    }));

  it('without a teleporter, buys one with the city gold', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const price = itemGoldPrice(ItemId.CITY_TELEPORTER)!;
      const from = (await reloadCity(g, p.cityId)).tileId;
      const to = await freeFlat(g, [from]);
      await setResources(g, p, { gold: price - 1 });
      await expectRefused(interior.moveCity(g, p.id, p.cityId, to), msg('common.notEnoughGoldFor', { amount: price }));
      await setResources(g, p, { gold: price });
      await interior.moveCity(g, p.id, p.cityId, to);
      expect(await reloadCity(g, p.cityId)).toMatchObject({ tileId: to, gold: 0 });
    }));

  it('loses the valleys the city held', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.CITY_TELEPORTER]: 1 });
      const valley = await freeValley(g);
      // no factory occupies a valley: hand it to the city directly
      await g.tx.update(tiles).set({ ownerCityId: p.cityId, ownerPlayerId: p.id }).where(eq(tiles.id, valley));
      expect((await cityBundle(g, p)).valleys.map((v) => v.id)).toEqual([valley]);
      const from = (await reloadCity(g, p.cityId)).tileId;
      await interior.moveCity(g, p.id, p.cityId, await freeFlat(g, [from]));
      expect(await getTile(g, valley)).toMatchObject({ ownerCityId: null, ownerPlayerId: null });
    }));

  it('needs a free flat as the target', () =>
    game(async (g) => {
      const p = await createTestPlayer(g);
      const other = await createTestPlayer(g);
      await giveItems(g, p, { [ItemId.CITY_TELEPORTER]: 1 });
      const occupied = (await reloadCity(g, other.cityId)).tileId;
      for (const target of [occupied, await freeValley(g), -1]) await expectRefused(interior.moveCity(g, p.id, p.cityId, target), msg('city.notFreeFlat'));
      expect((await reloadPlayer(g, p)).items[ItemId.CITY_TELEPORTER]).toBe(1);
    }));

  it('needs every army home and no foreign troops on the way', () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await giveItems(g, a, { [ItemId.CITY_TELEPORTER]: 1 });
      await giveItems(g, b, { [ItemId.CITY_TELEPORTER]: 1 });
      await scoutAt(g, a, b);
      const avoid = [(await reloadCity(g, a.cityId)).tileId, (await reloadCity(g, b.cityId)).tileId];
      await expectRefused(interior.moveCity(g, a.id, a.cityId, await freeFlat(g, avoid)), msg('city.recallTroopsFirst'));
      await expectRefused(interior.moveCity(g, b.id, b.cityId, await freeFlat(g, avoid)), msg('city.foreignTroops'));
    }));

  it("refuses another lord's city", () =>
    game(async (g) => {
      const a = await createTestPlayer(g);
      const b = await createTestPlayer(g);
      await expectRefused(interior.moveCity(g, a.id, b.cityId, await freeFlat(g)), msg('common.invalidCastle'));
    }));
});
