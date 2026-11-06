// A small pixel-art canvas in screen coordinates, shared by the sprites drawn in code (tools/art/draw.ts):
// filled polygons and lines, centring, the outline that finishes a sprite, and the indexed PNG it is saved as.
// IsoCanvas (iso.ts) builds the isometric buildings and tiles on it, and the troops are drawn on it directly.

import type { SpotKind } from '@marchlands/core';
import { indexedPng } from './png.ts';
import { Colour, PALETTE } from '../../client/web/src/lib/palette.ts';

const NAMES = Object.keys(PALETTE) as Colour[];
const INDEX = new Map(NAMES.map((n, i) => [n, i]));
/** A colour's palette index; every Colour is in the palette, so a miss is a typo in a drawing. */
function indexOf(c: Colour): number {
  const i = INDEX.get(c);
  if (i === undefined) throw new Error(`no colour ${c} in the palette`);
  return i;
}

export type Pt = readonly [number, number];

/**
 * Where something that moves stands on a sprite (client/web/src/assets/spots.json): a chimney's smoke, a windmill's hub,
 * a lit window. `x` and `y` are the sprite's pixels; `n` and `m` are its size where it has one (a sail's length, a
 * wheel's radius, a window's height, a field's width and depth in world units).
 */
export interface Spot {
  k: SpotKind;
  x: number;
  y: number;
  n?: number;
  m?: number;
}

export class PixelCanvas {
  readonly px: Uint8Array;
  readonly size: number;
  /** Where the moving parts stand, in the order they were drawn (`spot`); `shift` moves them with the pixels. */
  readonly spots: Spot[] = [];

  private state: number;

  /** `seed` makes the random details (rocks, trees, pond edges) the same on every run. */
  constructor(size: number, seed = 'marchlands') {
    this.size = size;
    this.px = new Uint8Array(size * size);
    // FNV-1a of the seed starts a mulberry32 generator
    let h = 2166136261;
    for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    this.state = h >>> 0;
  }

  /** A random number in [0, 1), from the seed. */
  rand(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** A random whole number from `min` to `max`. */
  between(min: number, max: number): number {
    return min + Math.floor(this.rand() * (max - min + 1));
  }

  set(x: number, y: number, c: Colour) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.px[y * this.size + x] = indexOf(c);
  }

  get(x: number, y: number): Colour {
    return NAMES[this.px[y * this.size + x]];
  }

  /** Fill a convex polygon (screen points), by pixel centres; `pattern` picks a colour per pixel. */
  poly(pts: Pt[], c: Colour | ((x: number, y: number) => Colour)) {
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        const cx = x + 0.5;
        const cy = y + 0.5;
        let sign = 0;
        let inside = true;
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i];
          const [bx, by] = pts[(i + 1) % pts.length];
          const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
          if (Math.abs(cross) < 1e-9) continue;
          const s = Math.sign(cross);
          if (sign === 0) sign = s;
          else if (s !== sign) {
            inside = false;
            break;
          }
        }
        if (inside) this.set(x, y, typeof c === 'function' ? c(x, y) : c);
      }
  }

  /** A pixel line between two screen points. */
  line([x0, y0]: Pt, [x1, y1]: Pt, c: Colour) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= steps; i++) this.set(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c);
  }

  /** Move the drawing so it sits in the middle of the canvas, top to bottom. */
  centre() {
    const n = this.size;
    const rows = [...Array(n).keys()].filter((y) => this.px.subarray(y * n, (y + 1) * n).some((v) => v !== 0));
    if (!rows.length) return;
    this.shift(Math.floor((n - (rows[rows.length - 1] - rows[0] + 1)) / 2) - rows[0]);
  }

  /** Record where something that moves stands, at a screen point (rounded to a pixel), with its size if it has one. */
  spot(k: SpotKind, [x, y]: Pt, n?: number, m?: number) {
    const s: Spot = { k, x: Math.round(x), y: Math.round(y) };
    if (n != null) s.n = Math.round(n * 10) / 10;
    if (m != null) s.m = Math.round(m * 10) / 10;
    this.spots.push(s);
  }

  /** Move the drawing `by` rows down (up when negative); a drawn row moved off the canvas is an error, never a crop. */
  shift(by: number) {
    for (const s of this.spots) s.y += by;
    const n = this.size;
    const out = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) {
      const to = y + by;
      const row = this.px.subarray(y * n, (y + 1) * n);
      if (to >= 0 && to < n) out.set(row, to * n);
      else if (row.some((v) => v !== 0)) throw new Error(`shift(${by}) would cut off row ${y}`);
    }
    this.px.set(out);
  }

  /**
   * Darken every drawn pixel next to a transparent one, so the shape reads at any scale. `edges: false` leaves the
   * canvas's own edges alone, for a piece that repeats (a stretch of wall): its seams must not show.
   */
  outline({ edges = true }: { edges?: boolean } = {}) {
    const n = this.size;
    const edge: number[] = [];
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        if (this.px[y * n + x] === 0) continue;
        const open = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= n || ny >= n) return edges;
          return this.px[ny * n + nx] === 0;
        });
        if (open) edge.push(y * n + x);
      }
    for (const i of edge) this.px[i] = indexOf(Colour.OUTLINE);
  }

  /** The sprite as a PNG holding only the colours it uses (so a new palette colour doesn't change other sprites). */
  png(): Buffer {
    const used = [0, ...[...new Set(this.px)].filter((i) => i !== 0).sort((a, b) => a - b)];
    const remap = new Map(used.map((old, i) => [old, i]));
    return indexedPng(
      this.size,
      this.size,
      this.px.map((i) => remap.get(i) ?? 0), // every index is in `used`
      used.map((i) => PALETTE[NAMES[i]]),
    );
  }
}
