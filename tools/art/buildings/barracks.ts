// Barracks: plastered soldiers' quarters under dark shingle roofs, with a training yard. Band 1 (levels 1-3) is one
// block with dummies and a weapon rack; each band after it is bigger and stronger: a second block and a fenced yard,
// then an L of quarters behind a stone wall, then two-storey stone barracks with towers.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'barracks-1');
  c.grass(0, 0, 20, 20);
  c.ground(3, 11, 14, 7, 'sand');
  c.wall(4, 3, 0, 12, 6, 5);
  c.windows([6, 9, 13], 9, 2, 1);
  c.windows([11], 9, 0, 3, 'logDark');
  c.roof(4, 3, 12, 6, 5, 3, 'x', { roofing: 'shingle' });
  c.dummy(6, 14);
  c.dummy(9, 16);
  c.rack(14, 14);
  c.centre();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'barracks-2');
  c.grass(0, 0, 24, 24);
  c.ground(3, 11, 18, 11, 'sand');
  c.wall(3, 2, 0, 13, 6, 6);
  c.windows([5, 8, 13], 8, 2, 2);
  c.windows([11], 8, 0, 3, 'logDark');
  c.roof(3, 2, 13, 6, 6, 3, 'x', { roofing: 'shingle' });
  c.wall(17, 3, 0, 5, 8, 5);
  c.windowsSe(22, [5, 8], 2, 1);
  c.roof(17, 3, 5, 8, 5, 3, 'y', { roofing: 'shingle' });
  c.dummy(6, 15);
  c.dummy(9, 17);
  c.dummy(12, 15);
  c.rack(17, 16);
  c.fence(3, 22, 21, 22);
  c.fence(21, 12, 21, 22);
  c.centre();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'barracks-3');
  c.grass(0, 0, 27, 27);
  c.ground(8, 9, 17, 15, 'sand');
  c.stone(0, 0, 0, 27, 1, 2);
  c.stone(0, 0, 0, 1, 27, 2);
  c.wall(2, 2, 0, 22, 6, 6);
  c.windows([4, 7, 10, 16, 19, 22], 8, 2, 2);
  c.windows([13], 8, 0, 3, 'logDark');
  c.roof(2, 2, 22, 6, 6, 3, 'x', { roofing: 'shingle' });
  c.wall(2, 8, 0, 5, 16, 6);
  c.windowsSe(7, [11, 14, 17, 20], 2, 2);
  c.roof(2, 8, 5, 16, 6, 3, 'y', { roofing: 'shingle' });
  c.dummy(11, 14);
  c.dummy(14, 16);
  c.dummy(17, 14);
  c.rack(20, 18);
  c.rack(12, 20);
  c.stone(0, 26, 0, 10, 1, 2);
  c.stone(15, 26, 0, 12, 1, 2);
  c.stone(26, 0, 0, 1, 27, 2);
  c.centre();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'barracks-4');
  c.grass(0, 0, 30, 30);
  c.ground(8, 10, 19, 17, 'sand');
  c.stone(0, 0, 0, 30, 1, 3);
  c.stone(0, 0, 0, 1, 30, 3);
  c.stone(0, 0, 0, 3, 3, 10);
  c.crenels(0, 0, 10, 3, 3);
  c.stone(3, 2, 0, 24, 7, 8);
  c.windows([5, 8, 11, 18, 21, 24], 9, 2, 2);
  c.windows([5, 8, 11, 14, 18, 21, 24], 9, 5, 1);
  c.windows([14, 15], 9, 0, 3, 'logDark');
  c.roof(3, 2, 24, 7, 8, 4, 'x', { roofing: 'shingle', gable: 'stoneR' });
  c.stone(2, 9, 0, 5, 17, 8);
  c.windowsSe(7, [12, 15, 18, 21], 2, 2);
  c.roof(2, 9, 5, 17, 8, 3, 'y', { roofing: 'shingle', gable: 'stoneL' });
  c.dummy(12, 15);
  c.dummy(15, 17);
  c.dummy(18, 15);
  c.dummy(21, 17);
  c.rack(13, 21);
  c.rack(22, 22);
  c.stone(0, 29, 0, 11, 1, 3);
  c.stone(17, 29, 0, 13, 1, 3);
  c.stone(29, 0, 0, 1, 30, 3);
  c.stone(27, 0, 0, 3, 3, 10);
  c.crenels(27, 0, 10, 3, 3);
  c.banner(c.p(28.5, 1.5, 11), 5);
  c.stone(0, 27, 0, 3, 3, 10);
  c.crenels(0, 27, 10, 3, 3);
  c.banner(c.p(1.5, 28.5, 11), 5);
  c.stone(27, 27, 0, 3, 3, 10);
  c.crenels(27, 27, 10, 3, 3);
  c.centre();
  c.outline();
  return c;
}

/** The barracks' sprite for each art band (1-4). */
export const barracks: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
