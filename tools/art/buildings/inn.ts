// Inn: a two-storey plastered inn under a slate roof. Band 1 (levels 1-3) is the inn with tables outside; each band
// after it is bigger and stronger: a wing round a courtyard with a well, then three wings and guests' horses, then a
// closed courtyard with a fountain and a banner over the gate.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

/** An inn wing along x: two storeys with windows on both. */
function wingX(c: IsoCanvas, x: number, y: number, w: number, d: number, h: number) {
  c.wall(x, y, 0, w, d, h);
  const xs = Array.from({ length: Math.floor((w - 1) / 3) }, (_, i) => x + 2 + i * 3);
  c.windows(xs, y + d, 1, 2);
  c.windows(xs, y + d, 4, 1);
  c.roof(x, y, w, d, h, 3, 'x', { roofing: 'slate' });
}

/** An inn wing along y. */
function wingY(c: IsoCanvas, x: number, y: number, w: number, d: number, h: number) {
  c.wall(x, y, 0, w, d, h);
  const ys = Array.from({ length: Math.floor((d - 1) / 3) }, (_, i) => y + 2 + i * 3);
  c.windowsSe(x + w, ys, 1, 2);
  c.windowsSe(x + w, ys, 4, 1);
  c.roof(x, y, w, d, h, 3, 'y', { roofing: 'slate' });
}

/** A table with a bench. */
function table(c: IsoCanvas, x: number, y: number) {
  c.box(x, y, 0, 3, 1, 1, { top: 'plankTop', left: 'plankL', right: 'plankR' });
}

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'inn-1');
  c.grass(0, 0, 20, 20);
  c.ground(3, 11, 14, 7, 'paving');
  wingX(c, 4, 4, 11, 6, 6);
  c.windows([9], 10, 0, 3, 'logDark');
  c.banner(c.p(15, 10, 4), 3);
  table(c, 5, 13);
  table(c, 11, 14);
  c.centre();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'inn-2');
  c.grass(0, 0, 24, 24);
  c.ground(8, 9, 14, 13, 'paving');
  wingX(c, 3, 2, 17, 6, 7);
  wingY(c, 3, 8, 5, 12, 6);
  c.well(15, 14);
  table(c, 10, 18);
  c.centre();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'inn-3');
  c.grass(0, 0, 27, 27);
  c.ground(8, 9, 11, 16, 'paving');
  wingX(c, 2, 2, 22, 6, 7);
  wingY(c, 2, 8, 5, 15, 6);
  c.well(12, 13);
  c.horse(12, 20);
  c.horse(15, 22);
  wingY(c, 20, 8, 5, 15, 6);
  c.centre();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'inn-4');
  c.grass(0, 0, 30, 30);
  c.ground(8, 9, 14, 13, 'paving');
  wingX(c, 2, 2, 26, 6, 8);
  wingY(c, 2, 8, 5, 20, 7);
  c.stone(13, 13, 0, 5, 5, 1);
  c.ground(14, 14, 3, 3, 'water');
  c.grass(9, 10, 3, 3);
  c.grass(19, 18, 3, 3);
  wingY(c, 23, 8, 5, 20, 7);
  // the front wing, with the gate
  wingX(c, 7, 23, 6, 5, 6);
  wingX(c, 17, 23, 6, 5, 6);
  c.banner(c.p(15, 28, 0), 9);
  c.centre();
  c.outline();
  return c;
}

/** The inn's sprite for each art band (1-4). */
export const inn: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
