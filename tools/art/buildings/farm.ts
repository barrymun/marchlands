// Farm: a barn under a brown-red roof on green pasture (a different red from the Town Hall's tiles). Band 1 (levels
// 1-3) is the barn, a fenced field and a few sheep; each band after it is bigger and stronger: a larger barn with a
// shed, two fields and haystacks, then a thatched farmhouse, a sheep pen and wider fields, then a stone windmill
// over an estate of wheat.

import { Axis, CropKind, IsoCanvas, Roofing } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20);
  c.grass(0, 0, 20, 20);
  c.path(11, 8, 2, 12);
  c.wall(8, 2, 0, 9, 6, 4);
  c.windows([11, 12], 8, 0, 3);
  c.windowsSe(17, [5], 2, 1);
  c.roof(8, 2, 9, 6, 4, 3, Axis.X, { roofing: Roofing.BARN });
  c.crops(13, 11, 6, 6, CropKind.GREEN);
  c.fence(13, 17, 19, 17);
  c.fence(19, 11, 19, 17);
  c.sheep(4, 9);
  c.sheep(5, 12);
  c.sheep(3, 14);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24);
  c.grass(0, 0, 24, 24);
  c.path(10, 9, 2, 15);
  c.wall(9, 2, 0, 11, 7, 5);
  c.windows([13, 14], 9, 0, 4);
  c.windows([11, 17], 9, 2, 1);
  c.roof(9, 2, 11, 7, 5, 4, Axis.X, { roofing: Roofing.BARN });
  // a shed in the front corner
  c.timber(2, 18, 0, 4, 4, 3);
  c.hipRoof(2, 18, 4, 4, 3, 2, Axis.X, Roofing.BARN);
  c.crops(13, 11, 9, 6, CropKind.WHEAT);
  c.crops(13, 18, 9, 4, CropKind.GREEN);
  c.fence(13, 22, 22, 22);
  c.fence(22, 11, 22, 22);
  c.haystack(7, 14);
  c.haystack(9, 16);
  c.sheep(3, 9);
  c.sheep(5, 11);
  c.sheep(3, 13);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27);
  c.grass(0, 0, 27, 27);
  c.path(10, 9, 2, 18);
  // the farmhouse, thatched like a cottage
  c.wall(2, 2, 0, 6, 5, 5);
  c.windows([4, 6], 7, 2, 1);
  c.windows([5], 7, 0, 3);
  c.hipRoof(2, 2, 6, 5, 5, 3, Axis.X, Roofing.THATCH);
  c.wall(12, 2, 0, 12, 7, 6);
  c.windows([17, 18], 9, 0, 4);
  c.windows([14, 21], 9, 3, 1);
  c.roof(12, 2, 12, 7, 6, 5, Axis.X, { roofing: Roofing.BARN });
  // the sheep pen
  c.fence(2, 12, 8, 12);
  c.fence(8, 12, 8, 19);
  c.fence(2, 19, 8, 19);
  c.sheep(4, 14);
  c.sheep(6, 16);
  c.sheep(3, 17);
  c.crops(13, 11, 11, 6, CropKind.WHEAT);
  c.crops(13, 18, 11, 6, CropKind.GREEN);
  c.fence(13, 25, 25, 25);
  c.fence(25, 10, 25, 25);
  c.haystack(4, 23);
  c.haystack(7, 24);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30);
  c.grass(0, 0, 30, 30);
  c.path(10, 10, 2, 20);
  // the windmill: a stone tower, thatched cap and sails
  c.stone(3, 2, 0, 4, 4, 14);
  c.windows([5], 6, 0, 3);
  c.hipRoof(3, 2, 4, 4, 14, 3, Axis.X, Roofing.THATCH);
  c.sails(5, 6, 9, 8);
  c.wall(14, 2, 0, 13, 8, 7);
  c.windows([19, 20], 10, 0, 5);
  c.windows([16, 23, 25], 10, 3, 1);
  c.roof(14, 2, 13, 8, 7, 5, Axis.X, { roofing: Roofing.BARN });
  c.fence(2, 13, 9, 13);
  c.fence(9, 13, 9, 21);
  c.fence(2, 21, 9, 21);
  c.sheep(4, 15);
  c.sheep(6, 17);
  c.sheep(3, 18);
  c.sheep(7, 19);
  c.crops(14, 12, 13, 6, CropKind.WHEAT);
  c.crops(14, 19, 13, 5, CropKind.WHEAT);
  c.crops(14, 25, 13, 4, CropKind.GREEN);
  c.fence(14, 29, 28, 29);
  c.fence(28, 11, 28, 29);
  c.haystack(4, 25);
  c.haystack(7, 26);
  c.haystack(5, 28);
  c.anchor();
  c.outline();
  return c;
}

/** The farm's sprite for each art band (1-4). */
export const farm: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
