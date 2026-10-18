// Cottage: a humble plastered house with a thatched hip roof on a sandy plot. Each band is bigger and stronger: a
// longer house with a shed and a fenced vegetable garden, then a two-storey house beside a second cottage and a well,
// then a walled hamlet. The roofs stay golden thatch at every band, so a cottage never looks like the red-roofed
// Town Hall.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20);
  c.ground(0, 0, 20, 20, 'sand');
  c.grass(0, 13, 6, 7);
  c.grass(14, 0, 6, 6);
  c.ground(9, 12, 3, 8, 'paving');
  c.wall(5, 6, 0, 11, 6, 6);
  c.windows([7, 13, 15], 12, 2, 2);
  c.windows([10, 11], 12, 0, 4);
  c.windowsSe(16, [9], 2, 2);
  c.hipRoof(5, 6, 11, 6, 6, 3, 'x');
  c.centre();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24);
  c.ground(0, 0, 24, 24, 'sand');
  c.grass(0, 0, 8, 7);
  c.ground(10, 11, 3, 13, 'paving');
  c.garden(15, 15, 7, 6);
  c.wall(3, 5, 0, 13, 6, 6);
  c.windows([5, 8, 14], 11, 2, 2);
  c.windows([11, 12], 11, 0, 4);
  c.hipRoof(3, 5, 13, 6, 6, 3, 'x');
  // a shed at the east end
  c.wall(17, 6, 0, 4, 4, 3);
  c.hipRoof(17, 6, 4, 4, 3, 2, 'x');
  c.fence(15, 21, 22, 21);
  c.fence(22, 14, 22, 21);
  c.centre();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27);
  c.ground(0, 0, 27, 27, 'sand');
  c.grass(0, 0, 9, 3);
  c.grass(0, 20, 6, 7);
  c.ground(13, 10, 3, 17, 'paving');
  // a second cottage, along the back left
  c.wall(2, 4, 0, 5, 10, 4);
  c.windowsSe(7, [6, 10], 1, 2);
  c.hipRoof(2, 4, 5, 10, 4, 3, 'y');
  // the house, two storeys, with a chimney
  c.wall(10, 3, 0, 13, 7, 7);
  c.windows([12, 18, 21], 10, 1, 2);
  c.windows([12, 15, 18, 21], 10, 4, 2);
  c.windows([14, 15], 10, 0, 3);
  c.hipRoof(10, 3, 13, 7, 7, 4, 'x');
  c.stone(19, 5, 9, 2, 2, 3);
  c.well(6, 17);
  c.garden(17, 16, 8, 8);
  c.fence(17, 24, 25, 24);
  c.fence(25, 15, 25, 24);
  c.centre();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30);
  c.ground(0, 0, 30, 30, 'sand');
  c.grass(1, 1, 9, 2);
  c.ground(14, 11, 3, 19, 'paving');
  // the low stone wall's back sides
  c.stone(0, 0, 0, 30, 1, 2);
  c.stone(0, 0, 0, 1, 30, 2);
  c.wall(2, 3, 0, 6, 11, 5);
  c.windowsSe(8, [5, 8, 11], 1, 2);
  c.hipRoof(2, 3, 6, 11, 5, 3, 'y');
  // the main house, two storeys, with a chimney
  c.wall(11, 2, 0, 15, 8, 8);
  c.windows([13, 19, 22, 24], 10, 1, 2);
  c.windows([13, 16, 19, 22, 24], 10, 5, 2);
  c.windows([15, 16], 10, 0, 3);
  c.hipRoof(11, 2, 15, 8, 8, 5, 'x');
  c.stone(21, 4, 10, 2, 2, 4);
  c.well(9, 17);
  c.garden(19, 17, 8, 9);
  c.fence(19, 26, 27, 26);
  c.fence(27, 16, 27, 26);
  // a third house along the front left
  c.wall(2, 21, 0, 10, 5, 4);
  c.windows([4, 7, 10], 26, 1, 2);
  c.hipRoof(2, 21, 10, 5, 4, 3, 'x');
  c.cypress(27, 12, 6);
  // the wall's front sides, with a gate in the south-west
  c.stone(0, 29, 0, 13, 1, 2);
  c.stone(18, 29, 0, 12, 1, 2);
  c.stone(29, 0, 0, 1, 30, 2);
  c.centre();
  c.outline();
  return c;
}

/** The cottage's sprite for each art band (1-4). */
export const cottage: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
