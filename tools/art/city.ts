// The isometric city view's ground and walls (client/web/src/lib/game-art.ts, CITY_GROUNDS and CITY_WALL_PIECES):
// 64×64 sprites anchored like the buildings (the middle of a 64×32 map tile at (32, 46)), so they butt together in
// the view with buildings standing on them.
// - Ground: whole tiles of grass. Never outlined: neighbouring tiles must join without a seam. Slots stand spaced out over the ground, so an empty plot (staked out at its corners) and a
//   locked field (a rough, muddy patch) are markers laid over the grass: the plot pale, the locked field dark, transparent round their patch.
// - Walls, per level band: a stretch of wall along each edge of a tile (`wall-x` where the row is fixed, `wall-y` where
//   the column is), each centred on the tile and a unit longer at both ends so stretches overlap without a gap; a
//   corner `tower`; and the `gate`, a gatehouse at the front corner opening into the town. Band 1 is a wooden
//   palisade, band 2 a low stone wall, band 3 a high one with merlons, band 4 a fortress with banners.

import { IsoCanvas } from './iso.ts';
import type { CityWallPiece, WallBand } from '../../client/web/src/lib/game-art.ts';

const SIZE = 64;
const PLOT = 32;

/** Grass with tufts and the odd flower, seeded so every run draws the same tile. */
function grass(seed = 'city-grass'): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, seed);
  c.grass(0, 0, PLOT, PLOT);
  for (let i = 0; i < 6; i++) c.tuft(c.between(4, 28), c.between(4, 28), 2);
  for (let i = 0; i < 2; i++) c.flower(c.between(6, 26), c.between(6, 26), i ? 'flowerB' : 'flower');
  return c;
}

/** An empty plot, laid over the grass: a patch of pale, trodden grass with a dark edge, staked out at its corners. */
function plot(): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, 'city-plot');
  c.ground(5, 5, PLOT - 10, PLOT - 10, 'grassDark');
  c.poly([c.p(6, 6), c.p(PLOT - 6, 6), c.p(PLOT - 6, PLOT - 6), c.p(6, PLOT - 6)], (x, y) => ((x * 3 + y * 7) % 11 === 0 ? 'dirt' : 'moss'));
  for (const [x, y] of [
    [5, 5],
    [PLOT - 5, 5],
    [5, PLOT - 5],
    [PLOT - 5, PLOT - 5],
  ]) {
    const [sx, sy] = c.p(x, y);
    c.line([sx, sy], [sx, sy - 3], 'wood');
    c.set(sx, sy - 4, 'logEnd');
  }
  return c;
}

/** A locked field, laid over the grass: a patch of rough, muddy ground with a few stones. */
function locked(): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, 'city-locked');
  c.poly([c.p(3, 3), c.p(PLOT - 3, 3), c.p(PLOT - 3, PLOT - 3), c.p(3, PLOT - 3)], (x, y) => ((x * 5 + y * 11) % 7 === 0 ? 'mud' : 'grassDark'));
  for (let i = 0; i < 3; i++) {
    const [sx, sy] = c.p(c.between(8, 24), c.between(8, 24));
    c.set(sx, sy, 'stoneL');
    c.set(sx + 1, sy, 'stoneR');
  }
  return c;
}

/** The ground tiles drawn in code, by name. */
export const CITY_GROUND_DRAWINGS: Record<string, () => IsoCanvas> = { grass: () => grass(), plot, locked };

/** Each band's wall: its height and thickness in world units. */
const WALL = { 1: { h: 9, t: 3 }, 2: { h: 10, t: 4 }, 3: { h: 14, t: 4 }, 4: { h: 17, t: 5 } } as const;

const STONE = { top: 'stoneTop', left: 'stoneL', right: 'stoneR' } as const;

/** Merlons along the top of a stretch from (x0, y0), `len` long along `along`, `t` thick, at height `z`. */
function merlons(c: IsoCanvas, along: 'x' | 'y', x0: number, y0: number, len: number, t: number, z: number) {
  for (let i = 0; i < len - 1; i += 4) {
    if (along === 'x') c.box(x0 + i, y0, z, 2, t, 2, STONE);
    else c.box(x0, y0 + i, z, t, 2, 2, STONE);
  }
}

/** A stretch of wall along `along` through the middle of the tile, in the band's style. */
function wallStretch(along: 'x' | 'y', band: WallBand): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, `city-wall-${along}-${band}`);
  const { h, t } = WALL[band];
  const len = PLOT + 2;
  const [x0, y0, w, d] = along === 'x' ? [-1, PLOT / 2 - t / 2, len, t] : [PLOT / 2 - t / 2, -1, t, len];
  if (band === 1) {
    c.timber(x0, y0, 0, w, d, h);
    // the palisade's pointed log tops
    for (let i = 0; i <= len; i += 2) c.set(...(along === 'x' ? c.p(x0 + i, y0 + d, h + 1) : c.p(x0 + w, y0 + i, h + 1)), 'plankL');
  } else {
    c.stone(x0, y0, 0, w, d, h);
    // courses of stone on the face towards the viewer
    for (let z = 3; z < h; z += 3)
      if (along === 'x') c.line(c.p(x0, y0 + d, z), c.p(x0 + w, y0 + d, z), 'stoneR');
      else c.line(c.p(x0 + w, y0, z), c.p(x0 + w, y0 + d, z), 'shingleL');
    if (band >= 3) merlons(c, along, x0, y0, len, t, h);
  }
  // a dark foot where the wall meets the ground
  if (along === 'x') c.line(c.p(x0, y0 + d), c.p(x0 + w, y0 + d), 'outline');
  else c.line(c.p(x0 + w, y0), c.p(x0 + w, y0 + d), 'outline');
  return c;
}

/** A square tower on the middle of the tile, taller than the wall, crowned to suit the band. */
function tower(band: WallBand): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, `city-tower-${band}`);
  const size = [8, 9, 10, 11][band - 1];
  const h = WALL[band].h + [8, 7, 9, 11][band - 1];
  const o = PLOT / 2 - size / 2;
  if (band === 1) {
    c.timber(o, o, 0, size, size, h);
    c.hipRoof(o, o, size, size, h, 5, 'x', 'thatch');
  } else {
    c.stone(o, o, 0, size, size, h);
    for (let z = 3; z < h; z += 3) {
      c.line(c.p(o, o + size, z), c.p(o + size, o + size, z), 'stoneR');
      c.line(c.p(o + size, o, z), c.p(o + size, o + size, z), 'shingleL');
    }
    c.windows([o + size / 2], o + size, h - 6, 3);
    if (band >= 3) {
      merlons(c, 'x', o, o, size + 1, 2, h);
      merlons(c, 'y', o + size - 2, o, size + 1, 2, h);
    } else c.hipRoof(o, o, size, size, h, 5, 'x', 'slate');
    if (band === 4) c.banner(c.p(o + size / 2, o + size / 2, h + 2), 7);
  }
  c.outline();
  return c;
}

/** The gatehouse at the front corner: a block across the corner with its arch opening into the town. */
function gate(band: WallBand): IsoCanvas {
  const c = new IsoCanvas(SIZE, PLOT, `city-gate-${band}`);
  const size = [10, 12, 13, 14][band - 1];
  const h = WALL[band].h + [5, 5, 7, 9][band - 1];
  const o = PLOT / 2 - size / 2;
  if (band === 1) c.timber(o, o, 0, size, size, h);
  else c.stone(o, o, 0, size, size, h);
  // the arch, on both faces either side of the front corner
  const [aw, ah] = [Math.round(size / 2.5), Math.round(h * 0.55)];
  c.poly([c.p(o + size - aw, o + size, 0), c.p(o + size, o + size, 0), c.p(o + size, o + size, ah), c.p(o + size - aw, o + size, ah)], 'hoodDark');
  c.poly([c.p(o + size, o + size - aw, 0), c.p(o + size, o + size, 0), c.p(o + size, o + size, ah), c.p(o + size, o + size - aw, ah)], 'outline');
  if (band === 1) {
    for (let i = 0; i <= size; i += 2) {
      c.set(...c.p(o + i, o + size, h + 1), 'plankL');
      c.set(...c.p(o + size, o + i, h + 1), 'plankR');
    }
  } else if (band === 2) c.hipRoof(o, o, size, size, h, 5, 'x', 'slate');
  else {
    merlons(c, 'x', o, o + size - 2, size + 1, 2, h);
    merlons(c, 'y', o + size - 2, o, size + 1, 2, h);
    if (band === 4) {
      c.banner(c.p(o + 2, o + 2, h + 2), 8);
      c.banner(c.p(o + size - 3, o + size - 3, h), 7);
    }
  }
  c.outline();
  return c;
}

/** The wall pieces drawn in code, by piece: each takes the band. */
export const CITY_WALL_DRAWINGS: Record<CityWallPiece, (band: WallBand) => IsoCanvas> = {
  'wall-x': (band) => wallStretch('x', band),
  'wall-y': (band) => wallStretch('y', band),
  tower,
  gate,
};
