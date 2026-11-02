import { afterEach, describe, expect, it, vi } from 'vitest';

import { Relation, TileType } from '@marchlands/core';

import { FACTION_TINT_KEY } from '@/components/map-panel/constants';
import { farmedTiles, farmLists, placeName, readFactionTint, relationGroup, saveFactionTint, wrap } from '@/components/map-panel/utils';

describe(wrap.name, () => {
  it('keeps a coordinate on the map', () => {
    expect(wrap(5, 800)).toBe(5);
    expect(wrap(800, 800)).toBe(0);
    expect(wrap(-1, 800)).toBe(799);
    expect(wrap(-801, 800)).toBe(799);
  });
});

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
    // a historic city by its own name from level 14, by its type at level 12
    expect(placeName({ type: TileType.HISTORIC, x: 0, y: 0 })).toBe('Atlantis');
    expect(placeName({ type: TileType.HISTORIC, x: 33, y: 33 })).toBe('Tirana');
    expect(placeName({ type: TileType.HISTORIC, x: 9, y: 9 })).toBe('Historic city');
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

const cities = [
  { id: 1, name: 'Home' },
  { id: 2, name: 'North' },
  { id: 3, name: 'Idle' },
];
const attack = (targets: Record<string, number[]>) => ({ type: 'attackTargets' as const, presetId: 'p', targets });
const flows = [
  { name: 'Farm A', actions: [{ type: 'setMayor' as const, stat: 'power' as const }, attack({ '1': [100, 101], '2': [200] })] },
  { name: 'Farm B', actions: [attack({ '2': [200, 201], '9': [900] })] },
];

describe(farmLists.name, () => {
  it("lists the open city's targets first, then the other cities', each target once with the flows listing it", () => {
    expect(farmLists(flows, cities, 2)).toEqual([
      {
        cityId: 2,
        cityName: 'North',
        here: true,
        targets: [
          { tileId: 200, flows: ['Farm A', 'Farm B'] },
          { tileId: 201, flows: ['Farm B'] },
        ],
      },
      {
        cityId: 1,
        cityName: 'Home',
        here: false,
        targets: [
          { tileId: 100, flows: ['Farm A'] },
          { tileId: 101, flows: ['Farm A'] },
        ],
      },
    ]);
  });

  it('leaves out cities with no targets, cities the player no longer has, and flows that do not attack', () => {
    expect(farmLists([{ name: 'Mayor', actions: [{ type: 'setMayor', stat: 'power' }] }], cities, 1)).toEqual([]);
    expect(farmLists(flows, cities, 3).map((l) => l.cityId)).toEqual([1, 2]);
  });
});

describe(farmedTiles.name, () => {
  it('marks each target with whether the open city farms it and every city that does', () => {
    const shared = farmLists([...flows, { name: 'Farm C', actions: [attack({ '1': [200] })] }], cities, 1);
    const marks = farmedTiles(shared);
    expect(marks.get(200)).toEqual({ here: true, cities: ['Home', 'North'] });
    expect(marks.get(201)).toEqual({ here: false, cities: ['North'] });
    expect(marks.has(900)).toBe(false);
  });
});
