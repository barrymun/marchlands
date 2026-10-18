// Embassy: a domed rotunda behind columns, flying flags. Band 1 (levels 1-3) is a small rotunda under a slate dome;
// each band after it is bigger and stronger: broad steps and more flags, then wings and a gilded dome, then a
// podium, a walled garden and a grand gilded dome.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

/** The rotunda: a square drum ringed with columns, under a dome. */
function rotunda(c: IsoCanvas, x: number, y: number, z: number, w: number, h: number, dome: 'slate' | 'gold') {
  c.wall(x, y, z, w, w, h);
  c.colonnade(x, y + w, z, w, h);
  c.colonnadeSe(x + w, y, z, w, h);
  c.box(x - 0.5, y - 0.5, z + h, w + 1, w + 1, 1, { top: 'wallTop', left: 'wallL', right: 'wallR' });
  c.dome(x, y, z + h + 1, w, dome);
}

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'embassy-1');
  c.grass(0, 0, 20, 20);
  c.ground(4, 12, 12, 6, 'paving');
  rotunda(c, 6, 4, 0, 8, 5, 'slate');
  c.banner(c.p(4, 15, 0), 8);
  c.banner(c.p(16, 15, 0), 8);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'embassy-2');
  c.grass(0, 0, 24, 24);
  c.ground(3, 15, 18, 7, 'paving');
  rotunda(c, 6, 3, 0, 10, 6, 'slate');
  c.stone(7, 13, 0, 8, 2, 1);
  for (const x of [3, 8, 14, 19]) c.banner(c.p(x, 19, 0), 8);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'embassy-3');
  c.grass(0, 0, 27, 27);
  c.ground(2, 16, 23, 8, 'paving');
  c.wall(1, 5, 0, 7, 7, 5);
  c.windows([3, 6], 12, 2, 2);
  c.roof(1, 5, 7, 7, 5, 3, 'x', { roofing: 'slate' });
  c.wall(19, 5, 0, 7, 7, 5);
  c.windows([21, 24], 12, 2, 2);
  c.roof(19, 5, 7, 7, 5, 3, 'x', { roofing: 'slate' });
  rotunda(c, 8, 3, 0, 11, 7, 'gold');
  c.stone(9, 14, 0, 9, 2, 1);
  for (const x of [3, 8, 18, 23]) c.banner(c.p(x, 21, 0), 9);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'embassy-4');
  c.grass(0, 0, 30, 30);
  c.stone(0, 0, 0, 30, 1, 2);
  c.stone(0, 0, 0, 1, 30, 2);
  c.ground(3, 18, 24, 9, 'paving');
  c.wall(2, 5, 0, 7, 8, 6);
  c.windows([4, 7], 13, 2, 2);
  c.roof(2, 5, 7, 8, 6, 3, 'x', { roofing: 'slate', trim: 'gold' });
  c.wall(21, 5, 0, 7, 8, 6);
  c.windows([23, 26], 13, 2, 2);
  c.roof(21, 5, 7, 8, 6, 3, 'x', { roofing: 'slate', trim: 'gold' });
  // the podium and the grand rotunda
  c.stone(8, 2, 0, 14, 14, 2);
  rotunda(c, 9, 3, 2, 12, 8, 'gold');
  c.stone(10, 16, 0, 10, 2, 1);
  c.garden(3, 22, 6, 5);
  c.garden(21, 22, 6, 5);
  for (const x of [5, 11, 19, 25]) c.banner(c.p(x, 20, 0), 10);
  c.stone(0, 29, 0, 12, 1, 2);
  c.stone(18, 29, 0, 12, 1, 2);
  c.stone(29, 0, 0, 1, 30, 2);
  c.anchor();
  c.outline();
  return c;
}

/** The embassy's sprite for each art band (1-4). */
export const embassy: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
