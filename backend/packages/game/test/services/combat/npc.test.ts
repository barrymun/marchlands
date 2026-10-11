import { describe, expect, it } from 'vitest';
import { BuildingStatus, BuildingType } from '@marchlands/core';
import { combat } from '../../../src/index.ts';

describe(combat.npcCityBuildings.name, () => {
  it('lays out a barbarian city as real buildings, all at its level', () => {
    const list = combat.npcCityBuildings(3);
    const at = (pos: number) => list.find((b) => b.positionId === pos);
    expect(at(-1)).toEqual({ positionId: -1, typeId: BuildingType.TOWN_HALL, level: 3, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 });
    expect(at(-2)?.typeId).toBe(BuildingType.WALLS);
    // the twelve inner buildings, then twenty cottages
    expect(list.filter((b) => b.positionId >= 0 && b.positionId < 12).map((b) => b.typeId)).toEqual([
      BuildingType.ACADEMY,
      BuildingType.FORGE,
      BuildingType.EMBASSY,
      BuildingType.FEASTING_HALL,
      BuildingType.MARKETPLACE,
      BuildingType.BEACON_TOWER,
      BuildingType.STABLE,
      BuildingType.INN,
      BuildingType.RALLY_SPOT,
      BuildingType.RELIEF_STATION,
      BuildingType.WORKSHOP,
      BuildingType.BARRACKS,
    ]);
    expect(list.filter((b) => b.positionId >= 12 && b.positionId <= 31).every((b) => b.typeId === BuildingType.COTTAGE)).toBe(true);
    expect(list.filter((b) => b.typeId === BuildingType.COTTAGE)).toHaveLength(20);
    // 10 farms at level 1, 3 more per level, then a sawmill, a quarry and an iron mine
    expect(list.filter((b) => b.typeId === BuildingType.FARM)).toHaveLength(16);
    expect(list.slice(-3).map((b) => [b.positionId, b.typeId])).toEqual([
      [1017, BuildingType.SAWMILL],
      [1018, BuildingType.QUARRY],
      [1019, BuildingType.IRONMINE],
    ]);
    expect(list.every((b) => b.level === 3 && b.status === BuildingStatus.IDLE)).toBe(true);
    expect(new Set(list.map((b) => b.positionId)).size).toBe(list.length);
  });

  it('has 10 farms at level 1 and at most 37', () => {
    const farms = (level: number) => combat.npcCityBuildings(level).filter((b) => b.typeId === BuildingType.FARM).length;
    expect(farms(1)).toBe(10);
    expect(farms(9)).toBe(34);
    expect(farms(10)).toBe(37);
    expect(farms(12)).toBe(37);
    expect(combat.npcCityBuildings(1)).toHaveLength(2 + 12 + 20 + 10 + 3);
  });
});
