import { OutlineHalf, PINCH_WHEEL_RATE, SPRITE, TILE_H, TILE_W, WHEEL_LINE, WHEEL_RATE, ZOOMS } from '@/components/iso-viewport/constants';
import type { Camera, Drawable, Outline, Overlay, PanDirection, Piece, PixelArt, SceneBox, View, ViewPoint } from '@/components/iso-viewport/types';

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

/** Whether a piece is an overlay (a frame made in code) rather than a sprite. */
export function isOverlay(p: Piece): p is Overlay {
  return 'art' in p;
}

/** Whether a piece is half a tile's outline. */
export function isOutline(p: Piece): p is Outline {
  return 'half' in p;
}

/** A tile's outline as its two halves, the back one to go before what stands on the tile and the front one after. */
export function outlineHalves(o: Omit<Outline, 'half'>): [Outline, Outline] {
  return [
    { ...o, key: `${o.key}b`, half: OutlineHalf.BACK },
    { ...o, key: `${o.key}f`, half: OutlineHalf.FRONT },
  ];
}

/**
 * The corners an outline's half runs through, in device pixels: the back half from the tile's left corner over its top
 * to its right, the front half from its right corner under its bottom to its left.
 */
export function outlinePoints(o: Outline, cam: Camera, view: View): ViewPoint[] {
  const p = tileOrigin(o.col, o.row, cam, view);
  const k = cam.zoom * view.dpr;
  const [w, h] = [(TILE_W / 2) * k, (TILE_H / 2) * k];
  const [left, right] = [
    { x: p.x - w, y: p.y },
    { x: p.x + w, y: p.y },
  ];
  return o.half === OutlineHalf.BACK ? [left, { x: p.x, y: p.y - h }, right] : [right, { x: p.x, y: p.y + h }, left];
}

/** What drawing a layer of outlines needs of a 2D context (a canvas's, or a stand-in in tests). */
export type OutlineContext = Pick<
  CanvasRenderingContext2D,
  | 'globalCompositeOperation'
  | 'filter'
  | 'globalAlpha'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineCap'
  | 'imageSmoothingEnabled'
  | 'setLineDash'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'stroke'
>;

/** The canvas the outlines are drawn on before they're laid over the scene (an offscreen one, or a stand-in in tests). */
export interface OutlineLayer<X extends OutlineContext> {
  width: number;
  height: number;
  getContext(contextId: '2d'): X | null;
}

/**
 * Lays the outlines among `pieces` over the scene drawn on `target`: each stroked on `layer` in the pieces' order, and
 * every piece after the first erasing what of the outlines before it the piece covers (`erase` draws it, the layer set
 * to `destination-out`), so a building hides the edges behind it and not the ones in front. Colours come from
 * `strokeOf` (a CSS class's stroke), asked once a class. Nothing is drawn, and false returned, with no outlines or
 * while the view has no size: a canvas of no size can't be drawn (the browser throws).
 */
export function layOutlines<X extends OutlineContext, L extends OutlineLayer<X>>(
  target: { readonly canvas: { width: number; height: number }; drawImage(image: NoInfer<L>, dx: number, dy: number): void },
  layer: L,
  pieces: readonly Piece[],
  cam: Camera,
  view: View,
  strokeOf: (className: string) => string,
  erase: (lay: X, piece: Piece) => void,
): boolean {
  const { width, height } = target.canvas;
  if (width <= 0 || height <= 0 || !pieces.some(isOutline)) return false;
  [layer.width, layer.height] = [width, height];
  const lay = layer.getContext('2d');
  if (!lay) return false;
  lay.imageSmoothingEnabled = false;
  const strokes = new Map<string, string>();
  let started = false;
  for (const s of pieces) {
    if (!isOutline(s)) {
      if (started) {
        lay.globalCompositeOperation = 'destination-out';
        erase(lay, s);
      }
      continue;
    }
    const [first, ...rest] = outlinePoints(s, cam, view);
    if (!first) continue;
    const stroke = strokes.get(s.className) ?? strokeOf(s.className);
    strokes.set(s.className, stroke);
    lay.globalCompositeOperation = 'source-over';
    lay.filter = 'none';
    lay.globalAlpha = 1;
    lay.strokeStyle = stroke;
    lay.lineWidth = s.width * view.dpr;
    lay.lineCap = s.dash ? 'butt' : 'round';
    lay.setLineDash((s.dash ?? []).map((n) => n * view.dpr));
    lay.beginPath();
    lay.moveTo(first.x, first.y);
    for (const p of rest) lay.lineTo(p.x, p.y);
    lay.stroke();
    started = true;
  }
  target.drawImage(layer, 0, 0);
  return true;
}

/** Where an overlay is drawn, in device pixels: its tile's middle, moved by its offset in art pixels. */
export function overlayRect(o: Overlay, cam: Camera, view: View): { x: number; y: number; w: number; h: number } {
  const k = cam.zoom * view.dpr;
  const p = tileOrigin(o.col, o.row, cam, view);
  return { x: p.x + o.x * k, y: p.y + o.y * k, w: o.art.w * k, h: o.art.h * k };
}

/** Canvases holding the frames made so far, by id, so each frame is turned into an image once. */
const artCanvases = new Map<string, HTMLCanvasElement>();

/** A frame made in code as a canvas the viewport can draw (made on first use, then kept). */
export function artCanvas(art: PixelArt): HTMLCanvasElement | undefined {
  let c = artCanvases.get(art.id);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = art.w;
  c.height = art.h;
  const ctx = c.getContext('2d');
  if (!ctx) return undefined;
  ctx.putImageData(new ImageData(art.data, art.w, art.h), 0, 0);
  artCanvases.set(art.id, c);
  return c;
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
export function zoomsFor(dpr: number): [number, ...number[]] {
  const [first, ...more] = ZOOMS.filter((z) => Number.isInteger(z * dpr));
  return first === undefined ? [1] : [first, ...more];
}

/** The next zoom level in (`step` 1) or out (-1) from `zoom`, staying at the ends. */
export function nextZoom(zoom: number, step: 1 | -1, dpr: number): number {
  const zooms = zoomsFor(dpr);
  const i = zooms.findIndex((z) => z >= zoom);
  const at = i < 0 ? zooms.length - 1 : i;
  return zooms[Math.max(0, Math.min(zooms.length - 1, zooms[at] === zoom ? at + step : step > 0 ? at : at - 1))] ?? zoom; // clamped: always one of them
}

/** A zoom kept inside the zoom levels' range. */
export function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, ZOOMS[0]), Math.max(...ZOOMS));
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
  // front to back: the last drawn is on top
  return drawn.findLast((d) => {
    const o = tileOrigin(d.col, d.row, cam, unit);
    const box = spriteBox(d.size);
    const x = Math.floor((p.x - o.x) / cam.zoom - box.left);
    const y = Math.floor((p.y - o.y) / cam.zoom - box.top);
    return x >= 0 && y >= 0 && x < box.width && y < box.height && opaque(d.src, x, y);
  });
}
