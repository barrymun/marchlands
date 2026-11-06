// Workshop: a timber workshop under a shingle roof where siege engines are built. Band 1 (levels 1-3) is the workshop
// with timber and crates; each band after it is bigger and stronger: a catapult in the yard, then a second shed, a
// crane and two engines, then a stone-footed workshop with a yard of engines.

import { Axis, IsoCanvas, Roofing } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'workshop-1');
  c.ground(0, 0, 20, 20, 'sand');
  c.timber(4, 3, 0, 11, 6, 5);
  c.windows([8, 9, 10], 9, 0, 4, 'logDark');
  c.roof(4, 3, 11, 6, 5, 3, Axis.X, { roofing: Roofing.SHINGLE });
  c.logs(3, 13, 6, 2);
  c.crates(12, 13, 3);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'workshop-2');
  c.ground(0, 0, 24, 24, 'sand');
  c.timber(3, 2, 0, 13, 7, 6);
  c.windows([8, 9, 10, 11], 9, 0, 5, 'logDark');
  c.roof(3, 2, 13, 7, 6, 4, Axis.X, { roofing: Roofing.SHINGLE });
  c.catapult(12, 14);
  c.logs(3, 13, 7, 3);
  c.crates(17, 9, 4);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'workshop-3');
  c.ground(0, 0, 27, 27, 'sand');
  c.timber(2, 2, 0, 15, 7, 7);
  c.windows([7, 8, 9, 10, 11], 9, 0, 6, 'logDark');
  c.roof(2, 2, 15, 7, 7, 4, Axis.X, { roofing: Roofing.SHINGLE });
  c.timber(19, 3, 0, 6, 9, 5);
  c.windowsSe(25, [6, 7, 8], 0, 4, 'logDark');
  c.roof(19, 3, 6, 9, 5, 3, Axis.Y, { roofing: Roofing.SHINGLE });
  c.derrick(6, 15, 12);
  c.catapult(10, 15);
  c.catapult(17, 19);
  c.logs(2, 20, 7, 3);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'workshop-4');
  c.ground(0, 0, 30, 30, 'sand');
  c.stone(2, 2, 0, 18, 8, 2);
  c.timber(2, 2, 2, 18, 8, 8);
  c.windows([8, 9, 10, 11, 12, 13], 10, 0, 7, 'logDark');
  c.roof(2, 2, 18, 8, 8, 5, Axis.X, { roofing: Roofing.SHINGLE });
  c.stone(22, 3, 0, 6, 11, 2);
  c.timber(22, 3, 2, 6, 11, 5);
  c.windowsSe(28, [7, 8, 9], 0, 5, 'logDark');
  c.roof(22, 3, 6, 11, 7, 3, Axis.Y, { roofing: Roofing.SHINGLE });
  c.derrick(7, 17, 14);
  c.catapult(10, 16);
  c.catapult(17, 17);
  c.catapult(12, 22);
  c.catapult(20, 23);
  c.logs(2, 22, 7, 3);
  c.crates(24, 17, 6);
  c.anchor();
  c.outline();
  return c;
}

/** The workshop's sprite for each art band (1-4). */
export const workshop: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
