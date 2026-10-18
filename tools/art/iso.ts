// A small isometric pixel-art canvas for drawing building sprites in code (tools/art/draw.ts).
// World coordinates: x runs down-right on screen, y down-left, z up; one world unit is one pixel across and half a
// pixel down (the 2:1 isometric of pixel art). Faces are lit from the top left: tops lightest, the south-west face
// (y max) mid, the south-east face (x max) darkest. Draw back to front; outline() finishes the sprite.

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
} as const satisfies Record<string, Rgb>;

/** A roof's colours, lit side to dark side, and the eave line. */
const ROOFING = {
  tile: { hi: 'roofHi', mid: 'roofL', dark: 'roofD', edge: 'roofEdge' },
  thatch: { hi: 'thatchHi', mid: 'thatchL', dark: 'thatchD', edge: 'thatchEdge' },
  shingle: { hi: 'shingleHi', mid: 'shingleL', dark: 'shingleD', edge: 'shingleEdge' },
  barn: { hi: 'barnHi', mid: 'barnL', dark: 'barnD', edge: 'barnEdge' },
  slate: { hi: 'slateHi', mid: 'slateL', dark: 'slateD', edge: 'slateEdge' },
  green: { hi: 'greenHi', mid: 'greenL', dark: 'greenD', edge: 'greenEdge' },
  teal: { hi: 'tealHi', mid: 'tealL', dark: 'tealD', edge: 'tealEdge' },
  canvas: { hi: 'wallTop', mid: 'wallL', dark: 'wallR', edge: 'stoneR' },
  awningRed: { hi: 'wallTop', mid: 'banner', dark: 'bannerDark', edge: 'bannerDark' },
  awningBlue: { hi: 'wallTop', mid: 'blue', dark: 'blueDark', edge: 'blueDark' },
  gold: { hi: 'gold', mid: 'gold', dark: 'goldDark', edge: 'goldDark' },
} as const;

/** Rock faces: top, south-west and south-east. */
const ROCK = {
  sandstone: { top: 'sandstoneHi', left: 'sandstoneL', right: 'sandstoneR' },
  granite: { top: 'graniteHi', left: 'graniteL', right: 'graniteR' },
  ore: { top: 'oreHi', left: 'oreL', right: 'oreR' },
} as const;
export type Rock = keyof typeof ROCK;
export type Roofing = keyof typeof ROOFING;

export type Colour = keyof typeof PALETTE;
const NAMES = Object.keys(PALETTE) as Colour[];
const INDEX = new Map(NAMES.map((n, i) => [n, i]));

type Pt = readonly [number, number];

export class IsoCanvas {
  readonly px: Uint8Array;
  readonly size: number;
  readonly plot: number;

  private state: number;

  /**
   * `plot` is the ground's size in world units; the canvas centres its diamond at the bottom. `seed` makes the
   * natural details (rocks, trees, pond edges) the same on every run.
   */
  constructor(size: number, plot: number, seed = 'marchlands') {
    this.size = size;
    this.plot = plot;
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

  /** Screen position of a world point. */
  p(x: number, y: number, z = 0): Pt {
    const ox = this.size / 2;
    const oy = this.size - 2 - this.plot;
    return [ox + x - y, oy + (x + y) / 2 - z];
  }

  set(x: number, y: number, c: Colour) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && x < this.size && y >= 0 && y < this.size) this.px[y * this.size + x] = INDEX.get(c)!;
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

  /** The ground plot: a diamond of `c`, or of a paving pattern. */
  ground(x0: number, y0: number, w: number, d: number, c: Colour | 'paving') {
    const grid = (x: number, y: number) => ((x + 2 * y) % 8 < 2 || (x - 2 * y + 800) % 8 < 2 ? 'paveB' : 'paveA');
    const fill = c === 'paving' ? grid : c;
    this.poly([this.p(x0, y0), this.p(x0 + w, y0), this.p(x0 + w, y0 + d), this.p(x0, y0 + d)], fill);
  }

  /** A box: top, south-west and south-east faces, with its front corner drawn dark. */
  box(x0: number, y0: number, z0: number, w: number, d: number, h: number, faces: { top: Colour; left: Colour; right: Colour; corner?: Colour }) {
    const z1 = z0 + h;
    this.poly([this.p(x0, y0 + d, z0), this.p(x0 + w, y0 + d, z0), this.p(x0 + w, y0 + d, z1), this.p(x0, y0 + d, z1)], faces.left);
    this.poly([this.p(x0 + w, y0, z0), this.p(x0 + w, y0 + d, z0), this.p(x0 + w, y0 + d, z1), this.p(x0 + w, y0, z1)], faces.right);
    this.poly([this.p(x0, y0, z1), this.p(x0 + w, y0, z1), this.p(x0 + w, y0 + d, z1), this.p(x0, y0 + d, z1)], faces.top);
    if (faces.corner) this.line(this.p(x0 + w, y0 + d, z0), this.p(x0 + w, y0 + d, z1 - 0.5), faces.corner);
  }

  wall(x0: number, y0: number, z0: number, w: number, d: number, h: number) {
    this.box(x0, y0, z0, w, d, h, { top: 'wallTop', left: 'wallL', right: 'wallR', corner: 'wallR' });
  }

  stone(x0: number, y0: number, z0: number, w: number, d: number, h: number) {
    this.box(x0, y0, z0, w, d, h, { top: 'stoneTop', left: 'stoneL', right: 'stoneR', corner: 'stoneR' });
  }

  /** A roof's fill for a slope: thatch streaked like straw, shingles in rows, tile and the rest plain. */
  private slope(roofing: Roofing, base: Colour): Colour | ((x: number, y: number) => Colour) {
    const r = ROOFING[roofing];
    // market awnings are striped white and colour
    if (roofing === 'awningRed' || roofing === 'awningBlue') return (x) => (x % 4 < 2 ? 'wallTop' : base === r.hi ? r.mid : base);
    const period = roofing === 'thatch' ? 3 : roofing === 'shingle' ? 2 : 0;
    return period ? (_x, y) => (y % period === 0 && base !== r.dark ? r.dark : base) : base;
  }

  /**
   * A gable roof over a box footprint, from height zb, rising rh. `along: 'x'` runs the ridge along x (its gable
   * end faces south-east); 'y' runs it along y (gable end facing south-west). Options: the roofing (tile by
   * default), `trim` for the front eaves (gold on a grand building; the ridge itself is on the outline) and `gable`
   * for the gable end's wall.
   */
  roof(
    x0: number,
    y0: number,
    w: number,
    d: number,
    zb: number,
    rh: number,
    along: 'x' | 'y',
    opts: { roofing?: Roofing; trim?: Colour; gable?: Colour } = {},
  ) {
    const roofing = opts.roofing ?? 'tile';
    const r = ROOFING[roofing];
    const trim = opts.trim ?? r.edge;
    const o = 1;
    const zt = zb + rh;
    if (along === 'x') {
      const ym = y0 + d / 2;
      this.poly([this.p(x0 - o, y0 - o, zb), this.p(x0 + w + o, y0 - o, zb), this.p(x0 + w + o, ym, zt), this.p(x0 - o, ym, zt)], this.slope(roofing, r.hi));
      this.poly([this.p(x0 + w, y0, zb), this.p(x0 + w, y0 + d, zb), this.p(x0 + w, ym, zt)], opts.gable ?? 'wallR');
      this.poly(
        [this.p(x0 - o, y0 + d + o, zb), this.p(x0 + w + o, y0 + d + o, zb), this.p(x0 + w + o, ym, zt), this.p(x0 - o, ym, zt)],
        this.slope(roofing, r.mid),
      );
      this.line(this.p(x0 - o, y0 + d + o, zb), this.p(x0 + w + o, y0 + d + o, zb), trim);
      this.line(this.p(x0 + w + o, y0 + d + o, zb), this.p(x0 + w + o, ym, zt), trim);
      this.line(this.p(x0 - o, ym, zt), this.p(x0 + w + o, ym, zt), r.edge);
    } else {
      const xm = x0 + w / 2;
      this.poly([this.p(x0 - o, y0 - o, zb), this.p(x0 - o, y0 + d + o, zb), this.p(xm, y0 + d + o, zt), this.p(xm, y0 - o, zt)], this.slope(roofing, r.hi));
      this.poly([this.p(x0, y0 + d, zb), this.p(x0 + w, y0 + d, zb), this.p(xm, y0 + d, zt)], opts.gable ?? 'wallL');
      this.poly(
        [this.p(x0 + w + o, y0 - o, zb), this.p(x0 + w + o, y0 + d + o, zb), this.p(xm, y0 + d + o, zt), this.p(xm, y0 - o, zt)],
        this.slope(roofing, r.dark),
      );
      this.line(this.p(x0 + w + o, y0 - o, zb), this.p(x0 + w + o, y0 + d + o, zb), trim);
      this.line(this.p(x0 - o, y0 + d + o, zb), this.p(xm, y0 + d + o, zt), trim);
      this.line(this.p(xm, y0 - o, zt), this.p(xm, y0 + d + o, zt), r.edge);
    }
  }

  /**
   * A hip roof (sloped on all four sides) over a box footprint, from height zb, rising rh; the ridge runs along the
   * longer side, `along`. Thatch is streaked so it reads as straw.
   */
  hipRoof(x0: number, y0: number, w: number, d: number, zb: number, rh: number, along: 'x' | 'y', roofing: Roofing = 'thatch') {
    const r = ROOFING[roofing];
    const o = 1;
    const zt = zb + rh;
    const streak = (base: Colour) => this.slope(roofing, base);
    const [a0, a1, b0, b1] = [x0 - o, x0 + w + o, y0 - o, y0 + d + o];
    if (along === 'x') {
      const ym = y0 + d / 2;
      const inset = Math.min(d / 2, w / 2);
      const [r0, r1] = [x0 + inset, x0 + w - inset];
      this.poly([this.p(a0, b0, zb), this.p(a1, b0, zb), this.p(r1, ym, zt), this.p(r0, ym, zt)], streak(r.hi));
      this.poly([this.p(a0, b0, zb), this.p(a0, b1, zb), this.p(r0, ym, zt)], streak(r.hi));
      this.poly([this.p(a1, b0, zb), this.p(a1, b1, zb), this.p(r1, ym, zt)], streak(r.dark));
      this.poly([this.p(a0, b1, zb), this.p(a1, b1, zb), this.p(r1, ym, zt), this.p(r0, ym, zt)], streak(r.mid));
      this.line(this.p(a0, b1, zb), this.p(a1, b1, zb), r.edge);
      this.line(this.p(a1, b0, zb), this.p(a1, b1, zb), r.edge);
      this.line(this.p(a1, b1, zb), this.p(r1, ym, zt), r.edge);
    } else {
      const xm = x0 + w / 2;
      const inset = Math.min(d / 2, w / 2);
      const [r0, r1] = [y0 + inset, y0 + d - inset];
      this.poly([this.p(a0, b0, zb), this.p(a0, b1, zb), this.p(xm, r1, zt), this.p(xm, r0, zt)], streak(r.hi));
      this.poly([this.p(a0, b0, zb), this.p(a1, b0, zb), this.p(xm, r0, zt)], streak(r.hi));
      this.poly([this.p(a0, b1, zb), this.p(a1, b1, zb), this.p(xm, r1, zt)], streak(r.mid));
      this.poly([this.p(a1, b0, zb), this.p(a1, b1, zb), this.p(xm, r1, zt), this.p(xm, r0, zt)], streak(r.dark));
      this.line(this.p(a0, b1, zb), this.p(a1, b1, zb), r.edge);
      this.line(this.p(a1, b0, zb), this.p(a1, b1, zb), r.edge);
      this.line(this.p(a1, b1, zb), this.p(xm, r1, zt), r.edge);
    }
  }

  /** A timber building: plank walls, the boards drawn as darker stripes. */
  timber(x0: number, y0: number, z0: number, w: number, d: number, h: number) {
    const boards = (base: Colour) => (x: number) => (x % 3 === 0 ? 'plankR' : base);
    this.box(x0, y0, z0, w, d, h, { top: 'plankTop', left: 'plankL', right: 'plankR', corner: 'logDark' });
    this.poly([this.p(x0, y0 + d, z0), this.p(x0 + w, y0 + d, z0), this.p(x0 + w, y0 + d, z0 + h), this.p(x0, y0 + d, z0 + h)], boards('plankL'));
  }

  /** A pine: a dark-green cone in tiers on a short trunk, shaded on its right. */
  pine(x: number, y: number, h: number) {
    const [sx, sy] = this.p(x, y);
    this.set(sx, sy, 'trunk');
    for (let i = 1; i <= h; i++) {
      const fromTop = h - i;
      // widest at the foot, a notch every third row for the tiers of branches
      const half = Math.max(0, Math.floor(fromTop / 2.2) - (fromTop % 3 === 2 ? 1 : 0));
      for (let dx = -half; dx <= half; dx++) this.set(sx + dx, sy - i, dx > 0 ? 'pineDark' : 'pine');
    }
  }

  /** A tree stump. */
  stump(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    this.set(sx, sy, 'logDark');
    this.set(sx, sy - 1, 'logEnd');
  }

  /** A pile of logs along x: `rows` layers, each one log shorter at both ends; the cut ends face south-east. */
  logs(x0: number, y0: number, len: number, rows: number) {
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < rows - r; i++) this.box(x0 + r, y0 + i * 1 + r * 0.5, r, len - r, 1, 1, { top: 'log', left: 'logDark', right: 'logEnd' });
  }

  /** A water wheel on a south-east face (x = x0), centred on (y, z): a dark rim with light paddles. */
  wheel(x: number, y: number, z: number, radius: number) {
    const [cx, cy] = this.p(x, y, z);
    for (let a = 0; a < 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      for (const r of [radius, radius - 1]) this.set(cx + Math.cos(rad) * r * 0.6, cy + Math.sin(rad) * r, 'logDark');
    }
    for (let a = 0; a < 360; a += 45) {
      const rad = (a * Math.PI) / 180;
      this.line([cx, cy], [cx + Math.cos(rad) * (radius - 1) * 0.6, cy + Math.sin(rad) * (radius - 1)], 'wood');
      this.set(cx + Math.cos(rad) * (radius + 1) * 0.6, cy + Math.sin(rad) * (radius + 1), 'logEnd');
    }
    this.set(cx, cy, 'logEnd');
  }

  /** A field of crops: soil with rows along x, ripe wheat or green shoots. */
  crops(x0: number, y0: number, w: number, d: number, kind: 'wheat' | 'green') {
    const [a, b] = kind === 'wheat' ? (['wheat', 'wheatDark'] as const) : (['leaf', 'leafDark'] as const);
    this.poly([this.p(x0, y0), this.p(x0 + w, y0), this.p(x0 + w, y0 + d), this.p(x0, y0 + d)], 'soil');
    for (let y = y0 + 0.5; y < y0 + d; y += 2) this.line(this.p(x0 + 0.5, y), this.p(x0 + w - 0.5, y), a);
    for (let y = y0 + 1.5; y < y0 + d; y += 2) for (let x = x0 + 1; x < x0 + w; x += 3) this.set(...this.p(x, y), b);
  }

  /** A haystack: a golden mound. */
  haystack(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    [1, 3, 5, 5].forEach((width, i) => {
      for (let dx = -Math.floor(width / 2); dx <= Math.floor(width / 2); dx++) this.set(sx + dx, sy - 3 + i, dx > 0 ? 'wheatDark' : 'wheat');
    });
  }

  /** A sheep: a white fleece with a dark head. */
  sheep(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    this.set(sx, sy - 1, 'wool');
    this.set(sx + 1, sy - 1, 'wool');
    this.set(sx - 1, sy - 1, 'outline');
    this.set(sx, sy, 'logDark');
    this.set(sx + 1, sy, 'logDark');
  }

  /** A path of trodden earth on the ground. */
  path(x0: number, y0: number, w: number, d: number) {
    this.poly([this.p(x0, y0), this.p(x0 + w, y0), this.p(x0 + w, y0 + d), this.p(x0, y0 + d)], 'dirt');
  }

  /** Windmill sails on a south-west face, centred on a world point: four canvas blades on wooden spars. */
  sails(x: number, y: number, z: number, len: number) {
    const [cx, cy] = this.p(x, y, z);
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      for (let i = 1; i <= len; i++) {
        this.set(cx + dx * i, cy + dy * i * 0.8, 'wood');
        // the canvas: two pixels wide beside the spar, from a third of the way out
        if (i > len / 3) for (const w of [1, 2]) this.set(cx + dx * i + dx * w, cy + dy * i * 0.8, 'wallTop');
      }
    }
    this.set(cx, cy, 'logDark');
  }

  /** A rock spire: a column of stone with a narrower cap, `w` across. */
  spire(x: number, y: number, h: number, w: number, rock: Rock) {
    const f = ROCK[rock];
    this.box(x, y, 0, w, w, Math.max(1, h - 2), f);
    if (h > 2 && w > 1) this.box(x + 0.5, y + 0.5, h - 2, w - 1, w - 1, 2, f);
  }

  /** A rocky outcrop: spires of random height over an area, tallest towards the middle, drawn back to front. */
  outcrop(x0: number, y0: number, w: number, d: number, maxH: number, rock: Rock, step = 2) {
    const spots: [number, number, number][] = [];
    for (let y = y0; y < y0 + d; y += step)
      for (let x = x0; x < x0 + w; x += step) {
        const edge = Math.min(x - x0, x0 + w - x, y - y0, y0 + d - y) / Math.max(1, Math.min(w, d) / 2);
        const h = Math.round(maxH * (0.35 + 0.65 * Math.min(1, edge)) * (0.6 + 0.4 * this.rand()));
        if (h > 0) spots.push([x + this.rand() * 0.6, y + this.rand() * 0.6, h]);
      }
    spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
    for (const [x, y, h] of spots) this.spire(x, y, h, step + 1, rock);
  }

  /**
   * An organic patch on the ground (a pond, a bog, a sandy shore): an ellipse round (cx, cy) with radii rx, ry in
   * world units, its edge wobbling. `fill` may pick a colour per pixel.
   */
  blob(cx: number, cy: number, rx: number, ry: number, fill: Colour | ((x: number, y: number) => Colour)) {
    const phase = this.rand() * Math.PI * 2;
    for (let y = cy - ry - 1; y <= cy + ry + 1; y += 0.5)
      for (let x = cx - rx - 1; x <= cx + rx + 1; x += 0.5) {
        const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
        const wobble = 1 + 0.12 * Math.sin(3 * a + phase) + 0.06 * Math.sin(5 * a + phase * 2);
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= wobble * wobble) {
          const [sx, sy] = this.p(x, y);
          for (const [dx, dy] of [
            [0, 0],
            [1, 0],
          ])
            this.set(sx + dx, sy + dy, typeof fill === 'function' ? fill(Math.floor(sx + dx), Math.floor(sy + dy)) : fill);
        }
      }
  }

  /** Water with a few light ripples. */
  water(x: number, y: number): Colour {
    return (x * 5 + y * 11) % 23 === 0 ? 'waterLight' : 'water';
  }

  /** A palm: a curved trunk and drooping fronds. */
  palm(x: number, y: number, h: number) {
    const [sx, sy] = this.p(x, y);
    for (let i = 0; i < h; i++) this.set(sx + Math.round(Math.sin((i / h) * 1.4) * 2), sy - i, i % 2 ? 'trunk' : 'logDark');
    const tx = sx + Math.round(Math.sin(1.4) * 2);
    const ty = sy - h;
    for (const [dx, dy] of [
      [-4, 2],
      [-3, -1],
      [0, -3],
      [3, -1],
      [4, 2],
    ])
      for (const off of [0, 1]) this.line([tx, ty + off], [tx + dx, ty + dy + off], dx > 0 ? 'leafDark' : 'leaf');
    this.set(tx, ty, 'leafDark');
  }

  /** A cactus with two arms. */
  cactus(x: number, y: number, h: number) {
    const [sx, sy] = this.p(x, y);
    for (let i = 0; i < h; i++) {
      this.set(sx, sy - i, 'cactus');
      this.set(sx + 1, sy - i, 'cactusDark');
    }
    const arm = Math.max(2, Math.floor(h / 3));
    for (let i = 0; i < arm; i++) {
      this.set(sx - 2, sy - arm - i, 'cactus');
      this.set(sx + 3, sy - arm - 1 - i, 'cactusDark');
    }
    this.set(sx - 1, sy - arm, 'cactus');
    this.set(sx + 2, sy - arm - 1, 'cactusDark');
  }

  /** A clump of reeds. */
  reeds(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    for (const [dx, h] of [
      [-1, 3],
      [0, 5],
      [1, 4],
    ]) {
      this.line([sx + dx, sy], [sx + dx, sy - h + 1], 'reed');
      this.set(sx + dx, sy - h, 'trunk');
    }
  }

  /** A tuft of tall grass. */
  tuft(x: number, y: number, h: number) {
    const [sx, sy] = this.p(x, y);
    this.line([sx - 1, sy], [sx - 2, sy - h + 1], 'grassDark');
    this.line([sx, sy], [sx, sy - h], 'grass');
    this.line([sx + 1, sy], [sx + 2, sy - h + 1], 'leafDark');
  }

  /** A flower on the ground. */
  flower(x: number, y: number, c: Colour = 'flower') {
    const [sx, sy] = this.p(x, y);
    this.set(sx, sy, 'leafDark');
    this.set(sx, sy - 1, c);
  }

  /** A mine entrance in a south-west face: a dark opening framed with timber. */
  mineEntrance(x: number, y: number, w: number, h: number) {
    this.poly([this.p(x, y, 0), this.p(x + w, y, 0), this.p(x + w, y, h), this.p(x, y, h)], 'outline');
    this.line(this.p(x, y, 0), this.p(x, y, h), 'wood');
    this.line(this.p(x + w, y, 0), this.p(x + w, y, h), 'wood');
    this.line(this.p(x - 0.5, y, h), this.p(x + w + 0.5, y, h), 'plankTop');
  }

  /** A wooden crane (a derrick): a mast, a boom out to the south-east, and a rope with a stone hanging. */
  derrick(x: number, y: number, h: number) {
    const top = this.p(x, y, h);
    this.line(this.p(x, y, 0), top, 'wood');
    this.line(this.p(x - 1, y + 1, 0), this.p(x, y, h - 2), 'logDark');
    const tip = this.p(x + 5, y, h - 1);
    this.line(top, tip, 'wood');
    this.line(tip, [tip[0], tip[1] + 4], 'outline');
    this.set(tip[0], tip[1] + 5, 'graniteL');
    this.set(tip[0] + 1, tip[1] + 5, 'graniteR');
  }

  /** A mine cart on rails, full of ore. */
  cart(x: number, y: number, len: number) {
    this.line(this.p(x - 2, y + 1), this.p(x + len + 2, y + 1), 'logDark');
    this.box(x, y, 0, 2, 2, 2, { top: 'rust', left: 'oreL', right: 'oreR' });
  }

  /** A puff of smoke rising from a screen point. */
  smoke([sx, sy]: Pt) {
    for (const [dx, dy] of [
      [0, -1],
      [1, -2],
      [0, -3],
      [1, -4],
      [2, -5],
      [1, -6],
    ])
      this.set(sx + dx, sy + dy, 'smoke');
  }

  /** A tent: a canvas hip roof standing on the ground. */
  tent(x: number, y: number, w: number, d: number, h: number) {
    this.hipRoof(x, y, w, d, 0, h, w >= d ? 'x' : 'y', 'canvas');
  }

  /** A market stall: a plank counter under a striped awning. */
  stall(x: number, y: number, colour: 'red' | 'blue') {
    this.timber(x, y, 0, 3, 2, 1);
    this.line(this.p(x, y + 2, 1), this.p(x, y + 2, 3), 'wood');
    this.line(this.p(x + 3, y + 2, 1), this.p(x + 3, y + 2, 3), 'wood');
    this.hipRoof(x, y, 3, 2, 3, 1, 'x', colour === 'red' ? 'awningRed' : 'awningBlue');
  }

  /**
   * A dome on a square drum `w` across, its base at height z: a hemisphere drawn pixel by pixel in the isometric view
   * (the base circle seen as a 2:1 ellipse, the crown rising above it), shaded from the top-left light in four tones,
   * with a finial on top. Slate or gold.
   */
  dome(x: number, y: number, z: number, w: number, roofing: 'slate' | 'gold') {
    const tones: readonly Colour[] = roofing === 'gold' ? ['goldDark', 'gold', 'gold', 'fireHi'] : ['slateD', 'slateL', 'slateHi', 'graniteL'];
    const r = w / 2;
    const [cx, cy] = this.p(x + r, y + r, z);
    // the base circle projects to an ellipse rx across and ry deep; the crown rises r above its centre
    const rx = r * Math.SQRT2;
    const ry = rx / 2;
    const up = r + ry * 0.1;
    for (let py = Math.floor(cy - up) - 1; py <= Math.ceil(cy + ry); py++)
      for (let px = Math.floor(cx - rx) - 1; px <= Math.ceil(cx + rx); px++) {
        const dx = (px + 0.5 - cx) / rx;
        const dy = (py + 0.5 - cy) / (py + 0.5 < cy ? up : ry);
        const d = dx * dx + dy * dy;
        if (d > 1) continue;
        // light from the top left, and a darker rim
        const lit = -0.6 * dx - 0.8 * dy + 0.35 - 0.45 * d;
        const tone = lit > 0.72 ? 3 : lit > 0.2 ? 2 : lit > -0.25 ? 1 : 0;
        this.set(px, py, tones[tone]);
      }
    // the finial: a short tip (a thin spike would only show as outline)
    const top = Math.floor(cy - up);
    this.line([cx, top - 1], [cx, top - 2], 'gold');
  }

  /** A few crates and sacks. */
  crates(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) {
      const [cx, cy] = [x + (i % 3) * 1.6, y + Math.floor(i / 3) * 1.6];
      if (i % 2) this.box(cx, cy, 0, 1.5, 1.5, 1.5, { top: 'plankTop', left: 'plankL', right: 'plankR' });
      else this.box(cx, cy, 0, 1.5, 1.5, 1, { top: 'wallTop', left: 'wallL', right: 'wallR' });
    }
  }

  /** A horse: a brown body on four legs with a dark mane, facing south-west. */
  horse(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    for (const dx of [0, 1, 2]) this.set(sx + dx, sy - 2, 'horse');
    this.set(sx - 1, sy - 3, 'horse');
    this.set(sx - 1, sy - 2, 'horseDark');
    this.set(sx, sy - 3, 'horseDark');
    for (const dx of [0, 2]) this.set(sx + dx, sy - 1, 'horseDark');
  }

  /** Flames on a screen point (a beacon, a forge). */
  fire([sx, sy]: Pt, h: number) {
    for (let i = 0; i < h; i++) {
      const half = Math.max(0, Math.floor((h - i) / 2.5));
      for (let dx = -half; dx <= half; dx++) this.set(sx + dx, sy - i, Math.abs(dx) < half || i > h - 2 ? 'fireHi' : 'fire');
    }
  }

  /** An anvil on a block. */
  anvil(x: number, y: number) {
    this.box(x, y, 0, 1, 1, 1, { top: 'logDark', left: 'logDark', right: 'outline' });
    this.box(x - 0.3, y - 0.3, 1, 1.6, 1, 0.6, { top: 'metal', left: 'stoneR', right: 'outline' });
  }

  /** A straw training dummy on a post. */
  dummy(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    this.line([sx, sy], [sx, sy - 5], 'wood');
    this.line([sx - 2, sy - 4], [sx + 2, sy - 4], 'wood');
    this.set(sx, sy - 6, 'wheat');
    this.set(sx, sy - 5, 'wheatDark');
  }

  /** A rack of spears. */
  rack(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    this.line([sx - 2, sy - 2], [sx + 2, sy - 2], 'wood');
    for (const dx of [-2, -1, 0, 1, 2]) {
      this.line([sx + dx, sy], [sx + dx, sy - 5], 'wood');
      this.set(sx + dx, sy - 6, 'metal');
    }
  }

  /** A catapult: a timber frame and a throwing arm. */
  catapult(x: number, y: number) {
    this.box(x, y, 0, 4, 2, 1, { top: 'plankTop', left: 'plankL', right: 'plankR' });
    const pivot = this.p(x + 2, y + 1, 3);
    this.line(this.p(x + 1.5, y + 1, 1), pivot, 'wood');
    this.line(this.p(x + 2.5, y + 1, 1), pivot, 'wood');
    this.line([pivot[0] - 4, pivot[1] + 1], [pivot[0] + 4, pivot[1] - 4], 'logDark');
    this.set(pivot[0] + 4, pivot[1] - 5, 'stoneL');
  }

  /** A statue on a plinth. */
  statue(x: number, y: number) {
    this.stone(x, y, 0, 2, 2, 2);
    const [sx, sy] = this.p(x + 1, y + 1, 2);
    for (let i = 1; i <= 4; i++) this.set(sx, sy - i, i === 4 ? 'graniteHi' : 'graniteL');
    this.set(sx - 1, sy - 3, 'graniteL');
    this.set(sx + 1, sy - 2, 'graniteR');
  }

  /** A round paved plaza. */
  plaza(cx: number, cy: number, r: number) {
    this.blob(cx, cy, r, r, (x, y) => ((x + 2 * y) % 8 < 2 || (x - 2 * y + 800) % 8 < 2 ? 'paveB' : 'paveA'));
  }

  /** A patch of grass, flecked darker. */
  grass(x0: number, y0: number, w: number, d: number) {
    this.poly([this.p(x0, y0), this.p(x0 + w, y0), this.p(x0 + w, y0 + d), this.p(x0, y0 + d)], (x, y) => ((x * 7 + y * 13) % 9 === 0 ? 'grassDark' : 'grass'));
  }

  /** A vegetable garden: dark soil with rows of green along x. */
  garden(x0: number, y0: number, w: number, d: number) {
    this.poly([this.p(x0, y0), this.p(x0 + w, y0), this.p(x0 + w, y0 + d), this.p(x0, y0 + d)], 'soil');
    for (let y = y0 + 1; y < y0 + d; y += 2) for (let x = x0 + 1; x < x0 + w; x += 2) this.set(...this.p(x, y), 'leaf');
  }

  /** A wooden fence from one ground point to another: posts every 2 units and a rail. */
  fence(x0: number, y0: number, x1: number, y1: number) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    this.line(this.p(x0, y0, 2), this.p(x1, y1, 2), 'wood');
    for (let i = 0; i <= steps; i += 2) {
      const [x, y] = [x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps];
      this.line(this.p(x, y, 0), this.p(x, y, 2), 'wood');
    }
  }

  /** A stone well with water in it. */
  well(x: number, y: number) {
    this.box(x, y, 0, 3, 3, 2, { top: 'water', left: 'stoneL', right: 'stoneR', corner: 'stoneR' });
    this.line(this.p(x, y + 3, 2), this.p(x, y + 3, 5), 'wood');
    this.line(this.p(x + 3, y, 2), this.p(x + 3, y, 5), 'wood');
    this.line(this.p(x, y + 3, 5), this.p(x + 3, y, 5), 'wood');
  }

  /** A colonnade on a box's south-west face (y = y0 + d): white columns every 2 units over a shaded porch. */
  colonnade(x0: number, y: number, z0: number, w: number, h: number) {
    this.poly([this.p(x0, y, z0), this.p(x0 + w, y, z0), this.p(x0 + w, y, z0 + h), this.p(x0, y, z0 + h)], 'portico');
    for (let x = x0 + 1; x < x0 + w; x += 2) this.line(this.p(x, y, z0), this.p(x, y, z0 + h - 1), 'column');
  }

  /** Columns on a south-east face (x = x0 + w), every 2 units. */
  colonnadeSe(x: number, y0: number, z0: number, d: number, h: number) {
    this.poly([this.p(x, y0, z0), this.p(x, y0 + d, z0), this.p(x, y0 + d, z0 + h), this.p(x, y0, z0 + h)], 'portico');
    for (let y = y0 + 1; y < y0 + d; y += 2) this.line(this.p(x, y, z0), this.p(x, y, z0 + h - 1), 'column');
  }

  /** Small windows or doors on a south-west face: dark marks `h` high at each x. */
  windows(xs: number[], y: number, z0: number, h: number, c: Colour = 'window') {
    for (const x of xs) this.line(this.p(x, y, z0), this.p(x, y, z0 + h - 1), c);
  }

  /** Windows on a south-east face, at each y. */
  windowsSe(x: number, ys: number[], z0: number, h: number, c: Colour = 'window') {
    for (const y of ys) this.line(this.p(x, y, z0), this.p(x, y, z0 + h - 1), c);
  }

  /** A cypress: a tall dark-green flame on a short trunk. */
  cypress(x: number, y: number, h: number) {
    const [sx, sy] = this.p(x, y);
    this.set(sx, sy, 'trunk');
    for (let i = 1; i <= h; i++) {
      const half = i < h - 1 ? 1 : 0;
      for (let dx = -half; dx <= half; dx++) this.set(sx + dx, sy - i, dx === 1 ? 'leafDark' : 'leaf');
    }
  }

  /** Crenellations along the top of a stone box's front edges. */
  crenels(x0: number, y0: number, z: number, w: number, d: number) {
    for (let x = x0; x <= x0 + w; x += 2) this.set(...this.p(x, y0 + d, z + 1), 'stoneTop');
    for (let y = y0; y <= y0 + d; y += 2) this.set(...this.p(x0 + w, y, z + 1), 'stoneTop');
  }

  /** A banner on a pole standing at a screen point. */
  banner([sx, sy]: Pt, h: number) {
    this.line([sx, sy], [sx, sy - h], 'outline');
    for (let y = 0; y < 3; y++) for (let x = 1; x <= 3; x++) this.set(sx + x, sy - h + y, y === 2 && x === 3 ? 'clear' : 'banner');
  }

  /** Move the drawing so it sits in the middle of the canvas, top to bottom. */
  centre() {
    const n = this.size;
    const rows = [...Array(n).keys()].filter((y) => this.px.subarray(y * n, (y + 1) * n).some((v) => v !== 0));
    if (!rows.length) return;
    const shift = Math.floor((n - (rows[rows.length - 1] - rows[0] + 1)) / 2) - rows[0];
    const out = new Uint8Array(n * n);
    for (let y = 0; y < n; y++) {
      const to = y + shift;
      if (to >= 0 && to < n) out.set(this.px.subarray(y * n, (y + 1) * n), to * n);
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
    for (const i of edge) this.px[i] = INDEX.get('outline')!;
  }

  /** The sprite as a PNG holding only the colours it uses (so a new palette colour doesn't change other sprites). */
  png(): Buffer {
    const used = [0, ...[...new Set(this.px)].filter((i) => i !== 0).sort((a, b) => a - b)];
    const remap = new Map(used.map((old, i) => [old, i]));
    return indexedPng(
      this.size,
      this.size,
      this.px.map((i) => remap.get(i)!),
      used.map((i) => PALETTE[NAMES[i]]),
    );
  }
}
