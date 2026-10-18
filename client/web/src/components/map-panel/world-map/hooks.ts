import { useQueries } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getMapOptions, type MapCastle, type MapHeldValley } from '@marchlands/api-client';

import type { ChunkArea, TileInfo } from '@/components/map-panel/world-map/types';
import { decodeTiles } from '@/components/map-panel/world-map/utils';

/** How long a loaded square of the map counts as fresh before it is fetched again when it comes back into view. */
const FRESH_MS = 30_000;

/** A ref for an element and its size in CSS pixels, kept up to date as it resizes. */
export function useSize<T extends HTMLElement>(): [(el: T | null) => void, { w: number; h: number }] {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ w: entry.contentRect.width, h: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return [setEl, size];
}

/**
 * The map in the given squares, merged: every tile's type and level, the castles and barbarian camps, and the valleys
 * other players hold, each by tile id. Squares load one request each and are cached, so panning back is instant.
 */
export function useMapArea(
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
