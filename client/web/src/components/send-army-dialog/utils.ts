import type { MapFieldInfo } from '@marchlands/api-client';
import { BattleTarget, Mission, Relation, TileType } from '@marchlands/core';

import { placeName } from '@/components/map-panel/utils';
import type { SendTarget } from '@/components/send-army-dialog/types';

/** What can be scouted on a tile (empty land has nothing to see). */
export const tileKind = (tile: Pick<MapFieldInfo, 'type'>): SendTarget['kind'] =>
  tile.type === TileType.CASTLE
    ? BattleTarget.CITY
    : tile.type === TileType.NPC || tile.type === TileType.HISTORIC
      ? BattleTarget.NPC
      : tile.type === TileType.FLAT
        ? undefined
        : BattleTarget.VALLEY;

/** The missions an army from the city on `fromTileId` can go on to a tile, as the tile's permissions allow. */
export function tileMissions(tile: MapFieldInfo, fromTileId: number): number[] {
  // a city can't send an army to itself
  if (tile.id === fromTileId) return [];
  const missions: number[] = [];
  if (tile.canLoot || tile.canOccupy) missions.push(Mission.ATTACK);
  if (tile.canScout && tileKind(tile)) missions.push(Mission.SCOUT);
  if (tile.canSend) missions.push(Mission.REINFORCE);
  if (tile.canTrans) missions.push(Mission.TRANSPORT);
  if (tile.type === TileType.FLAT && !('owner' in tile && tile.owner)) missions.push(Mission.BUILD_CITY);
  return missions;
}

/** Sending an army to a tile from the city on `fromTileId`. */
export function tileTarget(tile: MapFieldInfo, fromTileId: number): SendTarget {
  return { tileId: tile.id, name: placeName(tile), missions: tileMissions(tile, fromTileId), kind: tileKind(tile), own: tile.relation === Relation.SELF };
}
