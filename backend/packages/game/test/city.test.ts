import { describe, expect, it } from 'vitest';

import { BALANCE, BuffId, computeCityStats, HeroStatus, mayorProductionBonus, msg, TileType } from '@marchlands/core';

import { cityStats, economyContext, mayorOf, mayorStats } from '#/city.ts';
import { bundle, cityRow, heroRow, playerRow, T0, tileRow } from '#test/support/city-rows.ts';

describe(mayorOf.name, () => {
  it('is the hero with the mayor status', () => {
    const mayor = heroRow({ status: HeroStatus.MAYOR });
    expect(mayorOf([heroRow(), mayor, heroRow({ status: HeroStatus.ATTACK })])).toBe(mayor);
  });

  it('is undefined without a mayor', () => {
    expect(mayorOf([])).toBeUndefined();
    expect(mayorOf([heroRow(), heroRow({ status: HeroStatus.RETURN })])).toBeUndefined();
  });
});

describe(mayorStats.name, () => {
  it('is null without a mayor (no production bonus), however able the heroes', () => {
    expect(mayorStats([heroRow({ management: 500 })])).toBeNull();
  });

  it('counts assigned points, gear and boosts in each attribute', () => {
    const m = heroRow({
      status: HeroStatus.MAYOR,
      power: 40,
      powerAdded: 6,
      powerBuffAdded: 4,
      management: 70,
      managementAdded: 10,
      managementBuffAdded: 20,
      stratagem: 15,
      stratagemAdded: 0,
      stratagemBuffAdded: 3,
    });
    expect(mayorStats([heroRow(), m])).toEqual({ power: 50, management: 100, stratagem: 18 });
  });
});

describe(economyContext.name, () => {
  it("passes the lord's research and buffs, the valleys' types and levels and the troops away", () => {
    const buffs = [{ id: BuffId.FOOD_PRODUCTION, desc: msg('buff.homeCity'), endTime: T0 + 1000 }];
    const b = bundle({
      player: playerRow({ research: { 1: { level: 3 } }, buffs }),
      valleys: [tileRow({ id: 7, type: TileType.LAKE, level: 4, ownerCityId: 1 }), tileRow({ id: 9, type: TileType.HILL, level: 2, ownerCityId: 1 })],
      awayTroops: { archer: 12 },
    });
    expect(economyContext(b)).toEqual({
      research: { 1: { level: 3 } },
      mayor: null,
      heroLevels: [],
      valleys: [
        { type: TileType.LAKE, level: 4 },
        { type: TileType.HILL, level: 2 },
      ],
      buffs,
      awayTroops: { archer: 12 },
    });
  });

  it('pays the heroes of the city owner, not prisoners held there', () => {
    const own = [heroRow({ level: 3 }), heroRow({ level: 7, status: HeroStatus.MAYOR, management: 30 })];
    const prisoner = heroRow({ playerId: 2, level: 9, status: HeroStatus.SEIZED, capturedByPlayerId: 1 });
    const ctx = economyContext(bundle({ heroes: [...own, prisoner] }));
    expect(ctx.heroLevels).toEqual([3, 7]);
    expect(ctx.mayor).toEqual({ power: 10, management: 30, stratagem: 10 });
  });
});

describe(cityStats.name, () => {
  it("is core's computeCityStats with the bundle's economy context", () => {
    const b = bundle({
      city: cityRow({ buildings: [{ positionId: 1001, typeId: 7, level: 3, status: 0, startTime: 0, endTime: 0 }], troops: { archer: 10 } }),
      heroes: [heroRow({ status: HeroStatus.MAYOR, management: 60, level: 4 })],
      awayTroops: { militia: 5 },
    });
    expect(cityStats(b, T0)).toEqual(computeCityStats(b.city, economyContext(b), T0));
  });

  it('a new city makes the base output of every resource and the base tax, and pays its heroes', () => {
    const s = cityStats(bundle({ heroes: [heroRow({ level: 2 })] }), T0);
    const baseTax = BALANCE.startPopulation * BALANCE.baseTaxShare;
    expect(s.rates).toEqual({
      gold: baseTax - 2 * BALANCE.heroSalaryPerLevel,
      food: BALANCE.baseProductionPerHour,
      wood: BALANCE.baseProductionPerHour,
      stone: BALANCE.baseProductionPerHour,
      iron: BALANCE.baseProductionPerHour,
    });
  });

  it("adds the mayor's production bonus to every resource", () => {
    const s = cityStats(bundle({ heroes: [heroRow({ status: HeroStatus.MAYOR, management: 80 })] }), T0);
    for (const r of ['food', 'wood', 'stone', 'iron'] as const) expect(s.bonusParts[r].mayor).toBe(mayorProductionBonus(80));
  });

  it('feeds the troops at home and away', () => {
    const home = cityStats(bundle({ city: cityRow({ troops: { archer: 10 } }) }), T0);
    const both = cityStats(bundle({ city: cityRow({ troops: { archer: 10 } }), awayTroops: { archer: 5 } }), T0);
    expect(both.upkeep).toBe(home.upkeep * 1.5);
    expect(both.rates.food).toBe(BALANCE.baseProductionPerHour - both.upkeep);
  });
});
