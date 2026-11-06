// Map tile art (client/web/src/lib/game-art.ts, TILE_ART_TYPES): one sprite per valley type, player castle and
// barbarian camp, for each level band. The world map lays continuous grass and stands these on it, so each sprite is a
// feature on a transparent ground, never a full diamond: a soft patch of ground (a meadow, a sandy desert, a muddy
// swamp, a lake and its shore), never outlined so it fades into the grass, and the things standing on it (trees,
// rocks, cacti, walls and towers), drawn on a layer of their own and outlined. Every sprite is 64×64 with the middle of
// its 64×32 tile at (32, 46), like the city view's pieces, and grows richer with the band: band 1 (levels 1-3) is
// sparse, band 4 (level 10) the full scene. Natural details are random but seeded per sprite.

import { SpotKind, TileType } from '@marchlands/core';
import { Axis, IsoCanvas, Rock, Roofing } from './iso.ts';
import type { Colour } from './pixel.ts';

const SIZE = 64;
const PLOT = 32;
const MID = PLOT / 2;

type Drawing = Record<number, () => IsoCanvas>;

/** The half of a ring of walls: the back goes before what stands inside, the front after. */
const RingPart = { BACK: 'back', FRONT: 'front' } as const;
type RingPart = (typeof RingPart)[keyof typeof RingPart];

/** What a ring of walls is built of. */
const WallKind = { STONE: 'stone', TIMBER: 'timber' } as const;
type WallKind = (typeof WallKind)[keyof typeof WallKind];

/**
 * A tile sprite: `ground` paints the patch (left as it is), `objects` the things standing on it (outlined), laid over
 * the patch.
 */
function layered(name: string, band: number, ground: (c: IsoCanvas) => void, objects: (c: IsoCanvas) => void, size = SIZE): IsoCanvas {
  const c = new IsoCanvas(size, PLOT, `${name}-${band}`);
  ground(c);
  const o = new IsoCanvas(size, PLOT, `${name}-${band}-objects`);
  objects(o);
  o.outline();
  for (let i = 0; i < c.px.length; i++) if (o.px[i]) c.px[i] = o.px[i];
  c.spots.push(...o.spots);
  // a bigger sprite keeps its tile's middle three quarters of the way down, as spriteBox places it (128: at (64, 94))
  if (size !== SIZE) c.anchor(size / SIZE);
  return c;
}

/** `n` random spots inside the diamond, `margin` in from its edges, sorted back to front. */
function scatter(c: IsoCanvas, n: number, margin: number): [number, number][] {
  const spots: [number, number][] = [];
  for (let i = 0; i < n; i++) spots.push([margin + c.rand() * (PLOT - 2 * margin), margin + c.rand() * (PLOT - 2 * margin)]);
  return spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
}

/** Spots on a jittered grid every `step` units within `radius` of the middle, for a dense cover (a forest). */
function grid(c: IsoCanvas, step: number, radius: number): [number, number][] {
  const spots: [number, number][] = [];
  for (let y = MID - radius; y <= MID + radius; y += step)
    for (let x = MID - radius; x <= MID + radius; x += step)
      if (Math.hypot(x - MID, y - MID) <= radius) spots.push([x + (c.rand() - 0.5) * step * 0.7, y + (c.rand() - 0.5) * step * 0.7]);
  return spots.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
}

/** One drawing per band, from `draw(band)`. */
const bands = (draw: (band: number) => IsoCanvas): Drawing => Object.fromEntries([1, 2, 3, 4].map((band) => [band, () => draw(band)]));

const forest = bands((band) =>
  layered(
    'forest',
    band,
    (c) => c.blob(MID, MID, [7, 10, 12, 13.5][band - 1], [7, 10, 12, 13.5][band - 1], 'grassDark'),
    (c) => {
      const spots = band <= 2 ? scatter(c, [3, 7][band - 1], 9 - band * 2) : grid(c, band === 3 ? 4.6 : 3.6, band === 3 ? 10 : 12);
      for (const [x, y] of spots) c.pine(x, y, c.between(8 + band, 11 + band * 1.5));
    },
  ),
);

const grass = bands((band) =>
  layered(
    'grass',
    band,
    (c) => {
      const r = [7, 10, 12, 13.5][band - 1];
      c.blob(MID, MID, r, r, (x, y) => ((x * 3 + y * 5) % 7 === 0 ? 'moss' : 'greenL'));
    },
    (c) => {
      for (const [x, y] of scatter(c, [5, 10, 16, 24][band - 1], 6)) c.tuft(x, y, c.between(2 + band, 3 + band));
      for (const [x, y] of scatter(c, band * 2, 7)) c.flower(x, y, c.rand() < 0.5 ? 'flower' : 'flowerB');
    },
  ),
);

const swamp = bands((band) => {
  const mud = (x: number, y: number) => ((x * 3 + y * 7) % 5 === 0 ? 'moss' : 'mud');
  const pools = [
    [16, 16, 3.5],
    [10, 21, 2.5],
    [22, 10, 2.5],
    [21, 21, 3],
    [10, 10, 2.5],
  ].slice(0, [1, 2, 4, 5][band - 1]);
  return layered(
    'swamp',
    band,
    (c) => {
      const r = [9, 11, 12.5, 13.5][band - 1];
      c.blob(MID, MID, r, r, mud);
      for (const [x, y, r] of pools) {
        c.blob(x, y, r + 1.5, r + 1.5, 'moss');
        c.blob(x, y, r, r, (sx, sy) => c.water(sx, sy));
        c.spot(SpotKind.WATER, c.p(x, y), r);
      }
    },
    (c) => {
      for (const [x, y] of scatter(c, [3, 6, 9, 13][band - 1], 6)) c.reeds(x, y);
    },
  );
});

const lake = bands((band) => {
  const r = [4.5, 7, 9, 11][band - 1];
  return layered(
    'lake',
    band,
    (c) => {
      c.blob(MID, MID, r + 2, r + 2, 'sandLight');
      c.blob(MID, MID, r, r, (x, y) => c.water(x, y));
      c.spot(SpotKind.WATER, c.p(MID, MID), r);
      if (band >= 3) c.blob(MID - 1, MID - 1, r * 0.45, r * 0.45, 'waterDeep');
    },
    (c) => {
      const palms = [
        [5, 14],
        [16, 5],
        [27, 17],
        [14, 27],
      ].slice(0, [0, 0, 2, 4][band - 1]);
      for (const [x, y] of palms) c.palm(x, y, 9);
      if (band <= 2)
        for (const [x, y] of [
          [MID - r - 1, MID + 2],
          [MID + 2, MID - r - 1],
        ])
          c.reeds(x, y);
    },
  );
});

const hill = bands((band) => {
  const size = [9, 14, 18, 22][band - 1];
  return layered(
    'hill',
    band,
    (c) => c.blob(MID, MID, size * 0.65, size * 0.65, (x, y) => ((x * 5 + y * 3) % 6 === 0 ? 'stoneL' : 'grassDark')),
    (c) => {
      // separate rock pillars, tallest towards the middle, more and taller at each band
      const from = (PLOT - size) / 2;
      const maxH = [6, 10, 14, 19][band - 1];
      const pillars: [number, number, number][] = [];
      for (let y = from; y < from + size; y += 4)
        for (let x = from; x < from + size; x += 4) {
          const middle = 1 - Math.hypot(x + 1.5 - MID, y + 1.5 - MID) / (size * 0.75);
          if (middle <= 0) continue;
          pillars.push([x + c.rand() * 1.5, y + c.rand() * 1.5, Math.max(3, Math.round(maxH * middle * (0.55 + 0.45 * c.rand())))]);
        }
      pillars.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));
      for (const [x, y, h] of pillars) c.spire(x, y, h, 3, Rock.GRANITE);
    },
  );
});

const desert = bands((band) =>
  layered(
    'desert',
    band,
    (c) => {
      // dunes: wavy darker ridges across the sand, more of them at higher bands
      const r = [9, 11, 12.5, 13.5][band - 1];
      c.blob(MID, MID, r, r, (x, y) => ((x + 2 * y + Math.round(3 * Math.sin(x / 4))) % [40, 16, 12, 10][band - 1] === 0 ? 'sandDark' : 'sand'));
    },
    (c) => {
      if (band >= 3) c.outcrop(9, 9, band === 4 ? 7 : 4, band === 4 ? 6 : 4, band === 4 ? 6 : 3, Rock.SANDSTONE);
      for (const [x, y] of scatter(c, [1, 2, 3, 5][band - 1], 9)) c.cactus(x, y, c.between(5, 7 + band));
    },
  ),
);

const flat = bands((band) =>
  layered(
    'flat',
    band,
    () => {},
    (c) => {
      for (const [x, y] of scatter(c, [1, 3, 5, 7][band - 1], 5)) c.box(x, y, 0, 1, 1, 1, { top: 'graniteHi', left: 'graniteL', right: 'graniteR' });
      for (const [x, y] of scatter(c, [0, 2, 6, 12][band - 1], 5)) c.flower(x, y, c.rand() < 0.5 ? 'flower' : 'flowerB');
      if (band === 4) {
        c.cypress(8, 22, 5);
        c.cypress(22, 8, 5);
      }
    },
  ),
);

/**
 * A square of wall from (o, o), `side` across and `h` high: the back two sides when `part` is the back, the front two
 * (with a gap for the gate in the south-west side) when it is the front. Timber is a palisade with pointed tops.
 */
function ring(c: IsoCanvas, part: RingPart, o: number, side: number, h: number, kind: WallKind, t = 1) {
  const wall = (x: number, y: number, w: number, d: number) => {
    if (kind === WallKind.STONE) c.stone(x, y, 0, w, d, h);
    else {
      c.timber(x, y, 0, w, d, h);
      for (let i = 0; i <= Math.max(w, d); i += 2) c.set(...(w > d ? c.p(x + i, y + d, h + 1) : c.p(x + w, y + i, h + 1)), 'plankL');
    }
  };
  const gate = Math.round(side / 2 - 2);
  if (part === RingPart.BACK) {
    wall(o, o, side, t);
    wall(o, o, t, side);
  } else {
    wall(o, o + side - t, gate, t);
    wall(o + gate + 4, o + side - t, side - gate - 4, t);
    wall(o + side - t, o, t, side);
  }
}

/** A square stone tower at (x, y), `w` across and `h` high, with merlons and, if asked, a banner. */
function tower(c: IsoCanvas, x: number, y: number, w: number, h: number, banner = false) {
  c.stone(x, y, 0, w, w, h);
  c.crenels(x, y, h, w, w);
  if (banner) c.banner(c.p(x + w / 2, y + w / 2, h + 1), 5);
}

/**
 * A player's castle: band 1 a timber hall in a palisade; band 2 a stone keep behind low stone walls; band 3 higher
 * walls with corner towers; band 4 a fortress, its towers flying banners and the keep under a blue roof.
 */
const castle = bands((band) => {
  const o = [7, 6, 5, 4][band - 1];
  const side = PLOT - 2 * o;
  const h = [3, 3, 5, 6][band - 1];
  const kind = band === 1 ? WallKind.TIMBER : WallKind.STONE;
  return layered(
    'castle',
    band,
    (c) => c.blob(MID, MID, side * 0.62, side * 0.62, (x, y) => ((x * 3 + y * 5) % 9 === 0 ? 'paveB' : 'paveA')),
    (c) => {
      ring(c, RingPart.BACK, o, side, h, kind);
      if (band >= 3) tower(c, o - 1, o - 1, 4, h + 5, band === 4);
      // the keep or hall
      const k = [7, 8, 9, 10][band - 1];
      const ko = MID - k / 2;
      if (band === 1) {
        c.timber(ko, ko, 0, k, k - 2, 4);
        c.roof(ko, ko, k, k - 2, 4, 3, Axis.X, { roofing: Roofing.THATCH });
      } else {
        c.stone(ko, ko, 0, k, k, [8, 10, 13][band - 2]);
        c.windows([ko + k / 2], ko + k, 3, 2);
        c.windowsSe(ko + k, [ko + k / 2], 3, 2);
        if (band === 4) c.hipRoof(ko, ko, k, k, 13, 5, Axis.X, Roofing.SLATE);
        else c.crenels(ko, ko, [8, 10][band - 2], k, k);
      }
      if (band >= 3) {
        tower(c, o + side - 3, o - 1, 4, h + 5, band === 4);
        tower(c, o - 1, o + side - 3, 4, h + 5, band === 4);
      }
      ring(c, RingPart.FRONT, o, side, h, kind);
      if (band >= 3) tower(c, o + side - 3, o + side - 3, 4, h + 5);
      if (band === 4) c.banner(c.p(MID, MID, 18), 6);
    },
  );
});

/**
 * A barbarian camp: band 1 tents round a fire; band 2 a palisade round them; band 3 a watchtower and huts inside;
 * band 4 a big stockade with two towers and a longhouse.
 */
const npc = bands((band) => {
  const o = [8, 7, 6, 5][band - 1];
  const side = PLOT - 2 * o;
  const h = [0, 3, 4, 5][band - 1];
  return layered(
    'npc',
    band,
    (c) => c.blob(MID, MID, side * 0.6, side * 0.6, (x, y) => ((x * 5 + y * 3) % 7 === 0 ? 'mud' : 'dirt')),
    (c) => {
      if (band >= 2) ring(c, RingPart.BACK, o, side, h, WallKind.TIMBER);
      const watch = (x: number, y: number) => {
        c.timber(x, y, 0, 3, 3, 10);
        c.hipRoof(x, y, 3, 3, 10, 3, Axis.X, Roofing.THATCH);
      };
      if (band >= 3) watch(o + 1, o + 1);
      if (band === 4) {
        c.timber(MID - 1, o + 2, 0, 9, 5, 4);
        c.roof(MID - 1, o + 2, 9, 5, 4, 3, Axis.X, { roofing: Roofing.BARN });
        watch(o + side - 4, o + 1);
      }
      if (band >= 3) {
        c.timber(o + 2, MID + 1, 0, 4, 4, 3);
        c.hipRoof(o + 2, MID + 1, 4, 4, 3, 3, Axis.X, Roofing.THATCH);
      }
      const tents = [
        [MID - 5, MID - 3],
        [MID + 2, MID - 1],
        [MID - 2, MID + 3],
        [MID + 4, MID + 4],
      ].slice(0, [3, 3, 2, 3][band - 1]);
      for (const [x, y] of tents) c.tent(x, y, 4, 3, 3);
      c.fire(c.p(MID, MID + 1), 4);
      if (band >= 2) ring(c, RingPart.FRONT, o, side, h, WallKind.TIMBER);
    },
  );
});

/** What moss turns each of the stone faces into. */
const MOSS_ON: Partial<Record<Colour, Colour>> = { stoneL: 'grassDark', stoneR: 'greenD' };

/** Moss and ivy over a share of a sprite's stone faces, the older the city the more. */
function moss(c: IsoCanvas, share: number) {
  for (let y = 0; y < c.size; y++)
    for (let x = 0; x < c.size; x++) {
      const col = c.get(x, y);
      const grown = MOSS_ON[col];
      if (!grown) continue;
      // in streaks three pixels tall, so it reads as growth rather than noise
      const r = Math.abs(Math.sin(x * 12.9898 + Math.floor(y / 3) * 78.233) * 43758.5453) % 1;
      if (r < share) c.set(x, y, grown);
    }
}

/** A tower: a stone block, crenellated, or under a pointed roof `roof` high, with a flag on top. */
function spireTower(c: IsoCanvas, x: number, y: number, w: number, h: number, roof: number, roofing: Roofing | null, flag: Colour) {
  c.stone(x, y, 0, w, w, h);
  c.windows([x + w / 2], y + w, h - 4, 2, 'outline');
  // a tall tower gets a lower window too
  if (h >= 24) c.windows([x + w / 2], y + w, Math.round(h / 2), 2, 'outline');
  if (roofing) {
    c.hipRoof(x, y, w, w, h, roof, Axis.X, roofing);
    c.banner(c.p(x + w / 2, y + w / 2, h + roof), 4, flag);
  } else {
    c.crenels(x, y, h, w, w);
    c.banner(c.p(x + w / 2, y + w / 2, h + 1), 5, flag);
  }
}

/**
 * Historic cities, one sprite per level (docs/features/historical-cities.md, On the map), in the style of the
 * original's but drawn here: level 12 a square stone fortress with corner towers and red flags; 14 a taller keep with
 * green-roofed towers and green flags; 16 a great keep with slate spires and blue flags; 18 a grand castle of pale
 * spires round a gold dome under gold flags. Each fills more of the tile and stands taller than the last, all far taller
 * than any castle (Atlantis, the level 18 at (0, 0), tallest of all, its spire 83 pixels high), and moss grows up its
 * walls. Each stays on its own tile, growing only upwards, so they're 128×128, their tile's middle at (64, 94).
 */
const HISTORIC_STYLE = {
  12: { o: 3, wall: 10, tower: 5, towerH: 26, roof: 0, roofing: null, keep: 9, keepH: 32, keepRoof: 0, flag: 'banner', moss: 0.025 },
  14: { o: 2, wall: 11, tower: 5, towerH: 32, roof: 7, roofing: Roofing.GREEN, keep: 10, keepH: 42, keepRoof: 8, flag: 'greenL', moss: 0.05 },
  16: { o: 1, wall: 12, tower: 6, towerH: 38, roof: 9, roofing: Roofing.SLATE, keep: 12, keepH: 52, keepRoof: 11, flag: 'blue', moss: 0.08 },
  18: { o: 1, wall: 13, tower: 6, towerH: 44, roof: 10, roofing: Roofing.CANVAS, keep: 13, keepH: 62, keepRoof: 0, flag: 'gold', moss: 0.11 },
} as const;

/** Historic cities stand taller than every other map sprite, so theirs are 128×128 (drawn with `spriteBox(128)`). */
const HISTORIC_SIZE = 128;

const HISTORIC_LEVELS = [12, 14, 16, 18] as const;

function historic(level: (typeof HISTORIC_LEVELS)[number]): IsoCanvas {
  const st = HISTORIC_STYLE[level];
  const side = PLOT - 2 * st.o;
  const roofing: Roofing | null = st.roofing;
  const flag: Colour = st.flag;
  const o = st.o;
  const t = 2;
  // the front walls stand lower than the back ones, so the keep shows over them
  const front = st.wall - 2;
  const c = layered(
    'historic',
    level,
    (g) => g.blob(MID, MID, side * 0.66, side * 0.66, (x, y) => ((x * 3 + y * 5) % 9 === 0 ? 'paveB' : 'paveA')),
    (g) => {
      const tw = st.tower;
      const far = o + side - tw + 1;
      // the back walls
      g.stone(o, o, 0, side, t, st.wall);
      g.stone(o, o, 0, t, side, st.wall);
      g.crenels(o, o, st.wall, side, t);
      spireTower(g, o - 1, o - 1, tw, st.towerH, st.roof, roofing, flag);
      // the keep
      const k = st.keep;
      const ko = MID - k / 2 + 1;
      g.stone(ko, ko, 0, k, k, st.keepH);
      // a row of windows every 12 pixels down the keep, above the walls
      for (let z = st.keepH - 6; z > st.wall + 2; z -= 12) {
        g.windows([ko + k / 3, ko + (2 * k) / 3], ko + k, z, 3, 'outline');
        g.windowsSe(ko + k, [ko + k / 3, ko + (2 * k) / 3], z, 3, 'outline');
      }
      if (level === 18) {
        // a gold dome over the keep, a pale spire behind it
        g.crenels(ko, ko, st.keepH, k, k);
        spireTower(g, ko - 1, ko - 1, 3, st.keepH + 9, 12, Roofing.CANVAS, flag);
        g.dome(ko + 1, ko + 1, st.keepH, k - 2, Roofing.GOLD);
      } else if (st.keepRoof) {
        g.hipRoof(ko, ko, k, k, st.keepH, st.keepRoof, Axis.X, roofing ?? Roofing.SLATE);
        g.banner(g.p(ko + k / 2, ko + k / 2, st.keepH + st.keepRoof), 6, flag);
      } else {
        g.crenels(ko, ko, st.keepH, k, k);
        g.banner(g.p(ko + k / 2, ko + k / 2, st.keepH + 1), 6, flag);
      }
      spireTower(g, far, o - 1, tw, st.towerH, st.roof, roofing, flag);
      spireTower(g, o - 1, far, tw, st.towerH, st.roof, roofing, flag);
      // the front walls, the gate in the south-west one
      g.stone(o, o + side - t, 0, side, t, front);
      g.stone(o + side - t, o, 0, t, side, front);
      g.crenels(o, o + side - t, front, side, t);
      g.crenels(o + side - t, o, front, t, side);
      const gx = o + side / 2 - 3;
      const gy = o + side;
      g.poly([g.p(gx - 1, gy, 0), g.p(gx + 5, gy, 0), g.p(gx + 5, gy, front - 1), g.p(gx - 1, gy, front - 1)], 'stoneR');
      g.poly([g.p(gx, gy, 0), g.p(gx + 4, gy, 0), g.p(gx + 4, gy, front - 2), g.p(gx, gy, front - 2)], (x) => (x % 2 === 0 ? 'plankR' : 'plankL'));
      spireTower(g, far, far, tw, st.towerH, st.roof, roofing, flag);
    },
    HISTORIC_SIZE,
  );
  moss(c, st.moss);
  return c;
}

/** Historic city drawings by level. */
export const HISTORIC_DRAWINGS = Object.fromEntries(HISTORIC_LEVELS.map((level) => [level, () => historic(level)])) as Record<
  (typeof HISTORIC_LEVELS)[number],
  () => IsoCanvas
>;

/** Map tile drawings by tile type: the valleys, players' castles and barbarian camps. */
export const TILE_DRAWINGS: Record<number, Drawing> = {
  [TileType.FOREST]: forest,
  [TileType.GRASS]: grass,
  [TileType.SWAMP]: swamp,
  [TileType.LAKE]: lake,
  [TileType.HILL]: hill,
  [TileType.DESERT]: desert,
  [TileType.FLAT]: flat,
  [TileType.CASTLE]: castle,
  [TileType.NPC]: npc,
};
