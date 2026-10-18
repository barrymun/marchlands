import { ANCHOR, CHUNK, MIN_TILES_ACROSS, PAN_STEP, SPRITE, START_STEPS_OUT, TILE_H, TILE_W, ZOOMS } from '@/components/map-panel/world-map/constants';
import type { Camera, ChunkArea, PanDirection, TileInfo, View } from '@/components/map-panel/world-map/types';

/** `v` brought into 0 … size - 1, the map wrapping round at its edges. */
export function wrap(v: number, size: number): number {
  return ((v % size) + size) % size;
}

/**
 * Where tile (x, y)'s middle falls, in device pixels from the view's top left. The camera's offset is rounded once and
 * every tile is a whole number of device pixels from it (the zoom times the device pixel ratio is whole), so tiles
 * butt together without seams and the art stays sharp.
 */
export function tileOrigin(x: number, y: number, cam: Camera, view: View): { x: number; y: number } {
  const k = cam.zoom * view.dpr;
  const ox = Math.round((view.w * view.dpr) / 2 - ((cam.x - cam.y) * TILE_W * k) / 2);
  const oy = Math.round((view.h * view.dpr) / 2 - ((cam.x + cam.y) * TILE_H * k) / 2);
  return { x: ox + ((x - y) * TILE_W * k) / 2, y: oy + ((x + y) * TILE_H * k) / 2 };
}

/** The (fractional) tile under a point of the view, in CSS pixels from its top left. */
export function tileAt(sx: number, sy: number, cam: Camera, view: View): { x: number; y: number } {
  const a = (sx - view.w / 2) / ((TILE_W / 2) * cam.zoom);
  const b = (sy - view.h / 2) / ((TILE_H / 2) * cam.zoom);
  return { x: cam.x + (a + b) / 2, y: cam.y + (b - a) / 2 };
}

/** The camera moved so the map follows a drag of (dx, dy) CSS pixels. */
export function dragged(cam: Camera, dx: number, dy: number): Camera {
  const a = dx / ((TILE_W / 2) * cam.zoom);
  const b = dy / ((TILE_H / 2) * cam.zoom);
  return { ...cam, x: cam.x - (a + b) / 2, y: cam.y - (b - a) / 2 };
}

/** How far an arrow moves the camera, in tiles: straight up, down, left or right on screen. */
export function panStep(dir: PanDirection, n = PAN_STEP): { dx: number; dy: number } {
  return { up: { dx: -n, dy: -n }, down: { dx: n, dy: n }, left: { dx: -n, dy: n }, right: { dx: n, dy: -n } }[dir];
}

/**
 * Every tile whose sprite reaches into the view (unwrapped coordinates, so a view across the map's edge stays in one
 * piece), back to front.
 */
export function visibleTiles(cam: Camera, view: View): { x: number; y: number }[] {
  // a sprite reaches ANCHOR.y above its tile's middle and the rest of its height below; half a tile either side
  const [top, bottom, side] = [ANCHOR.y * cam.zoom, (SPRITE - ANCHOR.y) * cam.zoom, (TILE_W / 2) * cam.zoom];
  const corners = [
    tileAt(-side, -bottom, cam, view),
    tileAt(view.w + side, -bottom, cam, view),
    tileAt(-side, view.h + top, cam, view),
    tileAt(view.w + side, view.h + top, cam, view),
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

/** The tiles of a loaded square, by tile id: `mapStr` holds two hex digits per tile (type, level), row by row. */
export function decodeTiles(area: ChunkArea & { mapStr: string }, size: number): Map<number, TileInfo> {
  const tiles = new Map<number, TileInfo>();
  const w = area.x2 - area.x1 + 1;
  for (let i = 0; i * 2 < area.mapStr.length; i++) {
    const x = wrap(area.x1 + (i % w), size);
    const y = wrap(area.y1 + Math.floor(i / w), size);
    tiles.set(y * size + x, { type: parseInt(area.mapStr[i * 2], 16), level: parseInt(area.mapStr[i * 2 + 1], 16) });
  }
  return tiles;
}

/** The zoom levels that land on whole device pixels on this screen, smallest first. */
export function zoomsFor(dpr: number): number[] {
  const whole = ZOOMS.filter((z) => Number.isInteger(z * dpr));
  return whole.length ? whole : [1];
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

/** The next zoom level in (`step` 1) or out (-1) from `zoom`, staying at the ends. */
export function nextZoom(zoom: number, step: 1 | -1, dpr: number): number {
  const zooms = zoomsFor(dpr);
  const i = zooms.findIndex((z) => z >= zoom);
  const at = i < 0 ? zooms.length - 1 : i;
  return zooms[Math.max(0, Math.min(zooms.length - 1, zooms[at] === zoom ? at + step : step > 0 ? at : at - 1))];
}

/**
 * The tile under a point of the view (CSS pixels from its top left): the front-most tile whose sprite has a pixel
 * there (`opaque(src, x, y)`, x and y inside the 64×64 image), else the tile whose diamond holds the point.
 */
export function pickTile(
  sx: number,
  sy: number,
  drawn: readonly { x: number; y: number; src?: string }[],
  cam: Camera,
  view: View,
  opaque: (src: string, x: number, y: number) => boolean,
): { x: number; y: number } | undefined {
  const unit = { ...view, dpr: 1 };
  for (let i = drawn.length - 1; i >= 0; i--) {
    const t = drawn[i];
    if (!t.src) continue;
    const p = tileOrigin(t.x, t.y, cam, unit);
    const ax = Math.floor((sx - p.x) / cam.zoom + ANCHOR.x);
    const ay = Math.floor((sy - p.y) / cam.zoom + ANCHOR.y);
    if (ax >= 0 && ay >= 0 && ax < SPRITE && ay < SPRITE && opaque(t.src, ax, ay)) return { x: t.x, y: t.y };
  }
  const t = tileAt(sx, sy, cam, view);
  return { x: Math.round(t.x), y: Math.round(t.y) };
}
