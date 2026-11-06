// Warehouse: plastered storehouses under brown roofs in a paved yard. Band 1 (levels 1-3) is one long storehouse
// with crates; each band after it is bigger and stronger: a second storehouse and more goods, then a stone granary,
// then stone warehouses round a walled yard with a crane.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { Axis, IsoCanvas, PAVING, Roofing } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'warehouse-1');
  c.ground(0, 0, 20, 20, Colour.SAND);
  c.ground(3, 11, 14, 8, PAVING);
  c.wall(4, 3, 0, 12, 6, 5);
  c.windows([9, 10], 9, 0, 4, Colour.LOG_DARK);
  c.windows([6, 13], 9, 3, 1);
  c.roof(4, 3, 12, 6, 5, 4, Axis.X, { roofing: Roofing.BARN });
  c.crates(12, 13, 4);
  c.crates(4, 14, 2);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'warehouse-2');
  c.ground(0, 0, 24, 24, Colour.SAND);
  c.ground(2, 11, 13, 11, PAVING);
  c.wall(2, 2, 0, 13, 6, 6);
  c.windows([8, 9], 8, 0, 4, Colour.LOG_DARK);
  c.roof(2, 2, 13, 6, 6, 4, Axis.X, { roofing: Roofing.BARN });
  c.wall(17, 4, 0, 5, 12, 5);
  c.windowsSe(22, [8, 9], 0, 4, Colour.LOG_DARK);
  c.roof(17, 4, 5, 12, 5, 3, Axis.Y, { roofing: Roofing.BARN });
  c.crates(3, 13, 6);
  c.crates(10, 17, 4);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'warehouse-3');
  c.ground(0, 0, 27, 27, Colour.SAND);
  c.ground(2, 12, 15, 13, PAVING);
  c.wall(2, 2, 0, 14, 7, 6);
  c.windows([8, 9], 9, 0, 4, Colour.LOG_DARK);
  c.roof(2, 2, 14, 7, 6, 4, Axis.X, { roofing: Roofing.BARN });
  // a stone granary
  c.stone(19, 3, 0, 6, 6, 8);
  c.windows([21, 22], 9, 0, 3, Colour.LOG_DARK);
  c.hipRoof(19, 3, 6, 6, 8, 3, Axis.X, Roofing.SLATE);
  c.wall(19, 12, 0, 6, 10, 5);
  c.windowsSe(25, [16, 17], 0, 4, Colour.LOG_DARK);
  c.roof(19, 12, 6, 10, 5, 3, Axis.Y, { roofing: Roofing.BARN });
  c.crates(3, 14, 6);
  c.crates(10, 16, 6);
  c.crates(4, 21, 3);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'warehouse-4');
  c.ground(0, 0, 30, 30, PAVING);
  c.stone(0, 0, 0, 30, 1, 2);
  c.stone(0, 0, 0, 1, 30, 2);
  // two stone warehouses and a crane
  c.stone(2, 2, 0, 16, 7, 8);
  c.windows([9, 10], 9, 0, 5, Colour.LOG_DARK);
  c.windows([4, 6, 13, 15], 9, 4, 2);
  c.roof(2, 2, 16, 7, 8, 4, Axis.X, { roofing: Roofing.BARN, gable: Colour.STONE_R });
  c.stone(20, 3, 0, 7, 14, 8);
  c.windowsSe(27, [9, 10], 0, 5, Colour.LOG_DARK);
  c.roof(20, 3, 7, 14, 8, 4, Axis.Y, { roofing: Roofing.BARN, gable: Colour.STONE_L });
  c.derrick(15, 14, 13);
  c.crates(3, 13, 6);
  c.crates(9, 18, 6);
  c.crates(3, 22, 6);
  c.crates(21, 21, 4);
  c.stone(0, 29, 0, 11, 1, 2);
  c.stone(16, 29, 0, 14, 1, 2);
  c.stone(29, 0, 0, 1, 30, 2);
  c.anchor();
  c.outline();
  return c;
}

/** The warehouse's sprite for each art band (1-4). */
export const warehouse: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
