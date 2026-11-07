import type { MapFieldInfo } from '@marchlands/api-client';
import { Relation } from '@marchlands/core';

/** Whether a tile is a city or valley held by a player who isn't the viewer or a friend of theirs. */
export function heldByAnotherPlayer(tile: MapFieldInfo): boolean {
  const held = ('playerId' in tile && tile.playerId != null) || ('owner' in tile && tile.owner != null);
  return held && tile.relation !== Relation.SELF && tile.relation !== Relation.ALLIANCE && tile.relation !== Relation.ALLY;
}
