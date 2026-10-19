import { PINCH_WHEEL_RATE, SPRITE, TILE_H, TILE_W, WHEEL_LINE, WHEEL_RATE, ZOOMS } from '@/components/iso-viewport/constants';
import type { Camera, Drawable, PanDirection, SceneBox, View, ViewPoint } from '@/components/iso-viewport/types';

/**
 * Where tile (col, row)'s middle falls, in device pixels from the view's top left. The camera's offset is rounded once,
 * and each tile's offset from it to a whole art pixel (spaced-out slots sit at fractional tiles), so every tile's art
 * pixels lie on one grid and tiles butt together without seams. With the zoom times the device pixel ratio whole (the
 * zooms the view opens at and the buttons step to), that grid lands on whole device pixels and the art is sharp; in
 * between (while zooming smoothly) its pixels are a device pixel uneven, but still join.
 */
export function tileOrigin(col: number, row: number, cam: Camera, view: View): ViewPoint {
  const k = cam.zoom * view.dpr;
  const ox = Math.round((view.w * view.dpr) / 2 - ((cam.x - cam.y) * TILE_W * k) / 2);
  const oy = Math.round((view.h * view.dpr) / 2 - ((cam.x + cam.y) * TILE_H * k) / 2);
  return { x: ox + Math.round(((col - row) * TILE_W) / 2) * k, y: oy + Math.round(((col + row) * TILE_H) / 2) * k };
}

/** Where tile (col, row)'s middle falls in CSS pixels, for what is laid over the art. */
export function viewPoint(col: number, row: number, cam: Camera, view: View): ViewPoint {
  const p = tileOrigin(col, row, cam, view);
  return { x: p.x / view.dpr, y: p.y / view.dpr };
}

/** The (fractional) tile under a point of the view. */
export function tileAt(p: ViewPoint, cam: Camera, view: View): { x: number; y: number } {
  const a = (p.x - view.w / 2) / ((TILE_W / 2) * cam.zoom);
  const b = (p.y - view.h / 2) / ((TILE_H / 2) * cam.zoom);
  return { x: cam.x + (a + b) / 2, y: cam.y + (b - a) / 2 };
}

/** The camera moved so the view follows a drag of (dx, dy) CSS pixels. */
export function dragged(cam: Camera, dx: number, dy: number): Camera {
  const a = dx / ((TILE_W / 2) * cam.zoom);
  const b = dy / ((TILE_H / 2) * cam.zoom);
  return { ...cam, x: cam.x - (a + b) / 2, y: cam.y - (b - a) / 2 };
}

/** How far to move the camera, in tiles, to go `n` tiles straight up, down, left or right on screen. */
export function panStep(dir: PanDirection, n: number): { dx: number; dy: number } {
  return { up: { dx: -n, dy: -n }, down: { dx: n, dy: n }, left: { dx: -n, dy: n }, right: { dx: n, dy: -n } }[dir];
}

/**
 * Where a `size`-pixel square sprite lies round the middle of its tile, at the art's own size: anchored so its ground
 * diamond's middle is a quarter of its size, plus 2 pixels, above its bottom ((32, 46) on a 64-pixel sprite, (64, 94)
 * on the 128-pixel Town Hall; tools/art/iso.ts, anchor).
 */
export function spriteBox(size = SPRITE): { left: number; top: number; width: number; height: number } {
  return { left: -size / 2, top: -((size * 3) / 4 - 2), width: size, height: size };
}

/** The zoom levels that land on whole device pixels on this screen, smallest first. */
export function zoomsFor(dpr: number): number[] {
  const whole = ZOOMS.filter((z) => Number.isInteger(z * dpr));
  return whole.length ? whole : [1];
}

/** The next zoom level in (`step` 1) or out (-1) from `zoom`, staying at the ends. */
export function nextZoom(zoom: number, step: 1 | -1, dpr: number): number {
  const zooms = zoomsFor(dpr);
  const i = zooms.findIndex((z) => z >= zoom);
  const at = i < 0 ? zooms.length - 1 : i;
  return zooms[Math.max(0, Math.min(zooms.length - 1, zooms[at] === zoom ? at + step : step > 0 ? at : at - 1))];
}

/** A zoom kept inside the zoom levels' range. */
export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, ZOOMS[0]), ZOOMS[ZOOMS.length - 1]);
}

/**
 * The zoom after a wheel event: scrolling up (negative `deltaY`) zooms in, smoothly and in proportion to how far it
 * scrolled, so a trackpad's many small scrolls glide and a mouse wheel's notch is a short step. A trackpad pinch comes
 * as a wheel event with Ctrl held, zooming faster for its smaller deltas. `pageHeight` (CSS pixels) is a page of a
 * wheel that counts in pages.
 */
export function wheelZoom(zoom: number, e: { deltaY: number; deltaMode: number; ctrlKey: boolean }, pageHeight: number): number {
  const pixels = e.deltaY * (e.deltaMode === 1 ? WHEEL_LINE : e.deltaMode === 2 ? pageHeight : 1);
  return clampZoom(zoom * Math.exp(-pixels * (e.ctrlKey ? PINCH_WHEEL_RATE : WHEEL_RATE)));
}

/** The camera at another zoom, keeping the tile under point `p` of the view where it is (zooming towards the pointer). */
export function zoomAround(cam: Camera, zoom: number, p: ViewPoint, view: View): Camera {
  const t = tileAt(p, cam, view);
  const a = (p.x - view.w / 2) / ((TILE_W / 2) * zoom);
  const b = (p.y - view.h / 2) / ((TILE_H / 2) * zoom);
  return { x: t.x - (a + b) / 2, y: t.y - (b - a) / 2, zoom };
}

/** The box a scene's sprites fill (`size` a sprite's pixels, 64 when left out), at the art's own size. */
export function sceneBox(cells: readonly { col: number; row: number; size?: number }[]): SceneBox {
  const boxes = cells.map((c) => {
    const b = spriteBox(c.size);
    const [x, y] = [Math.round(((c.col - c.row) * TILE_W) / 2), Math.round(((c.col + c.row) * TILE_H) / 2)];
    return { left: x + b.left, top: y + b.top, right: x + b.left + b.width, bottom: y + b.top + b.height };
  });
  const left = Math.min(...boxes.map((b) => b.left));
  const top = Math.min(...boxes.map((b) => b.top));
  return { originX: -left, originY: -top, width: Math.max(...boxes.map((b) => b.right)) - left, height: Math.max(...boxes.map((b) => b.bottom)) - top };
}

/** The (fractional) tile at the middle of a scene's box. */
export function sceneCentre(box: SceneBox): { x: number; y: number } {
  const a = (box.width / 2 - box.originX) / (TILE_W / 2);
  const b = (box.height / 2 - box.originY) / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** The largest zoom (on whole device pixels) at which the whole scene fits the view; the smallest when none does. */
export function fitZoom(box: SceneBox, view: View): number {
  const zooms = zoomsFor(view.dpr);
  return [...zooms].reverse().find((z) => box.width * z <= view.w && box.height * z <= view.h) ?? zooms[0];
}

/**
 * The camera kept where at least half the scene shows across and down (all of the view, when half the scene is
 * bigger than it): a drag or a zoom can move the scene about, but never off the view.
 */
export function clampToScene(cam: Camera, box: SceneBox, view: View): Camera {
  const unit = { ...view, dpr: 1 };
  const o = tileOrigin(0, 0, cam, unit);
  const [w, h] = [box.width * cam.zoom, box.height * cam.zoom];
  const [left, top] = [o.x - box.originX * cam.zoom, o.y - box.originY * cam.zoom];
  const keep = (start: number, size: number, viewSize: number) => {
    const need = Math.min(size / 2, viewSize);
    return Math.min(Math.max(start, need - size), viewSize - need) - start;
  };
  const [dx, dy] = [keep(left, w, view.w), keep(top, h, view.h)];
  return dx || dy ? dragged(cam, dx, dy) : cam;
}

/**
 * The front-most sprite with a drawn pixel under point `p` of the view (`drawn` is back to front; `opaque(src, x, y)`
 * with x and y inside the image), or nothing.
 */
export function spriteAt<T extends Drawable>(
  p: ViewPoint,
  drawn: readonly T[],
  cam: Camera,
  view: View,
  opaque: (src: string, x: number, y: number) => boolean,
): T | undefined {
  const unit = { ...view, dpr: 1 };
  for (let i = drawn.length - 1; i >= 0; i--) {
    const d = drawn[i];
    const o = tileOrigin(d.col, d.row, cam, unit);
    const box = spriteBox(d.size);
    const x = Math.floor((p.x - o.x) / cam.zoom - box.left);
    const y = Math.floor((p.y - o.y) / cam.zoom - box.top);
    if (x >= 0 && y >= 0 && x < box.width && y < box.height && opaque(d.src, x, y)) return d;
  }
  return undefined;
}
