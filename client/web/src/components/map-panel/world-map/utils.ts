import { mapLevelOf } from '@marchlands/core';

import { TILE_W } from '@/components/iso-viewport/constants';
import type { Camera, View } from '@/components/iso-viewport/types';
import { nextZoom, spriteBox, tileAt, tileOrigin, zoomsFor } from '@/components/iso-viewport/utils';
import { CHUNK, HISTORIC_SPRITE, MIN_TILES_ACROSS, START_STEPS_OUT } from '@/components/map-panel/world-map/constants';
import type { ChunkArea, TileInfo } from '@/components/map-panel/world-map/types';

/** `v` brought into 0 … size - 1, the map wrapping round at its edges. */
export function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

/**
 * Every tile whose sprite reaches into the view (unwrapped coordinates, so a view across the map's edge stays in one
 * piece), back to front.
 */
export function visibleTiles(cam: Camera, view: View): { x: number; y: number }[] {
  // a sprite reaches its anchor's height above its tile's middle and the rest of it below; half a tile either side (the
  // tallest sprites, the historic cities', decide how far)
  const box = spriteBox(HISTORIC_SPRITE);
  const [top, bottom, side] = [-box.top * cam.zoom, (HISTORIC_SPRITE + box.top) * cam.zoom, (TILE_W / 2) * cam.zoom];
  const corners = [
    tileAt({ x: -side, y: -bottom }, cam, view),
    tileAt({ x: view.w + side, y: -bottom }, cam, view),
    tileAt({ x: -side, y: view.h + top }, cam, view),
    tileAt({ x: view.w + side, y: view.h + top }, cam, view),
  ];
  const [x0, x1] = [Math.floor(Math.min(...corners.map((c) => c.x))), Math.ceil(Math.max(...corners.map((c) => c.x)))];
  const [y0, y1] = [Math.floor(Math.min(...corners.map((c) => c.y))), Math.ceil(Math.max(...corners.map((c) => c.y)))];
  const tiles: { x: number; y: number }[] = [];
  const unit = { ...view, dpr: 1 };
  for (let x = x0; x <= x1; x++)
    for (let y = y0; y <= y1; y++) {
      const p = tileOrigin(x, y, cam, unit);
      if (p.x > -side && p.x < view.w + side && p.y > -bottom && p.y < view.h + top) tiles.push({ x, y });
    }
  return tiles.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - a.y - (b.x - b.y));
}

/**
 * The squares of the map to load for these tiles: CHUNK × CHUNK squares lined up on multiples of CHUNK of the wrapped
 * coordinates, each once. The last square along an edge runs past it; the server wraps it round.
 */
export function chunksFor(tiles: readonly { x: number; y: number }[], size: number): ChunkArea[] {
  const keys = new Map<string, ChunkArea>();
  for (const t of tiles) {
    const [cx, cy] = [Math.floor(wrap(t.x, size) / CHUNK) * CHUNK, Math.floor(wrap(t.y, size) / CHUNK) * CHUNK];
    keys.set(`${cx},${cy}`, { x1: cx, y1: cy, x2: cx + CHUNK - 1, y2: cy + CHUNK - 1 });
  }
  return [...keys.values()];
}

/**
 * The tiles of a loaded square, by tile id: `mapStr` holds two hex digits per tile (type, level), row by row; a historic
 * city's level comes halved (core mapLevelDigit).
 */
export function decodeTiles(area: ChunkArea & { mapStr: string }, size: number): Map<number, TileInfo> {
  const tiles = new Map<number, TileInfo>();
  const w = area.x2 - area.x1 + 1;
  for (let i = 0; i * 2 < area.mapStr.length; i++) {
    const x = wrap(area.x1 + (i % w), size);
    const y = wrap(area.y1 + Math.floor(i / w), size);
    const type = parseInt(area.mapStr.charAt(i * 2), 16);
    tiles.set(y * size + x, { type, level: mapLevelOf(type, parseInt(area.mapStr.charAt(i * 2 + 1), 16)) });
  }
  return tiles;
}

/**
 * The zoom the map opens at: START_STEPS_OUT steps out from the largest whole-pixel zoom that still shows
 * MIN_TILES_ACROSS tiles across the view, for a wide first look round (never past the smallest zoom).
 */
export function startZoom(width: number, dpr: number): number {
  const zooms = zoomsFor(dpr);
  let zoom = [...zooms].reverse().find((z) => width / (TILE_W * z) >= MIN_TILES_ACROSS) ?? zooms[0];
  for (let i = 0; i < START_STEPS_OUT; i++) zoom = nextZoom(zoom, -1, dpr);
  return zoom;
}
