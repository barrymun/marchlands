// Sawmill: a woodcutters' yard in a pine wood. Band 1 (levels 1-3) is a plank shed under a shingle roof with a log
// pile and stumps; each band after it is bigger and stronger: a larger shed and lean-to with more logs, then a mill
// hall on a stream turning a water wheel, then a two-storey mill on a stone footing with a fenced timber yard.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { Axis, IsoCanvas, Roofing } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20);
  c.grass(0, 0, 20, 20);
  c.ground(5, 8, 11, 9, Colour.SAND);
  c.pine(1, 1, 11);
  c.pine(4, 1, 9);
  c.pine(1, 5, 9);
  c.pine(17, 2, 10);
  c.timber(8, 4, 0, 7, 5, 4);
  c.windows([11, 12], 9, 0, 3, Colour.LOG_DARK);
  c.hipRoof(8, 4, 7, 5, 4, 3, Axis.X, Roofing.SHINGLE);
  c.logs(6, 12, 6, 2);
  c.stump(3, 13);
  c.stump(15, 15);
  c.pine(2, 17, 9);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24);
  c.grass(0, 0, 24, 24);
  c.ground(4, 8, 16, 12, Colour.SAND);
  c.pine(1, 1, 13);
  c.pine(5, 1, 10);
  c.pine(1, 5, 11);
  c.pine(9, 0, 9);
  c.pine(21, 1, 11);
  c.timber(7, 3, 0, 10, 6, 5);
  c.windows([11, 12], 9, 0, 3, Colour.LOG_DARK);
  c.windows([9, 15], 9, 2, 1);
  c.hipRoof(7, 3, 10, 6, 5, 3, Axis.X, Roofing.SHINGLE);
  // an open lean-to on the east end
  c.timber(18, 4, 0, 3, 4, 3);
  c.hipRoof(18, 4, 3, 4, 3, 2, Axis.X, Roofing.SHINGLE);
  c.logs(5, 12, 7, 3);
  c.logs(14, 14, 6, 2);
  c.stump(2, 14);
  c.stump(20, 19);
  c.pine(2, 21, 10);
  c.pine(21, 21, 8);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27);
  c.grass(0, 0, 27, 27);
  // a stream along the east side
  c.ground(22, 0, 3, 27, Colour.WATER);
  c.ground(3, 9, 18, 14, Colour.SAND);
  c.pine(1, 1, 14);
  c.pine(5, 1, 12);
  c.pine(1, 5, 12);
  c.pine(9, 0, 10);
  c.pine(1, 9, 9);
  // the mill hall on the stream's bank, its wheel turning in the water
  c.stone(11, 3, 0, 11, 7, 1);
  c.timber(11, 3, 1, 11, 7, 6);
  c.windows([15, 16], 10, 1, 3, Colour.LOG_DARK);
  c.windows([13, 19], 10, 4, 1);
  c.hipRoof(11, 3, 11, 7, 7, 4, Axis.X, Roofing.SHINGLE);
  c.wheel(22.5, 6.5, 3, 5);
  c.logs(4, 12, 8, 3);
  c.logs(4, 17, 7, 2);
  c.logs(14, 15, 6, 2);
  c.stump(2, 22);
  c.stump(18, 22);
  c.pine(2, 25, 10);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30);
  c.grass(0, 0, 30, 30);
  c.ground(25, 0, 3, 30, Colour.WATER);
  c.ground(2, 9, 21, 18, Colour.SAND);
  c.pine(1, 1, 15);
  c.pine(5, 1, 13);
  c.pine(1, 5, 13);
  c.pine(9, 0, 11);
  c.pine(1, 9, 10);
  // the mill: two storeys on a stone footing, with a bigger wheel
  c.stone(11, 2, 0, 14, 8, 2);
  c.timber(11, 2, 2, 14, 8, 8);
  c.windows([16, 17], 10, 2, 3, Colour.LOG_DARK);
  c.windows([13, 20, 23], 10, 4, 1);
  c.windows([13, 16, 20, 23], 10, 7, 1);
  c.hipRoof(11, 2, 14, 8, 10, 5, Axis.X, Roofing.SHINGLE);
  c.wheel(25.5, 6, 4, 6);
  // the timber yard
  c.logs(3, 12, 9, 3);
  c.logs(3, 17, 9, 3);
  c.logs(14, 14, 8, 3);
  c.logs(14, 20, 7, 2);
  c.fence(2, 27, 23, 27);
  c.fence(23, 9, 23, 27);
  c.pine(2, 29, 11);
  c.pine(28, 28, 9);
  c.anchor();
  c.outline();
  return c;
}

/** The sawmill's sprite for each art band (1-4). */
export const sawmill: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
