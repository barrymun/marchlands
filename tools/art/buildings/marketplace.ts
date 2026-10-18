// Marketplace: striped stalls round a paved plaza. Band 1 (levels 1-3) is a small plaza with two stalls; each band
// after it is bigger and stronger: more stalls and a pavilion, then a ring of stalls round a statue, then a forum with
// a colonnaded hall, a fountain and banners.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'marketplace-1');
  c.ground(0, 0, 20, 20, 'sand');
  c.plaza(10, 10, 7);
  c.stall(5, 6, 'red');
  c.stall(11, 5, 'blue');
  c.crates(12, 13, 3);
  c.centre();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'marketplace-2');
  c.ground(0, 0, 24, 24, 'sand');
  c.plaza(12, 12, 9);
  // a pavilion
  c.stone(14, 3, 0, 6, 5, 4);
  c.colonnade(14, 8, 0, 6, 4);
  c.hipRoof(14, 3, 6, 5, 4, 3, 'x', 'tile');
  c.stall(4, 5, 'red');
  c.stall(5, 11, 'blue');
  c.stall(14, 13, 'red');
  c.stall(9, 17, 'blue');
  c.crates(3, 17, 3);
  c.centre();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'marketplace-3');
  c.ground(0, 0, 27, 27, 'sand');
  c.plaza(13, 13, 11);
  c.stone(16, 2, 0, 7, 6, 5);
  c.colonnade(16, 8, 0, 7, 5);
  c.hipRoof(16, 2, 7, 6, 5, 3, 'x', 'tile');
  c.stall(4, 4, 'red');
  c.stall(9, 4, 'blue');
  c.stall(3, 11, 'blue');
  c.statue(12, 12);
  c.stall(19, 12, 'red');
  c.stall(5, 18, 'red');
  c.stall(15, 19, 'blue');
  c.crates(21, 19, 3);
  c.centre();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'marketplace-4');
  c.ground(0, 0, 30, 30, 'paving');
  // a colonnaded hall along the back
  c.wall(2, 1, 0, 26, 5, 6);
  c.colonnade(2, 6, 0, 26, 6);
  c.roof(2, 1, 26, 5, 6, 3, 'x', { roofing: 'tile', trim: 'gold' });
  c.plaza(15, 17, 11);
  c.stall(3, 9, 'red');
  c.stall(8, 9, 'blue');
  c.stall(19, 9, 'red');
  c.stall(24, 9, 'blue');
  c.stone(13, 15, 0, 5, 5, 1);
  c.ground(14, 16, 3, 3, 'water');
  c.stall(4, 16, 'blue');
  c.stall(23, 17, 'red');
  c.stall(7, 23, 'red');
  c.stall(18, 24, 'blue');
  c.crates(25, 24, 3);
  c.banner(c.p(2, 27, 0), 9);
  c.banner(c.p(28, 27, 0), 9);
  c.centre();
  c.outline();
  return c;
}

/** The marketplace's sprite for each art band (1-4). */
export const marketplace: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
