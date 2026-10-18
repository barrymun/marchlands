// Relief Station: a long, low infirmary under a brown roof with an herb garden. Band 1 (levels 1-3) is the infirmary
// and its garden; each band after it is bigger and stronger: a well and canvas tents for the wounded, then a second
// wing round a courtyard and more tents, then a colonnaded hospital round a fountain garden.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'relief-station-1');
  c.grass(0, 0, 20, 20);
  c.wall(3, 4, 0, 14, 5, 4);
  c.windows([5, 7, 12, 14], 9, 1, 2);
  c.windows([9, 10], 9, 0, 3, 'logDark');
  c.roof(3, 4, 14, 5, 4, 3, 'x', { roofing: 'barn' });
  c.garden(4, 12, 6, 5);
  c.garden(12, 12, 5, 5);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'relief-station-2');
  c.grass(0, 0, 24, 24);
  c.ground(3, 11, 18, 4, 'paving');
  c.wall(2, 3, 0, 18, 6, 5);
  c.windows([4, 6, 8, 14, 16, 18], 9, 1, 2);
  c.windows([11, 12], 9, 0, 3, 'logDark');
  c.roof(2, 3, 18, 6, 5, 3, 'x', { roofing: 'barn' });
  c.well(17, 16);
  c.tent(3, 16, 4, 4, 3);
  c.tent(9, 16, 4, 4, 3);
  c.garden(3, 21, 8, 2);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'relief-station-3');
  c.grass(0, 0, 27, 27);
  c.ground(8, 10, 16, 13, 'paving');
  c.wall(2, 2, 0, 22, 6, 5);
  c.windows([4, 6, 8, 10, 15, 17, 19, 21], 8, 1, 2);
  c.windows([12, 13], 8, 0, 3, 'logDark');
  c.roof(2, 2, 22, 6, 5, 3, 'x', { roofing: 'barn' });
  c.wall(2, 8, 0, 5, 15, 5);
  c.windowsSe(7, [10, 13, 16, 19], 1, 2);
  c.roof(2, 8, 5, 15, 5, 3, 'y', { roofing: 'barn' });
  c.well(13, 12);
  c.tent(9, 17, 4, 4, 3);
  c.tent(15, 17, 4, 4, 3);
  c.tent(20, 12, 4, 4, 3);
  c.garden(9, 23, 12, 3);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'relief-station-4');
  c.grass(0, 0, 30, 30);
  c.ground(8, 9, 15, 14, 'paving');
  c.wall(2, 2, 0, 26, 6, 6);
  c.colonnade(2, 8, 0, 26, 5);
  c.roof(2, 2, 26, 6, 6, 3, 'x', { roofing: 'barn' });
  c.wall(2, 8, 0, 5, 19, 5);
  c.windowsSe(7, [11, 14, 17, 20, 23], 1, 2);
  c.roof(2, 8, 5, 19, 5, 3, 'y', { roofing: 'barn' });
  c.wall(23, 8, 0, 5, 19, 5);
  c.roof(23, 8, 5, 19, 5, 3, 'y', { roofing: 'barn' });
  c.stone(13, 13, 0, 5, 5, 1);
  c.ground(14, 14, 3, 3, 'water');
  c.garden(9, 10, 3, 3);
  c.garden(19, 19, 3, 3);
  c.tent(9, 20, 4, 4, 3);
  c.tent(17, 9, 4, 3, 3);
  c.garden(9, 26, 13, 3);
  c.anchor();
  c.outline();
  return c;
}

/** The relief station's sprite for each art band (1-4). */
export const reliefStation: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
