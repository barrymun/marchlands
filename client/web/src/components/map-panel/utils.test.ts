import { describe, expect, it } from 'vitest';
import { Relation, TileType } from '@marchlands/core';
import { placeName, relationGroup } from '@/components/map-panel/utils';

describe(relationGroup.name, () => {
  it('groups alliance members and allies as friends', () => {
    expect(relationGroup(Relation.ALLIANCE)).toBe('friend');
    expect(relationGroup(Relation.ALLY)).toBe('friend');
  });

  it('groups enemies as enemies', () => {
    expect(relationGroup(Relation.ENEMY)).toBe('enemy');
  });

  it('groups every other relation (and unknown values) as other', () => {
    expect(relationGroup(Relation.NEUTRAL)).toBe('other');
    expect(relationGroup(Relation.NO_RELATION)).toBe('other');
    expect(relationGroup(Relation.SELF)).toBe('other');
    expect(relationGroup(99)).toBe('other');
  });
});

describe(placeName.name, () => {
  it('names a city by its own name', () => {
    expect(placeName({ type: TileType.CASTLE, name: 'Aachen' })).toBe('Aachen');
  });

  it('names any other tile by its type', () => {
    expect(placeName({ type: TileType.NPC })).toBe('Barbarian city');
    expect(placeName({ type: TileType.GRASS })).toBe('Grassland');
    expect(placeName({ type: TileType.FLAT, name: '' })).toBe('Flat');
  });
});
