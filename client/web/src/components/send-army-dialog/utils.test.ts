import { describe, expect, it } from 'vitest';

import type { MapFieldInfo } from '@marchlands/api-client';
import { Mission, Relation, relationPermissions, TileType } from '@marchlands/core';

import { tileKind, tileMissions, tileTarget } from '@/components/send-army-dialog/utils';

/** A tile as the map endpoint sends it, with the permissions of a relation; only the fields these helpers read matter. */
const tile = (type: number, relation: number, extra: object = {}) =>
  ({ id: 500, x: 100, y: 0, type, level: 1, relation, ...relationPermissions(relation), ...extra }) as MapFieldInfo;

describe(tileKind.name, () => {
  it('tells cities, barbarian and historic cities, and valleys apart', () => {
    expect(tileKind({ type: TileType.CASTLE })).toBe('city');
    expect(tileKind({ type: TileType.NPC })).toBe('npc');
    expect(tileKind({ type: TileType.HISTORIC })).toBe('npc');
    expect(tileKind({ type: TileType.FOREST })).toBe('valley');
  });

  it('has nothing to scout on empty land', () => {
    expect(tileKind({ type: TileType.FLAT })).toBeUndefined();
  });
});

describe(tileMissions.name, () => {
  it('is nothing for the city the army leaves from', () => {
    expect(tileMissions(tile(TileType.CASTLE, Relation.SELF), 500)).toEqual([]);
  });

  it('offers reinforcing and transporting at the player own city', () => {
    expect(tileMissions(tile(TileType.CASTLE, Relation.SELF), 1)).toEqual([Mission.REINFORCE, Mission.TRANSPORT]);
  });

  it('offers attacking and scouting at a stranger', () => {
    expect(tileMissions(tile(TileType.CASTLE, Relation.NEUTRAL), 1)).toEqual([Mission.ATTACK, Mission.SCOUT]);
  });

  it('does not offer scouting on empty land, and offers a new city only where nobody holds it', () => {
    expect(tileMissions(tile(TileType.FLAT, Relation.NEUTRAL, { owner: null }), 1)).toEqual([Mission.ATTACK, Mission.BUILD_CITY]);
    expect(tileMissions(tile(TileType.FLAT, Relation.NEUTRAL, { owner: { cityName: 'Oakmere' } }), 1)).toEqual([Mission.ATTACK]);
  });
});

describe(tileTarget.name, () => {
  it('names the tile and lists its missions', () => {
    const target = tileTarget(tile(TileType.CASTLE, Relation.NEUTRAL, { name: 'Fenwick' }), 1);
    expect(target).toEqual({ tileId: 500, name: 'Fenwick', missions: [Mission.ATTACK, Mission.SCOUT], kind: 'city', own: false });
  });

  it('marks the player own places, for the Relief Station', () => {
    expect(tileTarget(tile(TileType.CASTLE, Relation.SELF, { name: 'Oakmere' }), 1).own).toBe(true);
  });
});
