// Stable: a timber stable under a brown roof beside a fenced paddock. Band 1 (levels 1-3) is the stable, two horses
// and a haystack; each band after it is bigger and stronger: a longer stable, a trough and more horses, then a second
// stable and a training ring, then stone stables round large paddocks with banners.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { Axis, IsoCanvas, Roofing } from '../iso.ts';

const SIZE = 64;

/** A fenced paddock (its two front sides, so the horses inside show). */
function paddock(c: IsoCanvas, x0: number, y0: number, x1: number, y1: number) {
  c.fence(x0, y1, x1, y1);
  c.fence(x1, y0, x1, y1);
  c.fence(x0, y0, x0, y1);
}

/** A water trough. */
function trough(c: IsoCanvas, x: number, y: number) {
  c.box(x, y, 0, 3, 1, 1, { top: Colour.WATER, left: Colour.PLANK_L, right: Colour.PLANK_R });
}

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'stable-1');
  c.grass(0, 0, 20, 20);
  c.timber(3, 3, 0, 10, 5, 4);
  c.windows([5, 7, 9, 11], 8, 0, 3, Colour.LOG_DARK);
  c.roof(3, 3, 10, 5, 4, 3, Axis.X, { roofing: Roofing.BARN });
  c.ground(9, 11, 9, 7, Colour.SAND);
  c.horse(12, 14);
  c.horse(15, 16);
  paddock(c, 9, 11, 18, 18);
  c.haystack(4, 14);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'stable-2');
  c.grass(0, 0, 24, 24);
  c.timber(2, 2, 0, 14, 6, 5);
  c.windows([4, 6, 8, 10, 12, 14], 8, 0, 3, Colour.LOG_DARK);
  c.roof(2, 2, 14, 6, 5, 3, Axis.X, { roofing: Roofing.BARN });
  c.ground(9, 11, 13, 11, Colour.SAND);
  trough(c, 11, 12);
  c.horse(12, 16);
  c.horse(16, 15);
  c.horse(14, 19);
  c.horse(19, 19);
  paddock(c, 9, 11, 22, 22);
  c.haystack(3, 13);
  c.haystack(5, 16);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'stable-3');
  c.grass(0, 0, 27, 27);
  c.timber(2, 2, 0, 15, 6, 5);
  c.windows([4, 6, 8, 10, 12, 14, 16], 8, 0, 3, Colour.LOG_DARK);
  c.roof(2, 2, 15, 6, 5, 3, Axis.X, { roofing: Roofing.BARN });
  c.timber(19, 2, 0, 6, 10, 5);
  c.windowsSe(25, [4, 6, 8, 10], 0, 3, Colour.LOG_DARK);
  c.roof(19, 2, 6, 10, 5, 3, Axis.Y, { roofing: Roofing.BARN });
  // a training ring
  c.ground(2, 12, 10, 10, Colour.SAND);
  c.horse(6, 16);
  paddock(c, 2, 12, 12, 22);
  c.ground(14, 14, 11, 10, Colour.SAND);
  trough(c, 15, 15);
  c.horse(17, 19);
  c.horse(21, 18);
  c.horse(20, 22);
  paddock(c, 14, 14, 25, 24);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'stable-4');
  c.grass(0, 0, 30, 30);
  c.stone(2, 2, 0, 18, 7, 6);
  c.windows([4, 6, 8, 10, 12, 14, 16, 18], 9, 0, 3, Colour.LOG_DARK);
  c.windows([5, 9, 13, 17], 9, 4, 1);
  c.roof(2, 2, 18, 7, 6, 4, Axis.X, { roofing: Roofing.BARN, gable: Colour.STONE_R });
  c.stone(22, 2, 0, 6, 13, 6);
  c.windowsSe(28, [4, 6, 8, 10, 12], 0, 3, Colour.LOG_DARK);
  c.roof(22, 2, 6, 13, 6, 3, Axis.Y, { roofing: Roofing.BARN, gable: Colour.STONE_L });
  c.banner(c.p(2, 9, 6), 5);
  c.banner(c.p(28, 15, 6), 5);
  c.ground(2, 12, 11, 15, Colour.SAND);
  c.horse(5, 15);
  c.horse(8, 19);
  c.horse(5, 23);
  paddock(c, 2, 12, 13, 27);
  c.ground(15, 17, 13, 11, Colour.SAND);
  trough(c, 16, 18);
  c.horse(19, 21);
  c.horse(23, 20);
  c.horse(21, 25);
  c.horse(25, 24);
  paddock(c, 15, 17, 28, 28);
  c.anchor();
  c.outline();
  return c;
}

/** The stable's sprite for each art band (1-4). */
export const stable: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
