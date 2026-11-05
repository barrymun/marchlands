import { describe, expect, it } from 'vitest';

import { ArmyBean, BuffBean, CityBean, HeroBean, PlayerInfo } from '@marchlands/contracts';
import {
  BALANCE,
  BuffId,
  type BuildingState,
  BuildingType,
  FORT_KEY_LIST,
  HeroBuffId,
  HeroStatus,
  mayorProductionBonus,
  msg,
  Sex,
  stateOf,
  TileType,
  tileXY,
  TROOP_KEY_LIST,
} from '@marchlands/core';

import { type CityBundle, cityStats } from '#/city.ts';
import { armyBean, buffsArray, buildingBean, cityBean, fortBean, heroBean, itemsArray, playerInfo, resourceBean, troopBean, valleyBean } from '#/dto.ts';
import { armyRow, bundle, cityRow, heroRow, playerRow, T0, tileRow } from '#test/support/city-rows.ts';

const building = (positionId: number, typeId: number, level: number): BuildingState => ({ positionId, typeId, level, status: 0, startTime: 0, endTime: 0 });
const FARM_2 = BALANCE.fieldProductionPerF * BALANCE.fieldFactor[2];
const FARM_2_WORKERS = BALANCE.fieldWorkersPerF * BALANCE.fieldFactor[2];
const ARCHER_UPKEEP = 9;

/**
 * A city with every production source for food: a level 2 farm, Agriculture 1 (Academy 1), a mayor of
 * management 50 (level 2), a level 1 lake, the food production item; 10 archers, tax rate 10%.
 */
function producingCity(over: { city?: Parameters<typeof cityRow>[0]; buffs?: CityBundle['player']['buffs'] } = {}): CityBundle {
  return bundle({
    player: playerRow({ research: { 1: { level: 1 } }, buffs: over.buffs ?? [{ id: BuffId.FOOD_PRODUCTION, desc: msg('buff.truce'), endTime: T0 + 1 }] }),
    city: cityRow({
      food: 1234.9,
      taxRate: 10,
      troops: { archer: 10 },
      buildings: [building(1001, BuildingType.FARM, 2), building(-1, BuildingType.TOWN_HALL, 1), building(1, BuildingType.ACADEMY, 1)],
      ...over.city,
    }),
    heroes: [heroRow({ status: HeroStatus.MAYOR, management: 50, level: 2 })],
    valleys: [tileRow({ type: TileType.LAKE, level: 1, ownerCityId: 1 })],
  });
}

describe(troopBean.name, () => {
  it('lists every troop type, whole numbers, 0 when absent', () => {
    const t = troopBean({ archer: 10.9, militia: 3 });
    expect(Object.keys(t)).toEqual(TROOP_KEY_LIST);
    expect(t).toMatchObject({ archer: 10, militia: 3, peasants: 0, catapult: 0 });
  });
});

describe(fortBean.name, () => {
  it('lists every fortification type, whole numbers, 0 when absent', () => {
    const f = fortBean({ trap: 4.5 });
    expect(Object.keys(f)).toEqual(FORT_KEY_LIST);
    expect(Object.values(f).reduce((s, n) => s + n, 0)).toBe(4);
  });
});

describe(buildingBean.name, () => {
  it("keeps the building's fields", () => {
    const b: BuildingState = { positionId: 3, typeId: BuildingType.COTTAGE, level: 4, status: 1, startTime: T0, endTime: T0 + 1000 };
    expect(buildingBean(b)).toEqual(b);
  });
});

describe(heroBean.name, () => {
  it('whole experience, the gear attribute and the boosts; matches the contract', () => {
    const boost = { id: HeroBuffId.POWER, desc: msg('buff.truce'), endTime: T0 + 1000, param: 12 };
    const h = heroRow({ experience: 99.8, power: 30, management: 50, stratagem: 20, buffs: [boost] });
    const bean = heroBean(h);
    expect(bean).toMatchObject({ id: h.id, experience: 99, gearStat: 'management', buffs: [boost] });
    expect(HeroBean.parse(bean)).toEqual(bean);
    expect(heroBean(heroRow({ gearStat: 'stratagem' }))).toMatchObject({ gearStat: 'stratagem' });
  });

  it("carries the hero's sex for its figure", () => {
    expect(heroBean(heroRow({ sex: Sex.FEMALE })).sex).toBe(Sex.FEMALE);
    expect(heroBean(heroRow({ sex: Sex.MALE })).sex).toBe(Sex.MALE);
  });

  it("leaves out the hero's lord, Inn and order", () => {
    const bean = heroBean(heroRow());
    for (const k of ['playerId', 'inTavern', 'sortOrder', 'createdAt']) expect(bean).not.toHaveProperty(k);
  });
});

describe(valleyBean.name, () => {
  it('places the tile on the map', () => {
    const id = 3 * BALANCE.mapSize + 17;
    expect(valleyBean(tileRow({ id, type: TileType.HILL, level: 5, ownerCityId: 8 }))).toEqual({
      id,
      x: 17,
      y: 3,
      type: TileType.HILL,
      level: 5,
      ownerCityId: 8,
    });
  });
});

describe(resourceBean.name, () => {
  it('splits food production by source, and the parts add up to the net rate', () => {
    const b = producingCity();
    const food = resourceBean(b, cityStats(b, T0)).food;
    const mayor = mayorProductionBonus(50);
    const valley = BALANCE.valleyBonus.lake[1];
    const share = BALANCE.resourceTechBonusPerLevel;
    const buff = BALANCE.resourceBuffBonus;
    const gross = FARM_2 * (1 + share + mayor + valley + buff) + BALANCE.baseProductionPerHour;
    expect(food.breakdown).toEqual({
      base: BALANCE.baseProductionPerHour,
      fields: FARM_2,
      tech: Math.round(FARM_2 * share),
      mayor: Math.round(FARM_2 * mayor),
      valley: Math.round(FARM_2 * valley),
      buff: Math.round(FARM_2 * buff),
      upkeep: -10 * ARCHER_UPKEEP,
      tax: -Math.round(gross * 10) / 100,
      techBonus: share,
      mayorBonus: mayor,
      valleyBonus: valley,
      buffBonus: buff,
    });
    const { techBonus: _t, mayorBonus: _m, valleyBonus: _v, buffBonus: _b, ...amounts } = food.breakdown;
    const sum = Object.values(amounts).reduce((s, n) => s + n, 0);
    expect(sum).toBeCloseTo(food.increaseRate, 1);
    expect(food.increaseRate).toBeCloseTo(gross * 0.9 - 10 * ARCHER_UPKEEP, 2);
    expect(food.bonus).toBeCloseTo(share + mayor + valley + buff, 9);
  });

  it('a resource without fields makes the base output, less the tax, with no upkeep', () => {
    const b = producingCity();
    const wood = resourceBean(b, cityStats(b, T0)).wood;
    expect(wood.breakdown).toMatchObject({ base: BALANCE.baseProductionPerHour, fields: 0, tech: 0, mayor: 0, valley: 0, buff: 0, upkeep: 0, tax: -10 });
    expect(wood.increaseRate).toBe(BALANCE.baseProductionPerHour * 0.9);
  });

  it('shows whole amounts, the storage, store share, work rate and workers of each resource', () => {
    const b = producingCity();
    const stats = cityStats(b, T0);
    const bean = resourceBean(b, stats);
    expect(bean.food).toMatchObject({ amount: 1234, max: stats.storage.food, storePercent: 25, workRate: 100, workPeople: FARM_2_WORKERS });
    expect(bean.wood).toMatchObject({ amount: BALANCE.startingResources, workPeople: 0 });
  });

  it('a work rate the city never set counts as 100%', () => {
    const b = producingCity({ city: { workRates: { gold: 100, wood: 50 } } });
    expect(resourceBean(b, cityStats(b, T0)).food.workRate).toBe(100);
  });

  it('gold: base tax plus the sold output, less the salaries', () => {
    const b = producingCity();
    const stats = cityStats(b, T0);
    const bean = resourceBean(b, stats);
    const baseTax = BALANCE.startPopulation * BALANCE.baseTaxShare;
    expect(bean).toMatchObject({
      gold: BALANCE.startingResources,
      taxRate: 10,
      taxIncome: Math.round(stats.taxIncome),
      taxConverted: Math.round(stats.taxConverted),
      taxItemBonus: 0,
      taxItemShare: 0,
      herosSalary: 2 * BALANCE.heroSalaryPerLevel,
      troopCostFood: 10 * ARCHER_UPKEEP,
    });
    expect(stats.taxIncome).toBeCloseTo(baseTax + stats.taxConverted, 9);
    expect(bean.goldRate).toBeCloseTo(stats.taxIncome - 2 * BALANCE.heroSalaryPerLevel, 2);
  });

  it('the gold production item adds its share of the base tax', () => {
    const b = producingCity({ buffs: [{ id: BuffId.GOLD_PRODUCTION, desc: msg('buff.truce'), endTime: T0 + 1 }] });
    const bean = resourceBean(b, cityStats(b, T0));
    expect(bean.taxItemShare).toBe(BALANCE.resourceBuffBonus);
    expect(bean.taxItemBonus).toBe(Math.round(BALANCE.startPopulation * BALANCE.baseTaxShare * BALANCE.resourceBuffBonus));
  });

  it('population: whole people, workers needed, idle people, labour efficiency', () => {
    const staffed = producingCity();
    expect(resourceBean(staffed, cityStats(staffed, T0))).toMatchObject({
      curPopulation: BALANCE.startPopulation,
      maxPopulation: BALANCE.basePopulation,
      workPeople: FARM_2_WORKERS,
      idlePopulation: BALANCE.startPopulation - FARM_2_WORKERS,
      efficiency: 1,
      populationDirection: 0,
      updatedAt: T0,
    });
    const short = producingCity({ city: { population: FARM_2_WORKERS / 2 + 0.7 } });
    const bean = resourceBean(short, cityStats(short, T0));
    expect(bean).toMatchObject({ curPopulation: FARM_2_WORKERS / 2, idlePopulation: 0, efficiency: 0.5, populationDirection: 1 });
    expect(bean.food.breakdown.fields).toBe(FARM_2 / 2);
    const crowded = producingCity({ city: { population: 80 } });
    expect(resourceBean(crowded, cityStats(crowded, T0)).populationDirection).toBe(-1);
  });
});

describe(cityBean.name, () => {
  it('describes the city, its buildings by position, troops, forts, heroes and valleys; matches the contract', () => {
    const tileId = 250 * BALANCE.mapSize + 610;
    const b = producingCity({ city: { tileId, injuredTroops: { militia: 2.5 }, forts: { trap: 3 } } });
    const bean = cityBean(b, T0);
    const { x, y } = tileXY(tileId);
    expect(bean).toMatchObject({
      id: b.city.id,
      name: b.city.name,
      fieldId: tileId,
      x,
      y,
      zoneId: stateOf(tileId),
      status: 0,
      allowAlliance: false,
      goOutForBattle: true,
      troop: troopBean({ archer: 10 }),
      injuredTroop: troopBean({ militia: 2 }),
      fortification: fortBean({ trap: 3 }),
      heros: b.heroes.map(heroBean),
      fields: b.valleys.map(valleyBean),
      createdAt: T0,
    });
    expect(bean.resource).toEqual(resourceBean(b, cityStats(b, T0)));
    expect(bean.buildings.map((x) => x.positionId)).toEqual([-1, 1, 1001]);
    expect(CityBean.parse(bean)).toEqual(bean);
  });
});

describe(playerInfo.name, () => {
  it("whole prestige and honor, the alliance's name and the city count; matches the contract", () => {
    const p = playerRow({ prestige: 10.9, honor: 5.5, allianceId: 3, allianceRank: 2, misc: { changedFace: true }, population: 120 });
    const info = playerInfo(p, { allianceName: 'Guild', cityCount: 2, population: 300 });
    expect(info).toMatchObject({
      id: p.id,
      userName: p.name,
      prestige: 10,
      honor: 5,
      allianceId: 3,
      alliance: 'Guild',
      levelId: 2,
      castleCount: 2,
      population: 300,
    });
    expect(info.changedFace).toBe(true);
    expect(PlayerInfo.parse(info)).toEqual(info);
  });

  it("defaults: no alliance name, the player's stored population, an unchanged face", () => {
    const info = playerInfo(playerRow({ population: 120 }), { cityCount: 1 });
    expect(info).toMatchObject({ alliance: '', population: 120, changedFace: false, createrTime: T0, lastLoginTime: 0 });
  });
});

describe(itemsArray.name, () => {
  it('lists the items the player holds, by id', () => {
    expect(itemsArray({ 'b.item': 2, 'a.item': 1, 'c.item': 0, 'd.item': -1 })).toEqual([
      { id: 'a.item', count: 1 },
      { id: 'b.item', count: 2 },
    ]);
  });
});

describe(buffsArray.name, () => {
  it('lists the buffs still running, matching the contract', () => {
    const desc = msg('buff.truce');
    const running = { id: BuffId.ATTACK, desc, endTime: T0 + 1, param: 5, cityId: 2, itemId: 'player.attack.1' };
    const list = buffsArray([running, { id: BuffId.DEFENSE, desc, endTime: T0 }], T0);
    expect(list).toEqual([running]);
    expect(list.map((b) => BuffBean.parse(b))).toEqual(list);
  });
});

describe(armyBean.name, () => {
  it("describes the march with the hero's and lord's names; matches the contract", () => {
    const a = armyRow({ id: 5, heroId: 9, troops: { archer: 7.5 }, resources: { gold: 1, food: 2, wood: 3, stone: 4, iron: 5 } });
    const bean = armyBean(a, { heroName: 'Hero', heroLevel: 12, king: 'Lord' });
    expect(bean).toMatchObject({
      armyId: 5,
      heroId: 9,
      king: 'Lord',
      hero: 'Hero',
      heroLevel: 12,
      missionType: a.mission,
      direction: a.direction,
      startFieldId: a.startTileId,
      targetFieldId: a.targetTileId,
      troop: troopBean({ archer: 7 }),
      resource: a.resources,
    });
    expect(ArmyBean.parse(bean)).toEqual(bean);
  });

  it('hides the troops and load of an army the viewer cannot see', () => {
    expect(armyBean(armyRow({ troops: { archer: 7 } }), { visible: false })).toMatchObject({ troop: null, resource: null, king: '', hero: '', heroLevel: 0 });
  });
});
