// Map tile art (client/web/src/lib/game-art.ts, TILE_ART_TYPES): one sprite per valley type, player castle and
// barbarian camp, for each level band. The world map lays continuous grass and stands these on it, so each sprite is a
// feature on a transparent ground, never a full diamond: a soft patch of ground (a meadow, a sandy desert, a muddy
// swamp, a lake and its shore), never outlined so it fades into the grass, and the things standing on it (trees,
// rocks, cacti, walls and towers), drawn on a layer of their own and outlined. Every sprite is 64×64 with the middle of
// its 64×32 tile at (32, 46), like the city view's pieces, and grows richer with the band: band 1 (levels 1-3) is
// sparse, band 4 (level 10) the full scene. Natural details are random but seeded per sprite.

import { TileType } from '@marchlands/core';
import { IsoCanvas } from './iso.ts';

const SIZE = 64;
const PLOT = 32;
const MID = PLOT / 2;

type Drawing = Record<number, () => IsoCanvas>;

/**
 * A tile sprite: `ground` paints the patch (left as it is), `objects` the things standing on it (outlined), laid over
 * the patch.
 */
function layered(name: string, band: number, ground: (c: IsoCanvas) => void, objects: (c: IsoCanvas) => void): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, `${name}-${band}`);
  ground(c);
  const o = new IsoCanvas(SIZE, PLOT, `${name}-${band}-objects`);
  objects(o);
  o.outline();
  for (let i = 0; i < c.px.length; i++) if (o.px[i]) c.px[i] = o.px[i];
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
      for (const [x, y, h] of pillars) c.spire(x, y, h, 3, 'granite');
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
      if (band >= 3) c.outcrop(9, 9, band === 4 ? 7 : 4, band === 4 ? 6 : 4, band === 4 ? 6 : 3, 'sandstone');
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
 * A square of wall from (o, o), `side` across and `h` high: the back two sides when `part` is 'back', the front two
 * (with a gap for the gate in the south-west side) when it is 'front'. Timber is a palisade with pointed tops.
 */
function ring(c: IsoCanvas, part: 'back' | 'front', o: number, side: number, h: number, kind: 'stone' | 'timber', t = 1) {
  const wall = (x: number, y: number, w: number, d: number) => {
    if (kind === 'stone') c.stone(x, y, 0, w, d, h);
    else {
      c.timber(x, y, 0, w, d, h);
      for (let i = 0; i <= Math.max(w, d); i += 2) c.set(...(w > d ? c.p(x + i, y + d, h + 1) : c.p(x + w, y + i, h + 1)), 'plankL');
    }
  };
  const gate = Math.round(side / 2 - 2);
  if (part === 'back') {
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
  const kind = band === 1 ? 'timber' : 'stone';
  return layered(
    'castle',
    band,
    (c) => c.blob(MID, MID, side * 0.62, side * 0.62, (x, y) => ((x * 3 + y * 5) % 9 === 0 ? 'paveB' : 'paveA')),
    (c) => {
      ring(c, 'back', o, side, h, kind);
      if (band >= 3) tower(c, o - 1, o - 1, 4, h + 5, band === 4);
      // the keep or hall
      const k = [7, 8, 9, 10][band - 1];
      const ko = MID - k / 2;
      if (band === 1) {
        c.timber(ko, ko, 0, k, k - 2, 4);
        c.roof(ko, ko, k, k - 2, 4, 3, 'x', { roofing: 'thatch' });
      } else {
        c.stone(ko, ko, 0, k, k, [8, 10, 13][band - 2]);
        c.windows([ko + k / 2], ko + k, 3, 2);
        c.windowsSe(ko + k, [ko + k / 2], 3, 2);
        if (band === 4) c.hipRoof(ko, ko, k, k, 13, 5, 'x', 'slate');
        else c.crenels(ko, ko, [8, 10][band - 2], k, k);
      }
      if (band >= 3) {
        tower(c, o + side - 3, o - 1, 4, h + 5, band === 4);
        tower(c, o - 1, o + side - 3, 4, h + 5, band === 4);
      }
      ring(c, 'front', o, side, h, kind);
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
      if (band >= 2) ring(c, 'back', o, side, h, 'timber');
      const watch = (x: number, y: number) => {
        c.timber(x, y, 0, 3, 3, 10);
        c.hipRoof(x, y, 3, 3, 10, 3, 'x', 'thatch');
      };
      if (band >= 3) watch(o + 1, o + 1);
      if (band === 4) {
        c.timber(MID - 1, o + 2, 0, 9, 5, 4);
        c.roof(MID - 1, o + 2, 9, 5, 4, 3, 'x', { roofing: 'barn' });
        watch(o + side - 4, o + 1);
      }
      if (band >= 3) {
        c.timber(o + 2, MID + 1, 0, 4, 4, 3);
        c.hipRoof(o + 2, MID + 1, 4, 4, 3, 3, 'x', 'thatch');
      }
      const tents = [
        [MID - 5, MID - 3],
        [MID + 2, MID - 1],
        [MID - 2, MID + 3],
        [MID + 4, MID + 4],
      ].slice(0, [3, 3, 2, 3][band - 1]);
      for (const [x, y] of tents) c.tent(x, y, 4, 3, 3);
      c.fire(c.p(MID, MID + 1), 4);
      if (band >= 2) ring(c, 'front', o, side, h, 'timber');
    },
  );
});

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
