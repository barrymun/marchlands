import { describe, expect, it } from 'vitest';
import { Relation } from '@marchlands/core';
import { relationGroup } from '@/components/map-panel/utils';

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
