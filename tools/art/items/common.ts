// What the item icons (tools/art/items.ts) share: the canvas, the metals and cloths as light, mid and dark tones, small
// pixel patterns stamped from strings (emblems, seals), and the books, scrolls and sparkles several items are made of.

import { type Colour, PixelCanvas } from '../pixel.ts';
import { rect } from '../shapes.ts';

export const SIZE = 32;

/** A material's lit, mid and shaded colours. */
export interface Tone {
  hi: Colour;
  mid: Colour;
  dark: Colour;
}

export const GOLD: Tone = { hi: 'fireHi', mid: 'gold', dark: 'goldDark' };
export const STEEL: Tone = { hi: 'steelHi', mid: 'steel', dark: 'steelDark' };
export const BRONZE: Tone = { hi: 'bronzeHi', mid: 'bronze', dark: 'bronzeDark' };
export const LEATHER: Tone = { hi: 'horseHi', mid: 'leather', dark: 'leatherDark' };
export const RED: Tone = { hi: 'bannerHi', mid: 'banner', dark: 'bannerDark' };
export const BLUE: Tone = { hi: 'blueHi', mid: 'blue', dark: 'blueDark' };
export const GREEN: Tone = { hi: 'greenHi', mid: 'greenL', dark: 'greenD' };
export const TEAL: Tone = { hi: 'tealHi', mid: 'tealL', dark: 'tealD' };
export const WOOD: Tone = { hi: 'plankTop', mid: 'plankL', dark: 'plankR' };
export const PARCHMENT: Tone = { hi: 'wallTop', mid: 'linen', dark: 'linenDark' };
export const STONE: Tone = { hi: 'graniteHi', mid: 'graniteL', dark: 'graniteR' };

/** A new icon canvas; the seed keeps any random detail the same on every run. */
export function canvas(seed: string): PixelCanvas {
  return new PixelCanvas(SIZE, seed);
}

/**
 * Stamp a small pattern with its top left at (x, y): one string per row, one character per pixel, each character a
 * colour from `key`; any character not in it (a `.`) is left alone.
 */
export function stamp(c: PixelCanvas, x: number, y: number, rows: readonly string[], key: Record<string, Colour>) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const col = key[row.charAt(dx)];
      if (col) c.set(x + dx, y + dy, col);
    }
  });
}

/** A four-pointed glint centred on (x, y), `r` pixels long each way; drawn after outline() so it stays thin. */
export function sparkle(c: PixelCanvas, x: number, y: number, r = 2) {
  for (let i = 1; i <= r; i++)
    for (const [dx, dy] of [
      [i, 0],
      [-i, 0],
      [0, i],
      [0, -i],
    ] as const)
      c.set(x + dx, y + dy, i === r ? 'fireHi' : 'sparkle');
  c.set(x, y, 'sparkle');
}

/**
 * A book lying flat, seen from the front and a little above: its cover's top receding `d` pixels up to the right, the
 * fore-edge of its pages facing the viewer from x to x + w - 1 and y to y + t - 1, and the end of its boards in shade.
 */
export function lyingBook(c: PixelCanvas, x: number, y: number, w: number, t: number, tone: Tone, d = 3) {
  for (let i = 1; i <= d; i++) rect(c, x + i, y - i, x + w - 1 + i, y - i, i === d ? tone.mid : tone.hi);
  for (let i = 0; i < d; i++) rect(c, x + w + i, y - i, x + w + i, y + t - 1 - i, tone.dark);
  rect(c, x, y, x + w - 1, y + t - 1, 'wallTop');
  rect(c, x, y, x + w - 1, y, tone.mid);
  rect(c, x, y + t - 1, x + w - 1, y + t - 1, tone.dark);
  rect(c, x, y, x, y + t - 1, tone.dark);
  for (let row = y + 2; row < y + t - 1; row += 2) rect(c, x + 2, row, x + w - 2, row, 'linen');
}

/**
 * A book standing up, its front cover from (x0, y0) to (x1, y1), the spine's edge down its left side and a sliver of
 * pages down its right; decorations go on afterwards.
 */
export function tome(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, tone: Tone) {
  rect(c, x1 + 1, y0 + 1, x1 + 2, y1 - 1, 'wallTop');
  rect(c, x1 + 2, y0 + 2, x1 + 2, y1 - 1, 'linen');
  rect(c, x0, y0, x1, y1, tone.mid);
  rect(c, x0 + 3, y0, x1, y0, tone.hi);
  rect(c, x0 + 3, y0, x0 + 3, y1, tone.hi);
  rect(c, x0, y0, x0 + 2, y1, tone.dark);
  for (const row of [y0 + 2, y1 - 2]) rect(c, x0, row, x0 + 2, row, tone.hi);
  rect(c, x0 + 3, y1, x1 + 1, y1, tone.dark);
}

/** Gold (or another metal's) corner pieces on a tome's cover from (x0, y0) to (x1, y1). */
export function corners(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, metal: Tone = GOLD) {
  for (const [x, y, sx, sy] of [
    [x0 + 3, y0, 1, 1],
    [x1, y0, -1, 1],
    [x0 + 3, y1, 1, -1],
    [x1, y1, -1, -1],
  ] as const) {
    c.set(x, y, metal.hi);
    c.set(x + sx, y, metal.mid);
    c.set(x, y + sy, metal.mid);
    c.set(x + 2 * sx, y, metal.dark);
    c.set(x, y + 2 * sy, metal.dark);
  }
}

/**
 * A sheet of parchment hanging between two rolls, from (x0, y0) to (x1, y1) with the rolls included, its writing drawn
 * afterwards. `knobs` puts wooden ends on the rolls.
 */
export function scroll(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, { knobs = true }: { knobs?: boolean } = {}) {
  rect(c, x0, y0 + 2, x1, y1 - 2, PARCHMENT.mid);
  rect(c, x0, y0 + 2, x0 + 1, y1 - 2, PARCHMENT.hi);
  rect(c, x1 - 1, y0 + 2, x1, y1 - 2, PARCHMENT.dark);
  for (const y of [y0, y1 - 2]) {
    rect(c, x0 - 1, y, x1 + 1, y, PARCHMENT.hi);
    rect(c, x0 - 1, y + 1, x1 + 1, y + 1, PARCHMENT.mid);
    rect(c, x0 - 1, y + 2, x1 + 1, y + 2, PARCHMENT.dark);
    if (knobs)
      for (const x of [x0 - 3, x1 + 2]) {
        rect(c, x, y, x + 1, y + 2, 'wood');
        c.set(x, y, 'plankTop');
      }
  }
}

/** Lines of writing across a sheet, from x0 to x1, every other row from y0 to y1, the last line short. */
export function writing(c: PixelCanvas, x0: number, x1: number, y0: number, y1: number, ink: Colour = 'linenDark') {
  for (let y = y0; y <= y1; y += 2) rect(c, x0, y, y + 2 > y1 ? x0 + Math.floor((x1 - x0) / 2) : x1, y, ink);
}

/** A gold coin seen face on, centred on (x, y), radius 2 or 3. */
export function coin(c: PixelCanvas, x: number, y: number, r: 2 | 3 = 3) {
  const rows = r === 3 ? ['.ooo.', 'ohmmo', 'ohdmo', 'ommdo', '.ooo.'] : ['.oo.', 'ohmo', 'omdo', '.oo.'];
  stamp(c, x - r + 1, y - r + 1, rows, { o: 'goldDark', h: 'fireHi', m: 'gold', d: 'goldDark' });
}

/** A red wax seal centred on (x, y). */
export function waxSeal(c: PixelCanvas, x: number, y: number) {
  stamp(c, x - 2, y - 2, ['.hmm.', 'hmdmm', 'mdhdm', 'mmdmd', '.mdd.'], { h: 'bannerHi', m: 'banner', d: 'bannerDark' });
}

/** A straight rod `w` pixels wide from a to b (a handle, a shaft, a blade's back), outlined with the rest. */
export function rod(c: PixelCanvas, [ax, ay]: readonly [number, number], [bx, by]: readonly [number, number], w: number, col: Colour) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const [nx, ny] = [(-(by - ay) / len) * (w / 2), ((bx - ax) / len) * (w / 2)];
  c.poly(
    [
      [ax + nx, ay + ny],
      [bx + nx, by + ny],
      [bx - nx, by - ny],
      [ax - nx, ay - ny],
    ],
    col,
  );
}

/**
 * A shape symmetric about x = cx (a goblet, a flask, a breastplate), one row per entry of `widths` from y0 down, each
 * its half-width; lit on the left, shaded on the right.
 */
export function lathe(c: PixelCanvas, cx: number, y0: number, widths: readonly number[], tone: Tone) {
  widths.forEach((hw, i) => {
    if (hw <= 0) return;
    for (let x = Math.round(cx - hw); x < Math.round(cx + hw); x++) {
      const u = (x + 0.5 - cx) / hw;
      c.set(x, y0 + i, u < -0.4 ? tone.hi : u > 0.45 ? tone.dark : tone.mid);
    }
  });
}

/** A flame from its base at (x, y), `h` tall: fire round a bright core. */
export function flame(c: PixelCanvas, x: number, y: number, h: number) {
  const w = h * 0.45;
  c.poly(
    [
      [x - w, y],
      [x - w * 0.7, y - h * 0.5],
      [x - w * 0.1, y - h],
      [x + w * 0.5, y - h * 0.55],
      [x + w, y],
    ],
    'fire',
  );
  c.poly(
    [
      [x - w * 0.5, y],
      [x - w * 0.2, y - h * 0.6],
      [x + w * 0.4, y - h * 0.3],
      [x + w * 0.5, y],
    ],
    'fireHi',
  );
}

/** A white quill from its nib to the tip of its feather, the vane on its left side; outline it with the rest. */
export function quill(c: PixelCanvas, [nx, ny]: readonly [number, number], [tx, ty]: readonly [number, number]) {
  const len = Math.hypot(tx - nx, ty - ny);
  const [dx, dy] = [(tx - nx) / len, (ty - ny) / len];
  const [px, py] = [dy, -dx];
  const at = (t: number, w: number): [number, number] => [nx + dx * len * t + px * w, ny + dy * len * t + py * w];
  c.poly([at(0.25, 0), at(0.5, 5), at(0.85, 4.5), at(1, 0)], 'wool');
  c.poly([at(0.25, 0), at(0.55, -3), at(0.9, -2.5), at(1, 0)], 'linen');
  rod(c, [nx, ny], at(0.3, 0), 3, 'linen');
}
