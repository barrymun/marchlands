import { describe, expect, it } from 'vitest';

import { BALANCE, FortType, ResourceKey, troopConfig, TroopType } from '@marchlands/core';

import { TrainLimit } from '@/components/military-panel/production/constants';
import { limitLabel, maxTrainable } from '@/components/military-panel/production/utils';

/** A trainable row as the panel builds it: the unit's real cost, population and type id. */
function unit(typeId: number) {
  const c = troopConfig(typeId);
  if (!c) throw new Error(`no troop ${typeId}`);
  return { typeId, population: c.population, ...c.cost };
}

const plenty = { gold: 1e9, food: 1e9, wood: 1e9, stone: 1e9, iron: 1e9 };

describe(maxTrainable.name, () => {
  it('is limited by the scarcest resource', () => {
    // warrior: 80 food, 100 wood, 50 iron, 1 population
    const have = { ...plenty, food: 8_000, wood: 1_000_000, iron: 1_000_000 };
    expect(maxTrainable(unit(TroopType.WARRIOR), have, 1e6, Infinity, false)).toEqual({ count: 100, limit: ResourceKey.FOOD });
  });

  it('reports wood by its key', () => {
    const have = { ...plenty, wood: 250 };
    expect(maxTrainable(unit(TroopType.WARRIOR), have, 1e6, Infinity, false)).toEqual({ count: 2, limit: ResourceKey.WOOD });
  });

  it('ignores resources the unit does not cost (warriors need no gold or stone)', () => {
    const have = { ...plenty, gold: 0, stone: 0 };
    expect(maxTrainable(unit(TroopType.WARRIOR), have, 7, Infinity, false)).toEqual({ count: 7, limit: TrainLimit.IDLE_POPULATION });
  });

  it('is limited by idle population divided by the unit population', () => {
    // cataphracts take 6 population each
    const u = unit(TroopType.CATAPHRACT);
    expect(u.population).toBe(6);
    expect(maxTrainable(u, plenty, 20, Infinity, false)).toEqual({ count: 3, limit: TrainLimit.IDLE_POPULATION });
  });

  it('floors partial units', () => {
    const have = { ...plenty, food: 159 };
    expect(maxTrainable(unit(TroopType.WARRIOR), have, 1e6, Infinity, false).count).toBe(1);
  });

  it('keeps the first limit on a tie', () => {
    // warrior: 80 food, 100 wood -> both allow 3
    const have = { ...plenty, food: 240, wood: 300 };
    expect(maxTrainable(unit(TroopType.WARRIOR), have, 1e6, Infinity, false)).toEqual({ count: 3, limit: ResourceKey.FOOD });
  });

  it('returns zero when a resource is short of one unit', () => {
    expect(maxTrainable(unit(TroopType.WARRIOR), { ...plenty, iron: 49 }, 1e6, Infinity, false)).toEqual({ count: 0, limit: ResourceKey.IRON });
  });

  it('never returns a negative count', () => {
    expect(maxTrainable(unit(TroopType.WARRIOR), { ...plenty, food: -500 }, 1e6, Infinity, false)).toEqual({ count: 0, limit: ResourceKey.FOOD });
    expect(maxTrainable(unit(TroopType.WARRIOR), plenty, -3, Infinity, false)).toEqual({ count: 0, limit: TrainLimit.IDLE_POPULATION });
  });

  it('limits fortifications by wall space, using the footprint of each type', () => {
    // rolling logs take 4 wall space each
    const u = unit(FortType.ROLLING_LOG);
    expect(BALANCE.fortSpace[FortType.ROLLING_LOG]).toBe(4);
    expect(maxTrainable(u, plenty, 1e6, 10, true)).toEqual({ count: 2, limit: TrainLimit.WALL_SPACE });
  });

  it('applies wall space even to a fortification with no population (archer tower)', () => {
    const u = unit(FortType.ARCHER_TOWER);
    expect(u.population).toBe(0);
    // archer towers take 3 wall space each
    expect(maxTrainable(u, plenty, 0, 10, true)).toEqual({ count: 3, limit: TrainLimit.WALL_SPACE });
  });

  it('ignores wall space for troops', () => {
    expect(maxTrainable(unit(TroopType.WARRIOR), plenty, 5, 0, false)).toEqual({ count: 5, limit: TrainLimit.IDLE_POPULATION });
  });

  it('counts one wall space for a type missing from the footprint table', () => {
    const u = { typeId: 999, population: 0, gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
    expect(maxTrainable(u, plenty, 0, 4, true)).toEqual({ count: 4, limit: TrainLimit.WALL_SPACE });
  });

  it('reports "resources" when nothing limits the order', () => {
    const u = { typeId: 999, population: 0, gold: 0, food: 0, wood: 0, stone: 0, iron: 0 };
    expect(maxTrainable(u, plenty, 0, Infinity, false)).toEqual({ count: 0, limit: TrainLimit.RESOURCES });
  });

  it('uses scaled (discounted) costs as given', () => {
    // the panel passes costs already multiplied by the training cost share
    const u = { ...unit(TroopType.WARRIOR), food: 40 };
    expect(maxTrainable(u, { ...plenty, food: 8_000 }, 1e6, Infinity, false)).toEqual({ count: 200, limit: ResourceKey.FOOD });
  });
});

describe(limitLabel.name, () => {
  it('names a resource as it reads in a sentence, wood as "lumber"', () => {
    expect(limitLabel(ResourceKey.FOOD)).toBe('food');
    expect(limitLabel(ResourceKey.WOOD)).toBe('lumber');
    expect(limitLabel(ResourceKey.IRON)).toBe('iron');
  });

  it('names the other limits', () => {
    expect(limitLabel(TrainLimit.IDLE_POPULATION)).toBe('idle population');
    expect(limitLabel(TrainLimit.WALL_SPACE)).toBe('wall space');
    expect(limitLabel(TrainLimit.RESOURCES)).toBe('resources');
  });
});
