// A small pixel-art canvas in screen coordinates, shared by the sprites drawn in code (tools/art/draw.ts): the palette,
// filled polygons and lines, centring, the outline that finishes a sprite, and the indexed PNG it is saved as.
// IsoCanvas (iso.ts) builds the isometric buildings and tiles on it, and the troops are drawn on it directly.

import { indexedPng, type Rgb } from './png.ts';

export const PALETTE = {
  clear: [0, 0, 0],
  outline: [52, 36, 28],
  sand: [222, 205, 160],
  sandDark: [196, 176, 128],
  paveA: [208, 194, 156],
  paveB: [186, 170, 130],
  wallTop: [246, 238, 216],
  wallL: [234, 222, 194],
  wallR: [198, 182, 148],
  roofHi: [226, 116, 80],
  roofL: [204, 84, 56],
  roofD: [156, 56, 38],
  roofEdge: [116, 40, 28],
  column: [252, 248, 238],
  portico: [116, 96, 76],
  window: [72, 56, 44],
  stoneTop: [180, 174, 162],
  stoneL: [152, 146, 134],
  stoneR: [118, 112, 102],
  leaf: [92, 134, 66],
  leafDark: [58, 94, 44],
  trunk: [94, 66, 42],
  gold: [232, 186, 72],
  goldDark: [178, 132, 40],
  banner: [178, 44, 44],
  water: [96, 156, 196],
  thatchHi: [216, 182, 108],
  thatchL: [190, 150, 82],
  thatchD: [148, 110, 56],
  thatchEdge: [108, 78, 40],
  grass: [124, 156, 76],
  grassDark: [98, 130, 60],
  soil: [132, 98, 64],
  wood: [122, 88, 56],
  plankTop: [176, 132, 86],
  plankL: [152, 108, 66],
  plankR: [118, 82, 50],
  shingleHi: [116, 104, 96],
  shingleL: [92, 82, 76],
  shingleD: [68, 60, 56],
  shingleEdge: [46, 40, 36],
  pine: [54, 100, 62],
  pineDark: [34, 72, 46],
  log: [150, 106, 64],
  logEnd: [210, 172, 116],
  logDark: [104, 72, 42],
  barnHi: [172, 96, 66],
  barnL: [146, 74, 50],
  barnD: [108, 52, 36],
  barnEdge: [74, 36, 26],
  wheat: [224, 192, 98],
  wheatDark: [186, 152, 72],
  dirt: [178, 142, 98],
  wool: [242, 240, 230],
  sandstoneHi: [222, 200, 156],
  sandstoneL: [196, 170, 122],
  sandstoneR: [156, 130, 90],
  graniteHi: [236, 234, 226],
  graniteL: [206, 204, 196],
  graniteR: [160, 158, 152],
  oreHi: [128, 108, 102],
  oreL: [98, 82, 80],
  oreR: [70, 58, 58],
  rust: [168, 82, 52],
  slateHi: [112, 126, 148],
  slateL: [86, 100, 122],
  slateD: [64, 76, 96],
  slateEdge: [42, 50, 66],
  mud: [110, 112, 66],
  moss: [174, 176, 76],
  reed: [70, 104, 50],
  cactus: [92, 146, 74],
  cactusDark: [62, 108, 54],
  sandLight: [236, 222, 180],
  waterLight: [150, 198, 226],
  waterDeep: [70, 128, 172],
  flower: [236, 120, 140],
  flowerB: [244, 222, 96],
  smoke: [176, 176, 180],
  greenHi: [104, 166, 116],
  greenL: [76, 138, 92],
  greenD: [54, 104, 68],
  greenEdge: [34, 70, 46],
  tealHi: [90, 158, 158],
  tealL: [66, 130, 132],
  tealD: [46, 100, 104],
  tealEdge: [30, 66, 70],
  blue: [72, 112, 172],
  blueDark: [50, 80, 130],
  bannerDark: [128, 30, 32],
  fire: [240, 132, 40],
  fireHi: [252, 222, 100],
  horse: [124, 78, 46],
  horseDark: [86, 52, 30],
  metal: [150, 156, 166],
  skin: [234, 186, 142],
  skinShade: [198, 142, 104],
  hair: [96, 62, 40],
  steelHi: [226, 232, 240],
  steel: [172, 180, 194],
  steelDark: [110, 118, 134],
  leather: [146, 100, 62],
  leatherDark: [104, 70, 44],
  linen: [214, 196, 154],
  linenDark: [174, 154, 112],
  hood: [88, 82, 78],
  hoodDark: [60, 56, 54],
  bannerHi: [214, 76, 64],
  horseHi: [160, 106, 66],
  blueHi: [112, 154, 208],
  blueEdge: [34, 56, 96],
  // the hero figure (tools/art/figure.ts): skin tones and hair colours, each light, mid and shaded
  skinPaleHi: [252, 226, 204],
  skinPale: [240, 204, 176],
  skinPaleShade: [208, 162, 134],
  skinFairHi: [246, 206, 166],
  skinFair: [228, 178, 136],
  skinFairShade: [190, 136, 98],
  skinOliveHi: [220, 170, 122],
  skinOlive: [196, 144, 98],
  skinOliveShade: [154, 104, 68],
  skinBrownHi: [172, 118, 80],
  skinBrown: [140, 92, 60],
  skinBrownShade: [102, 64, 42],
  lips: [176, 92, 84],
  hairBlackHi: [78, 70, 72],
  hairBlack: [44, 38, 40],
  hairBlackDark: [26, 22, 24],
  hairBrownHi: [132, 90, 58],
  hairBrown: [98, 64, 40],
  hairBrownDark: [66, 42, 26],
  hairAuburnHi: [190, 98, 50],
  hairAuburn: [148, 66, 32],
  hairAuburnDark: [100, 40, 20],
  hairBlondHi: [240, 210, 136],
  hairBlond: [212, 168, 86],
  hairBlondDark: [158, 118, 52],
  hairGreyHi: [214, 212, 206],
  hairGrey: [168, 164, 158],
  hairGreyDark: [118, 114, 110],
  mailHi: [150, 156, 168],
  mail: [104, 110, 122],
  // Hero gear only (tools/art/gear.ts, docs/features/hero-gear-art.md): a colour per gear level, 0 to 10, for its backdrop
  // and gems, each light, mid and dark. Reserved for the gear, and kept apart from the colours the app gives a meaning
  // (emerald, rose, sky, violet, amber: lib/tones.ts, lib/hero-attributes.ts): a yellow-green, a cobalt, a plum and a
  // crimson instead.
  gear0Hi: [74, 66, 72],
  gear0: [42, 36, 42],
  gear0Dark: [20, 16, 22],
  gear1Hi: [178, 182, 188],
  gear1: [130, 134, 142],
  gear1Dark: [80, 84, 92],
  gear2Hi: [152, 198, 76],
  gear2: [100, 156, 42],
  gear2Dark: [56, 102, 26],
  gear3Hi: [104, 140, 236],
  gear3: [46, 90, 210],
  gear3Dark: [24, 50, 138],
  gear4Hi: [92, 204, 184],
  gear4: [32, 152, 138],
  gear4Dark: [16, 94, 90],
  gear5Hi: [132, 112, 226],
  gear5: [84, 60, 190],
  gear5Dark: [46, 30, 122],
  gear6Hi: [188, 104, 178],
  gear6: [140, 54, 132],
  gear6Dark: [86, 28, 86],
  gear7Hi: [244, 100, 192],
  gear7: [208, 44, 152],
  gear7Dark: [138, 18, 100],
  gear8Hi: [252, 162, 74],
  gear8: [228, 112, 26],
  gear8Dark: [154, 64, 12],
  gear9Hi: [252, 224, 112],
  gear9: [224, 178, 40],
  gear9Dark: [150, 110, 16],
  gear10Hi: [244, 96, 116],
  gear10: [198, 30, 64],
  gear10Dark: [118, 12, 36],
  // gear stars: red for a star in use, orange for one waiting above the research level
  starHi: [255, 132, 120],
  star: [222, 44, 40],
  starDark: [140, 20, 24],
  waitHi: [255, 214, 120],
  wait: [246, 150, 30],
  waitDark: [170, 90, 10],
  sparkle: [255, 255, 255],
  // items (tools/art/items.ts): bronze for the lowest medals and the Junior Medal Box
  bronzeHi: [226, 166, 104],
  bronze: [184, 116, 60],
  bronzeDark: [118, 70, 34],
} as const satisfies Record<string, Rgb>;

export type Colour = keyof typeof PALETTE;
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
  k: string;
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
  spot(k: string, [x, y]: Pt, n?: number, m?: number) {
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
    for (const i of edge) this.px[i] = indexOf('outline');
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
