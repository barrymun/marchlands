// A small isometric pixel-art canvas for drawing building sprites in code (tools/art/draw.ts).
// World coordinates: x runs down-right on screen, y down-left, z up; one world unit is one pixel across and half a
// pixel down (the 2:1 isometric of pixel art). Faces are lit from the top left: tops lightest, the south-west face
// (y max) mid, the south-east face (x max) darkest. Draw back to front; outline() finishes the sprite.

import { type Colour, PixelCanvas, type Pt } from './pixel.ts';

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

export class IsoCanvas extends PixelCanvas {
  /**
   * Draw sprites bare: without their moving parts (windmill sails, water wheels, sheep), which the animated town draws
   * moving over the bare sprite. Their spots are still recorded. Set by tools/art/draw.ts around a second drawing.
   */
  static bare = false;

  readonly plot: number;
  readonly scale: number;

  /**
   * `plot` is the ground's size in world units; the canvas centres its diamond at the bottom. `seed` makes the
   * natural details (rocks, trees, pond edges) the same on every run. `scale` draws everything that many times bigger
   * (shapes grow, while one-pixel details such as columns and window bars stay one pixel): the Town Hall drawn at 2 on a
   * 128-pixel canvas is the 2×2 Town Hall of the isometric town.
   */
  constructor(size: number, plot: number, seed = 'marchlands', scale = 1) {
    super(size, seed);
    this.plot = plot;
    this.scale = scale;
  }

  /**
   * Move the drawing up so the middle of its ground diamond sits `tiles` × 16 + 2 pixels above the canvas's bottom
   * whatever the plot's size: on a 64-pixel sprite that is (32, 46), the middle of a 64×32 map tile whose front corner
   * is 2 pixels above the bottom; on a 128-pixel sprite anchored at 2 tiles, (64, 94), the middle of a 2×2 block.
   * Building sprites are anchored this way, so the isometric city view can stand each one on its tile
   * (client/web/src/components/buildings-panel/iso-grid/utils.ts, spriteBox).
   */
  anchor(tiles = 1) {
    this.shift(Math.round(this.size - 2 - 16 * tiles - (this.size - 2 - (this.plot * this.scale) / 2)));
  }

  /** Screen position of a world point. */
  p(x: number, y: number, z = 0): Pt {
    const k = this.scale;
    const ox = this.size / 2;
    const oy = this.size - 2 - this.plot * k;
    return [ox + (x - y) * k, oy + ((x + y) / 2 - z) * k];
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
    this.spot('logs', this.p(x0 + len / 2, y0 + rows / 2, rows), len);
    for (let r = 0; r < rows; r++)
      for (let i = 0; i < rows - r; i++) this.box(x0 + r, y0 + i * 1 + r * 0.5, r, len - r, 1, 1, { top: 'log', left: 'logDark', right: 'logEnd' });
  }

  /** A water wheel on a south-east face (x = x0), centred on (y, z): a dark rim with light paddles. */
  wheel(x: number, y: number, z: number, radius: number) {
    const [cx, cy] = this.p(x, y, z);
    this.spot('wheel', [cx, cy], radius);
    if (IsoCanvas.bare) return;
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
    this.spot('crops', this.p(x0 + w / 2, y0 + d / 2), w, d);
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
    this.spot('sheep', [sx, sy]);
    if (IsoCanvas.bare) return;
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
    this.spot('sails', [cx, cy], len);
    if (IsoCanvas.bare) return;
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
    this.spot('rock', this.p(x0 + w / 2, y0 + d / 2, maxH), w, d);
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
    this.spot('mine', this.p(x + w / 2, y, 0), w, h);
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
    this.spot('smoke', [sx, sy]);
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
    this.spot('tent', this.p(x + w / 2, y + d / 2, 0), w, d);
    this.hipRoof(x, y, w, d, 0, h, w >= d ? 'x' : 'y', 'canvas');
  }

  /** A market stall: a plank counter under a striped awning. */
  stall(x: number, y: number, colour: 'red' | 'blue') {
    this.spot('stall', this.p(x + 1.5, y + 2.5, 0));
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
    this.spot('dome', [cx, top], w);
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
    this.spot('horse', [sx, sy]);
    for (const dx of [0, 1, 2]) this.set(sx + dx, sy - 2, 'horse');
    this.set(sx - 1, sy - 3, 'horse');
    this.set(sx - 1, sy - 2, 'horseDark');
    this.set(sx, sy - 3, 'horseDark');
    for (const dx of [0, 2]) this.set(sx + dx, sy - 1, 'horseDark');
  }

  /** Flames on a screen point (a beacon, a forge). */
  fire([sx, sy]: Pt, h: number) {
    this.spot('fire', [sx, sy], h);
    for (let i = 0; i < h; i++) {
      const half = Math.max(0, Math.floor((h - i) / 2.5));
      for (let dx = -half; dx <= half; dx++) this.set(sx + dx, sy - i, Math.abs(dx) < half || i > h - 2 ? 'fireHi' : 'fire');
    }
  }

  /** An anvil on a block. */
  anvil(x: number, y: number) {
    this.spot('anvil', this.p(x + 0.5, y + 0.5, 1.6));
    this.box(x, y, 0, 1, 1, 1, { top: 'logDark', left: 'logDark', right: 'outline' });
    this.box(x - 0.3, y - 0.3, 1, 1.6, 1, 0.6, { top: 'metal', left: 'stoneR', right: 'outline' });
  }

  /** A straw training dummy on a post. */
  dummy(x: number, y: number) {
    const [sx, sy] = this.p(x, y);
    this.spot('dummy', [sx, sy]);
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
    this.spot('catapult', pivot);
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
    this.spot('well', this.p(x + 1.5, y + 1.5, 0));
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
    for (const x of xs) {
      this.line(this.p(x, y, z0), this.p(x, y, z0 + h - 1), c);
      if (c === 'window' || c === 'fire') this.spot(c === 'fire' ? 'glow' : 'window', this.p(x, y, z0 + h - 1), h);
    }
  }

  /** Windows on a south-east face, at each y. */
  windowsSe(x: number, ys: number[], z0: number, h: number, c: Colour = 'window') {
    for (const y of ys) {
      this.line(this.p(x, y, z0), this.p(x, y, z0 + h - 1), c);
      if (c === 'window' || c === 'fire') this.spot(c === 'fire' ? 'glow' : 'window', this.p(x, y, z0 + h - 1), h);
    }
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

  /**
   * A banner on a pole standing at a screen point, red unless given another colour. Only red ones record a `banner` spot:
   * the animated town's flapping banner is red.
   */
  banner([sx, sy]: Pt, h: number, colour: Colour = 'banner') {
    if (colour === 'banner') this.spot('banner', [sx + 1, sy - h], h);
    this.line([sx, sy], [sx, sy - h], 'outline');
    for (let y = 0; y < 3; y++) for (let x = 1; x <= 3; x++) this.set(sx + x, sy - h + y, y === 2 && x === 3 ? 'clear' : colour);
  }
}
