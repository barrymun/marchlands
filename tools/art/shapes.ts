// Shapes in screen coordinates for the side-on sprites (tools/art/troops.ts, fortifications.ts, resources.ts):
// rectangles, circles, ellipses, spoked wheels and felled logs on a PixelCanvas.

import type { PixelCanvas } from './pixel.ts';
import { Colour } from '../../client/web/src/lib/palette.ts';

/** Fill the rectangle from (x0, y0) to (x1, y1), corners included. */
export function rect(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, col: Colour) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) c.set(x, y, col);
}

/** A filled circle; `shade` colours its lower right. */
export function disc(c: PixelCanvas, cx: number, cy: number, r: number, col: Colour, shade?: Colour) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r + 0.5) c.set(x, y, shade && dx + dy > r * 0.6 ? shade : col);
    }
}

/** A filled ellipse round (cx, cy); `fill` may pick a colour per pixel. */
export function oval(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, fill: Colour | ((x: number, y: number) => Colour)) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) c.set(x, y, typeof fill === 'function' ? fill(x, y) : fill);
}

/** A spoked wheel seen side on, centred on (cx, cy). */
export function wheel(c: PixelCanvas, cx: number, cy: number, r: number) {
  oval(c, cx, cy, r + 0.4, r + 0.4, Colour.LOG_DARK);
  oval(c, cx, cy, r - 1.6, r - 1.6, (x, y) => (x - cx + y - cy > 1 ? Colour.PLANK_R : Colour.PLANK_L));
  c.line([cx - r + 2, cy - r + 2], [cx + r - 2, cy + r - 2], Colour.LOG_DARK);
  c.line([cx - r + 2, cy + r - 2], [cx + r - 2, cy - r + 2], Colour.LOG_DARK);
  c.set(cx, cy, Colour.STEEL);
}

/** A felled log lying left to right from x0 to x1 round y = cy, its cut end at x1 facing the viewer. */
export function log(c: PixelCanvas, x0: number, x1: number, cy: number, r: number) {
  oval(c, x0, cy, r * 0.5, r, Colour.LOG_DARK);
  rect(c, x0, Math.round(cy - r), x1, Math.round(cy + r), Colour.LOG);
  rect(c, x0, Math.round(cy - r + 1), x1, Math.round(cy - r + 1), Colour.PLANK_TOP);
  rect(c, x0, Math.round(cy + r * 0.4), x1, Math.round(cy + r), Colour.LOG_DARK);
  c.line([x0, Math.round(cy - r)], [x1, Math.round(cy - r)], Colour.OUTLINE);
  c.line([x0, Math.round(cy + r)], [x1, Math.round(cy + r)], Colour.OUTLINE);
  for (const [a, b, y] of [
    [x0 + 2, x0 + 7, cy - 1],
    [x0 + 9, x0 + 13, cy + 1],
  ])
    c.line([a, y], [Math.min(b, x1 - 3), y], Colour.TRUNK);
  oval(c, x1, cy, r * 0.65, r + 0.3, Colour.LOG_END);
  oval(c, x1 + 0.3, cy + 0.3, r * 0.4, r * 0.6, Colour.WHEAT_DARK);
  oval(c, x1 + 0.3, cy + 0.3, r * 0.2, r * 0.3, Colour.LOG_END);
}
