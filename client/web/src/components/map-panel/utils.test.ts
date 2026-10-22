import { afterEach, describe, expect, it, vi } from 'vitest';

import { Relation, TileType } from '@marchlands/core';

import { FACTION_TINT_KEY } from '@/components/map-panel/constants';
import { placeName, readFactionTint, relationGroup, saveFactionTint } from '@/components/map-panel/utils';

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

describe(readFactionTint.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is on only once this browser chose it', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === FACTION_TINT_KEY ? 'on' : null) });
    expect(readFactionTint()).toBe(true);
    vi.stubGlobal('localStorage', { getItem: () => 'off' });
    expect(readFactionTint()).toBe(false);
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readFactionTint()).toBe(false);
  });

  it('is off when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readFactionTint()).toBe(false);
  });
});

describe(saveFactionTint.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('remembers the choice', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveFactionTint(true);
    saveFactionTint(false);
    expect(setItem.mock.calls).toEqual([
      [FACTION_TINT_KEY, 'on'],
      [FACTION_TINT_KEY, 'off'],
    ]);
  });

  it('carries on when storage throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveFactionTint(true)).not.toThrow();
  });
});
