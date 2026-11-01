import { useQueries } from '@tanstack/react-query';

import { getMapOptions, type MapCastle, type MapHeldValley } from '@marchlands/api-client';
import { TileType } from '@marchlands/core';

import type { Viewport } from '@/components/iso-viewport/hooks';
import type { Drawable } from '@/components/iso-viewport/types';
import { TILE_ART } from '@/components/map-panel/constants';
import { HISTORIC_SPRITE } from '@/components/map-panel/world-map/constants';
import type { ChunkArea, TileInfo } from '@/components/map-panel/world-map/types';
import { chunksFor, decodeTiles, visibleTiles, wrap } from '@/components/map-panel/world-map/utils';
import { artBand, HISTORIC_ART_LEVELS, historicArtFile, tileArtFile } from '@/lib/game-art';

/** How long a loaded square of the map counts as fresh before it is fetched again when it comes back into view. */
const FRESH_MS = 30_000;

/**
 * The map in the given squares, merged: every tile's type and level, the castles and barbarian camps, and the valleys
 * other players hold, each by tile id. Squares load one request each and are cached, so panning back is instant.
 */
function useMapArea(
  chunks: readonly ChunkArea[],
  mapSize: number,
): { tiles: Map<number, TileInfo>; castles: Map<number, MapCastle>; valleys: Map<number, MapHeldValley> } {
  return useQueries({
    queries: chunks.map((c) => ({ ...getMapOptions({ query: c }), staleTime: FRESH_MS })),
    combine: (results) => {
      const tiles = new Map<number, TileInfo>();
      const castles = new Map<number, MapCastle>();
      const valleys = new Map<number, MapHeldValley>();
      for (const r of results) {
        if (!r.data) continue;
        for (const [id, t] of decodeTiles(r.data, mapSize)) tiles.set(id, t);
        for (const c of r.data.castles) castles.set(c.y * mapSize + c.x, c);
        for (const v of r.data.valleys) valleys.set(v.id, v);
      }
      return { tiles, castles, valleys };
    },
  });
}

/**
 * What the world map shows through a viewport: every tile in view (unwrapped coordinates, back to front) with its id,
 * what it is once its square has loaded, and its sprite; and the castles and other players' valleys in view.
 */
export function useWorldMap(vp: Viewport, mapSize: number) {
  const visible = vp.camera ? visibleTiles(vp.camera, vp.view) : [];
  const area = useMapArea(chunksFor(visible, mapSize), mapSize);
  const idOf = (x: number, y: number) => wrap(y, mapSize) * mapSize + wrap(x, mapSize);
  const tiles = visible.map((v) => {
    const id = idOf(v.x, v.y);
    const info = area.tiles.get(id);
    // a historic city keeps its own sprite once a player holds it (its castle carries its level)
    const seatLevel = info?.type === TileType.HISTORIC ? info.level : area.castles.get(id)?.historicLevel;
    const historic = HISTORIC_ART_LEVELS.find((l) => l === seatLevel);
    const file = historic ? historicArtFile(historic) : info ? tileArtFile(info.type, artBand(info.level)) : undefined;
    return { ...v, id, info, size: historic ? HISTORIC_SPRITE : undefined, src: file ? TILE_ART[file] : undefined, file: file ? `tiles/${file}` : undefined };
  });
  const sprites: (Drawable & { id: number; file?: string })[] = tiles.flatMap((t) =>
    t.src ? [{ key: `${t.x},${t.y}`, col: t.x, row: t.y, src: t.src, id: t.id, file: t.file, size: t.size }] : [],
  );
  return { area, tiles, sprites, idOf };
}

export type WorldMapData = ReturnType<typeof useWorldMap>;
