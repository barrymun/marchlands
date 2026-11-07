import { describe, expect, it } from 'vitest';

import type { MapFieldInfo } from '@marchlands/api-client';
import { Relation, TileType } from '@marchlands/core';

import { heldByAnotherPlayer } from '@/components/map-panel/tile-card/utils';

const base = { id: 1, x: 1, y: 0, level: 1, zoneId: 0, canLoot: false, canOccupy: false, canScout: false, canSend: false, canTrans: false };
const city = (relation: number) => ({ ...base, type: TileType.CASTLE, npc: false, playerId: 7, relation }) as unknown as MapFieldInfo;
const valley = (owner: object | null, relation: number) => ({ ...base, type: TileType.FOREST, npc: false, owner, relation }) as unknown as MapFieldInfo;

describe(heldByAnotherPlayer.name, () => {
  it.each([Relation.NO_RELATION, Relation.NEUTRAL, Relation.ENEMY])("is true of a stranger's city and valley at relation %i", (relation) => {
    expect(heldByAnotherPlayer(city(relation))).toBe(true);
    expect(heldByAnotherPlayer(valley({ cityId: 2, cityName: 'Fen', playerId: 7, userName: 'Tam' }, relation))).toBe(true);
  });

  it.each([Relation.SELF, Relation.ALLIANCE, Relation.ALLY])('is false of the player and their friends at relation %i', (relation) => {
    expect(heldByAnotherPlayer(city(relation))).toBe(false);
    expect(heldByAnotherPlayer(valley({ cityId: 2, cityName: 'Fen', playerId: 7, userName: 'Tam' }, relation))).toBe(false);
  });

  it('is false of a tile nobody holds', () => {
    expect(heldByAnotherPlayer(valley(null, Relation.NO_RELATION))).toBe(false);
    expect(heldByAnotherPlayer({ ...base, type: TileType.NPC, npc: true, owner: null, relation: Relation.NO_RELATION } as unknown as MapFieldInfo)).toBe(false);
  });
});
