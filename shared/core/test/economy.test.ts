import { describe, expect, it } from 'vitest';
import { ResourceKey } from '#/constants.ts';
import { canUpgradeTile, HOLDABLE_VALLEY_TYPES, researchesInCity, TileType, VALLEY_RESOURCE, VALLEY_TYPES, valleyBonus, valleyResource } from '#/index.ts';

describe(researchesInCity.name, () => {
  it("lists the techs running in that city only, and none that aren't running", () => {
    const research = {
      1: { level: 2, cityId: 10, startTime: 1, endTime: 5 },
      2: { level: 0, cityId: 11, startTime: 1, endTime: 5 },
      3: { level: 4 },
      7: { level: 1, cityId: 10, startTime: 2, endTime: 9 },
    };
    expect(researchesInCity(research, 10)).toEqual([1, 7]);
    expect(researchesInCity(research, 11)).toEqual([2]);
    expect(researchesInCity(research, 12)).toEqual([]);
    expect(researchesInCity({}, 10)).toEqual([]);
  });

  it('a tech with no end time is not running, even with a city', () => {
    expect(researchesInCity({ 1: { level: 1, cityId: 10, endTime: 0 } }, 10)).toEqual([]);
  });
});

describe(valleyResource.name, () => {
  it('names the resource each valley type boosts', () => {
    expect(valleyResource(TileType.FOREST)).toBe(ResourceKey.WOOD);
    expect(valleyResource(TileType.DESERT)).toBe(ResourceKey.STONE);
    expect(valleyResource(TileType.HILL)).toBe(ResourceKey.IRON);
    expect(valleyResource(TileType.SWAMP)).toBe(ResourceKey.FOOD);
    expect(valleyResource(TileType.GRASS)).toBe(ResourceKey.FOOD);
    expect(valleyResource(TileType.LAKE)).toBe(ResourceKey.FOOD);
  });

  it('agrees with the table for every valley type', () => {
    for (const [type, resources] of Object.entries(VALLEY_RESOURCE)) expect(valleyResource(Number(type))).toBe(resources[0] ?? null);
  });

  it('names none for flat land or a tile that is not a valley', () => {
    expect(valleyResource(TileType.FLAT)).toBeNull();
    expect(valleyResource(TileType.CASTLE)).toBeNull();
    expect(valleyResource(TileType.NPC)).toBeNull();
  });
});

describe(valleyBonus.name, () => {
  it('gives no bonus for a tile that boosts nothing', () => {
    expect(valleyBonus(TileType.FLAT, 5)).toBe(0);
    expect(valleyBonus(TileType.CASTLE, 5)).toBe(0);
  });

  it('gives a valley a bonus that grows with its level', () => {
    expect(valleyBonus(TileType.FOREST, 2)).toBeGreaterThan(valleyBonus(TileType.FOREST, 1));
  });
});

describe(canUpgradeTile.name, () => {
  it('raises valleys, flat land included, and barbarian cities', () => {
    for (const type of VALLEY_TYPES) expect(canUpgradeTile(type)).toBe(true);
    expect(canUpgradeTile(TileType.FLAT)).toBe(true);
    expect(canUpgradeTile(TileType.NPC)).toBe(true);
  });

  it('never raises a player city or a historic city', () => {
    expect(canUpgradeTile(TileType.CASTLE)).toBe(false);
    expect(canUpgradeTile(TileType.HISTORIC)).toBe(false);
  });
});

describe('HOLDABLE_VALLEY_TYPES', () => {
  it('is every valley type but flat land', () => {
    expect(HOLDABLE_VALLEY_TYPES).toEqual(VALLEY_TYPES.filter((t) => t !== TileType.FLAT));
    expect(HOLDABLE_VALLEY_TYPES).not.toContain(TileType.FLAT);
  });

  it('holds exactly the valleys that boost a resource', () => {
    for (const type of VALLEY_TYPES) expect(HOLDABLE_VALLEY_TYPES.includes(type)).toBe(valleyResource(type) != null);
  });
});
