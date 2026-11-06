// What the hero gear sprites share (tools/art/gear.ts, docs/features/hero-gear-art.md): the canvas size, a level's
// colours, materials, the look every piece takes above level 2, and the shapes they're drawn with, lit from the top left.

import { SpotKind } from '@marchlands/core';
import { type Colour, PixelCanvas, type Pt } from '../pixel.ts';
import { disc } from '../shapes.ts';

export const SIZE = 32;

/** Three shades of a material: lit, mid and shaded. */
export type Shades = readonly [Colour, Colour, Colour];

/** A gear level's colours (the gearN palette entries, reserved for the gear). */
export const tier = (level: number): Shades => [`gear${level}Hi` as Colour, `gear${level}` as Colour, `gear${level}Dark` as Colour];

export const STEEL: Shades = ['steelHi', 'steel', 'steelDark'];
export const IRON: Shades = ['metal', 'metal', 'steelDark'];
export const DARK_STEEL: Shades = ['metal', 'hood', 'hoodDark'];
export const GOLD: Shades = ['fireHi', 'gold', 'goldDark'];
export const BRONZE: Shades = ['thatchHi', 'goldDark', 'thatchEdge'];
export const WOOD: Shades = ['plankTop', 'plankL', 'plankR'];
export const LEATHER: Shades = ['horseHi', 'leather', 'leatherDark'];
/** The armour set with no level: blue steel, trimmed in gold. */
export const BLUE: Shades = ['blueHi', 'blue', 'blueDark'];
export const CLOTH: Shades = ['wool', 'linen', 'linenDark'];
export const CRIMSON = tier(10);

/** How a piece looks above level 2: its metal, its trim, the colour of its gems and cloth, and its spikes and horns. */
export interface Look {
  metal: Shades;
  trim: Shades;
  accent: Shades;
  /** spikes from level 7, horns from level 8 */
  spikes: boolean;
  horns: boolean;
}

/** Steel trimmed in gold with gems in the level's colour; gilded at 9; crimson trimmed in silver at 10. */
export function look(level: number): Look {
  if (level >= 10) return { metal: CRIMSON, trim: STEEL, accent: ['sparkle', 'gear10Hi', 'gear10Dark'], spikes: true, horns: true };
  if (level === 9) return { metal: GOLD, trim: STEEL, accent: tier(9), spikes: true, horns: true };
  return { metal: STEEL, trim: GOLD, accent: tier(level), spikes: level >= 7, horns: level >= 8 };
}

export const canvas = (piece: string, level: number) => new PixelCanvas(SIZE, `${piece}-${level}`);

/** Light from the top left over a shape round (cx, cy) of size r: lit, mid or shaded by where a pixel falls. */
export const lit =
  (cx: number, cy: number, r: number, [hi, mid, dark]: Shades) =>
  (x: number, y: number): Colour => {
    const d = (x + 0.5 - cx + (y + 0.5 - cy)) / (r * 1.4);
    return d < -0.3 ? hi : d > 0.35 ? dark : mid;
  };

/** The middle of a polygon's points. */
const middle = (pts: Pt[]): Pt => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

/** A convex polygon filled in a material, lit from the top left. */
export function fill(c: PixelCanvas, pts: Pt[], shades: Shades) {
  const [cx, cy] = middle(pts);
  const r = Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)));
  c.poly(pts, lit(cx, cy, r, shades));
}

/** A polygon's points moved `by` pixels towards its middle. */
export function inset(pts: Pt[], by: number): Pt[] {
  const [cx, cy] = middle(pts);
  return pts.map(([x, y]) => {
    const d = Math.hypot(x - cx, y - cy) || 1;
    return [x + ((cx - x) / d) * by, y + ((cy - y) / d) * by];
  });
}

/** A convex polygon in `body`, with a rim of `trim` round it. */
export function trimmed(c: PixelCanvas, pts: Pt[], body: Shades, trim: Shades, rim = 1.4) {
  fill(c, pts, trim);
  fill(c, inset(pts, rim), body);
}

/** A ring seen at an angle: an oval band, its hole cut out a little above the middle. */
export function ring(c: PixelCanvas, cx: number, cy: number, rx: number, ry: number, band: number, shades: Shades | ((x: number, y: number) => Colour)) {
  const colour = typeof shades === 'function' ? shades : lit(cx, cy, rx, shades);
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const outer = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
      const inner = ((x + 0.5 - cx) / (rx - band)) ** 2 + ((y + 0.5 - (cy - band * 0.35)) / (ry - band)) ** 2 <= 1;
      if (outer && !inner) c.set(x, y, colour(x, y));
    }
}

/**
 * A cut stone round (x, y): `r` 1 is two by two, larger a disc, its lower right in shade and a white glint at its top
 * left, so a stone in the level's colour still shows on that level's backdrop. The glint is recorded as a `gem` spot
 * (`n` the stone's radius), where the gear icon makes it flare and the stone glow.
 */
export function gem(c: PixelCanvas, x: number, y: number, r: number, [hi, mid, dark]: Shades) {
  if (r <= 1) {
    c.spot(SpotKind.GEM, [Math.floor(x), Math.floor(y)], r);
    c.set(x, y, 'sparkle');
    c.set(x + 1, y, mid);
    c.set(x, y + 1, mid);
    c.set(x + 1, y + 1, dark);
    return;
  }
  // a deep stone, lighter towards its top left
  disc(c, x, y, r, dark);
  disc(c, x - r * 0.3, y - r * 0.3, r * 0.55, mid);
  const g = Math.round(r / 2);
  c.spot(SpotKind.GEM, [Math.floor(x - g), Math.floor(y - g)], r);
  c.set(x - g, y - g, 'sparkle');
  c.set(x - g + 1, y - g, hi);
  c.set(x - g, y - g + 1, hi);
}

/** A point of white light (level 10's glowing eyes and slits), recorded as a `shine` spot so the icon can make it glint. */
export function shine(c: PixelCanvas, x: number, y: number) {
  c.set(x, y, 'sparkle');
  c.spot(SpotKind.SHINE, [Math.floor(x), Math.floor(y)]);
}

/** A heart of size `s` round (cx, cy), its point down, coloured per pixel. */
export function heart(c: PixelCanvas, cx: number, cy: number, s: number, colour: (x: number, y: number) => Colour) {
  for (let y = Math.floor(cy - s * 1.2); y <= Math.ceil(cy + s * 1.2); y++)
    for (let x = Math.floor(cx - s * 1.3); x <= Math.ceil(cx + s * 1.3); x++) {
      const u = (x + 0.5 - cx) / s;
      const v = -(y + 0.5 - cy) / s;
      if ((u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0) c.set(x, y, colour(x, y));
    }
}

/** A stone of radius `r` in a setting of `trim` round it, thick enough to show inside the outline. */
export function setStone(c: PixelCanvas, x: number, y: number, r: number, trim: Shades, stone: Shades) {
  disc(c, x, y, r + 1.8, trim[1], trim[2]);
  gem(c, x, y, r, stone);
}

/** A horn from `base` to `tip`, `width` pixels wide at its base: a filled triangle, drawn before the outline. */
export function horn(c: PixelCanvas, [bx, by]: Pt, [tx, ty]: Pt, width: number, shades: Shades) {
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const [nx, ny] = [(-(ty - by) / len) * (width / 2), ((tx - bx) / len) * (width / 2)];
  const pts: Pt[] = [
    [bx - nx, by - ny],
    [bx + nx, by + ny],
    [tx, ty],
  ];
  c.poly(pts, lit((bx + tx) / 2, (by + ty) / 2, len / 2, shades));
}

/** A spike two pixels wide from `base` to `tip`, drawn after the outline so it stays thin: lit on one side. */
export function spike(c: PixelCanvas, [bx, by]: Pt, [tx, ty]: Pt, [hi, , dark]: Shades) {
  c.line([bx, by], [tx, ty], hi);
  const len = Math.hypot(tx - bx, ty - by) || 1;
  const [nx, ny] = [Math.round(-(ty - by) / len), Math.round((tx - bx) / len)];
  c.line([bx + nx, by + ny], [tx + (tx - bx) / len / 2 + nx, ty + (ty - by) / len / 2 + ny], dark);
  c.set(tx, ty, hi);
}

/**
 * Fill a band of half-width `halfWidth(t)` along a path (t from 0 to 1), colouring each pixel by where it falls: `t`
 * along the path and `side` across it, -1 on the lit side (top left) to 1 on the shaded side. Square ends.
 */
export function sweep(
  c: PixelCanvas,
  path: (t: number) => Pt,
  halfWidth: (t: number) => number,
  colour: (t: number, side: number) => Colour | null,
  samples = 96,
) {
  const pts = Array.from({ length: samples + 1 }, (_, i) => path(i / samples));
  for (let y = 0; y < c.size; y++)
    for (let x = 0; x < c.size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let best = 0;
      let bestD = Infinity;
      pts.forEach(([qx, qy], i) => {
        const d = (qx - px) ** 2 + (qy - py) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      const t = best / samples;
      const [ax, ay] = pts[Math.max(0, best - 1)];
      const [bx, by] = pts[Math.min(samples, best + 1)];
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const [tx, ty] = [(bx - ax) / len, (by - ay) / len];
      const [qx, qy] = pts[best];
      const along = (px - qx) * tx + (py - qy) * ty;
      if ((best === 0 && along < -0.5) || (best === samples && along > 0.5)) continue;
      // across: positive to the right of the direction of travel; for a piece pointing up and right that is the
      // bottom-right side, in shade
      const across = (px - qx) * -ty + (py - qy) * tx;
      const w = halfWidth(t);
      if (w <= 0 || Math.abs(across) > w) continue;
      const col = colour(t, across / w);
      if (col) c.set(x, y, col);
    }
}

/** A straight path from `a` to `b`, bent sideways by `bend` pixels at its middle (a sabre's curve, a plume). */
export const bent =
  ([ax, ay]: Pt, [bx, by]: Pt, bend = 0) =>
  (t: number): Pt => {
    const len = Math.hypot(bx - ax, by - ay);
    const [nx, ny] = [-(by - ay) / len, (bx - ax) / len];
    const off = bend * Math.sin(Math.PI * t);
    return [ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off];
  };

/** Three shades across a band: lit, mid, shaded. */
export const shaded =
  ([hi, mid, dark]: readonly Colour[]) =>
  (_t: number, side: number) =>
    side < -0.34 ? hi : side > 0.34 ? dark : mid;

/** A point `d` pixels along the diagonal from `from` towards the top right, and `s` across it. */
export const along = ([x, y]: Pt, d: number, s = 0): Pt => [x + (d + s) / Math.SQRT2, y - (d - s) / Math.SQRT2];

/** A plume or a fall of cloth: a band along a bent path in the level's colour, striped as feathers. */
export function plume(c: PixelCanvas, from: Pt, to: Pt, bend: number, width: number, shades: Shades) {
  sweep(
    c,
    bent(from, to, bend),
    (t) => width * Math.min(1, (1 - t) / 0.4 + 0.2),
    (t, side) => (Math.floor(t * 8) % 2 && side > -0.2 ? shades[2] : side < 0 ? shades[0] : shades[1]),
  );
}
