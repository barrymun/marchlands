// Rally Spot: a drill yard with a teal-roofed guardhouse and a flag. Band 1 (levels 1-3) is the yard, the guardhouse
// and a weapon rack; each band after it is bigger and stronger: tents and training dummies, then a muster hall and
// rows of tents, then a paved parade ground with stands and banners.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'rally-spot-1');
  c.grass(0, 0, 20, 20);
  c.ground(2, 7, 14, 11, 'sand');
  c.wall(13, 2, 0, 5, 5, 4);
  c.windows([15, 16], 7, 0, 3, 'logDark');
  c.hipRoof(13, 2, 5, 5, 4, 3, 'x', 'teal');
  c.banner(c.p(5, 9, 0), 10);
  c.rack(9, 14);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'rally-spot-2');
  c.grass(0, 0, 24, 24);
  c.ground(2, 8, 18, 14, 'sand');
  c.tent(2, 2, 4, 4, 4);
  c.tent(7, 2, 4, 4, 4);
  c.wall(15, 2, 0, 6, 6, 5);
  c.windows([17, 18], 8, 0, 3, 'logDark');
  c.hipRoof(15, 2, 6, 6, 5, 3, 'x', 'teal');
  c.banner(c.p(6, 11, 0), 11);
  c.rack(11, 16);
  c.rack(15, 18);
  c.dummy(5, 17);
  c.dummy(8, 19);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'rally-spot-3');
  c.grass(0, 0, 27, 27);
  c.ground(2, 9, 21, 16, 'sand');
  c.wall(9, 2, 0, 14, 6, 6);
  c.windows([15, 16], 8, 0, 4, 'logDark');
  c.windows([11, 13, 18, 20], 8, 3, 1);
  c.roof(9, 2, 14, 6, 6, 4, 'x', { roofing: 'teal' });
  c.tent(2, 2, 4, 4, 4);
  c.tent(2, 8, 4, 4, 4);
  c.tent(2, 14, 4, 4, 4);
  c.banner(c.p(10, 12, 0), 12);
  c.banner(c.p(20, 12, 0), 12);
  c.rack(14, 17);
  c.rack(18, 19);
  c.dummy(9, 20);
  c.dummy(12, 22);
  c.dummy(22, 23);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'rally-spot-4');
  c.grass(0, 0, 30, 30);
  c.ground(3, 9, 24, 19, 'paving');
  // the stands along the back
  c.stone(3, 2, 0, 22, 2, 3);
  c.stone(3, 4, 0, 22, 2, 2);
  c.stone(3, 6, 0, 22, 2, 1);
  c.wall(25, 2, 0, 4, 8, 7);
  c.hipRoof(25, 2, 4, 8, 7, 3, 'y', 'teal');
  for (const x of [5, 11, 17, 23]) c.banner(c.p(x, 3, 3), 8);
  c.tent(0, 11, 3, 4, 4);
  c.tent(0, 17, 3, 4, 4);
  c.tent(0, 23, 3, 4, 4);
  c.banner(c.p(15, 18, 0), 14);
  c.rack(9, 14);
  c.rack(21, 14);
  c.dummy(8, 23);
  c.dummy(12, 25);
  c.dummy(19, 25);
  c.dummy(23, 23);
  c.anchor();
  c.outline();
  return c;
}

/** The rally spot's sprite for each art band (1-4). */
export const rallySpot: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
