import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  buildingEffect,
  buildingInfo,
  BuildingType,
  FortType,
  innHeroMaxLevel,
  innOffers,
  isFortType,
  type Message,
  msgParamNames,
  ref,
  TroopType,
  unlockedOuterSlots,
  wallHitPoints,
} from '#/index.ts';

/** building types that stand in a slot (fortifications share the ids but are built at the walls) */
const ALL = Object.values(BuildingType).filter((t) => !isFortType(t));

/** every message (nested ones too) carries exactly the params its code takes */
function expectWellFormed(m: Message) {
  expect(Object.keys(m.params ?? {}).sort()).toEqual([...msgParamNames(m.code)].sort());
}

describe('buildingInfo', () => {
  it('describes every building with messages', () => {
    for (const typeId of ALL) {
      const info = buildingInfo(typeId);
      expect(info.typeId).toBe(typeId);
      expect(info.summary?.code, `summary ${typeId}`).toMatch(/^buildingInfo\.summary\./);
      expect(info.placement?.code, `placement ${typeId}`).toMatch(/^buildingInfo\.placement\./);
      expectWellFormed(info.summary!);
      expectWellFormed(info.placement!);
    }
  });

  it('quotes BALANCE in summaries', () => {
    expect(buildingInfo(BuildingType.TOWN_HALL).summary).toEqual({
      code: 'buildingInfo.summary.townHall',
      params: {
        count: BALANCE.outerSlotsPerTownHall,
        base: BALANCE.outerSlotsBase,
        level: BALANCE.beginnerTownHallLevel,
        building: ref.building(BuildingType.TOWN_HALL),
      },
    });
    expect(buildingInfo(BuildingType.SAWMILL).summary).toEqual({ code: 'buildingInfo.summary.field', params: { resource: ref.resource('wood') } });
    expect(buildingInfo(BuildingType.WALLS).summary?.params?.forts).toEqual(Object.values(FortType).map((id) => ref.troop(id)));
  });

  it('places buildings by where they may stand', () => {
    expect(buildingInfo(BuildingType.TOWN_HALL).placement?.code).toBe('buildingInfo.placement.unique');
    expect(buildingInfo(BuildingType.WALLS).placement?.code).toBe('buildingInfo.placement.unique');
    expect(buildingInfo(BuildingType.FARM).placement?.code).toMatch(/^buildingInfo\.placement\.outside/);
    expect(buildingInfo(BuildingType.COTTAGE).placement?.code).toMatch(/^buildingInfo\.placement\.inside/);
  });

  it('lists unlocks by id, lowest level first, without names', () => {
    const unlocks = buildingInfo(BuildingType.BARRACKS).unlocks;
    expect(unlocks.length).toBeGreaterThan(0);
    for (const u of unlocks) expect(Object.keys(u).sort()).toEqual(['id', 'kind', 'level']);
    for (let i = 1; i < unlocks.length; i++) expect(unlocks[i].level).toBeGreaterThanOrEqual(unlocks[i - 1].level);
    expect(unlocks).toContainEqual(expect.objectContaining({ kind: 'troop', id: TroopType.WARRIOR }));
  });

  it('has no summary or placement for an unknown type or a fortification', () => {
    expect(buildingInfo(999)).toEqual({ typeId: 999, summary: null, placement: null, unlocks: [] });
    expect(buildingInfo(FortType.TRAP)).toMatchObject({ summary: null, placement: null });
  });
});

describe('buildingEffect', () => {
  it('is null at level 0 and for buildings without a measurable effect', () => {
    expect(buildingEffect(BuildingType.COTTAGE, 0)).toBeNull();
    expect(buildingEffect(BuildingType.EMBASSY, 1)).toBeNull();
    expect(buildingEffect(999, 1)).toBeNull();
  });

  it('is a well-formed message at every level', () => {
    for (const typeId of ALL)
      for (let l = 1; l <= 10; l++) {
        const e = buildingEffect(typeId, l);
        if (e) expectWellFormed(e);
      }
  });

  it('follows the rules it describes', () => {
    expect(buildingEffect(BuildingType.TOWN_HALL, 4)).toEqual({ code: 'buildingInfo.effect.townHall', params: { slots: unlockedOuterSlots(4), count: 4 } });
    expect(buildingEffect(BuildingType.COTTAGE, 3)).toEqual({ code: 'buildingInfo.effect.cottage', params: { population: BALANCE.cottagePopulation[3] } });
    expect(buildingEffect(BuildingType.RALLY_SPOT, 2)?.params).toEqual({
      count: 2 * BALANCE.rallySpotArmiesPerLevel,
      troops: 2 * BALANCE.rallySpotTroopsPerLevel,
    });
    expect(buildingEffect(BuildingType.FARM, 1)?.params).toMatchObject({
      resource: ref.resource('food'),
      count: BALANCE.fieldWorkersPerF * BALANCE.fieldFactor[1],
    });
    expect(buildingEffect(BuildingType.BEACON_TOWER, 1)?.code).toBe('buildingInfo.effect.beaconTroops');
    expect(buildingEffect(BuildingType.BEACON_TOWER, 2)?.code).toBe('buildingInfo.effect.beaconHeroes');
  });

  it('quotes the walls hit points and archer tower range from the battle rules', () => {
    expect(buildingEffect(BuildingType.WALLS, 3)?.params).toMatchObject({
      space: BALANCE.wallSpace[3],
      count: 3,
      hitPoints: wallHitPoints(3),
      percent: { share: 0.135 },
    });
    expect(buildingEffect(BuildingType.WALLS, 10)?.params).toMatchObject({
      hitPoints: 5_500_000,
      percent: { share: (10 * BALANCE.battle.wallTowerRangePct) / 100 },
    });
  });

  it('quotes the Inn offers and their highest hero level', () => {
    expect(buildingEffect(BuildingType.INN, 4)?.params).toEqual({ count: innOffers(4), level: innHeroMaxLevel(4) });
    expect(buildingEffect(BuildingType.INN, 10)?.params).toEqual({ count: BALANCE.inn.maxOffers, level: 10 * BALANCE.inn.heroLevelsPerInnLevel });
  });
});
