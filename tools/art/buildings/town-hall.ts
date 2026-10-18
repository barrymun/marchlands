// Town Hall: a Roman villa. Band 1 (levels 1-3) is a columned hall and a wing round a paved courtyard; each band
// after it is bigger and stronger: a second wing, then a stone wall, a fountain and a two-storey wing, then towers with
// banners and a hall with gilded eaves on a podium.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 22);
  c.ground(0, 0, 22, 22, 'sand');
  c.ground(5, 10, 13, 10, 'paving');
  // the wing, along the back left
  c.wall(1, 2, 0, 4, 12, 4);
  c.windowsSe(5, [5, 8, 11], 1, 2);
  c.roof(1, 2, 4, 12, 4, 3, 'y');
  // the hall: columns on its two front faces
  c.wall(9, 2, 0, 11, 7, 5);
  c.colonnade(9, 9, 0, 11, 5);
  c.colonnadeSe(20, 2, 0, 7, 5);
  c.roof(9, 2, 11, 7, 5, 4, 'x');
  c.cypress(19, 14, 5);
  c.cypress(3, 19, 4);
  c.centre();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 25);
  c.ground(0, 0, 25, 25, 'sand');
  c.ground(6, 11, 15, 8, 'paving');
  c.wall(1, 2, 0, 4, 15, 5);
  c.windowsSe(5, [5, 8, 11, 14], 1, 2);
  c.roof(1, 2, 4, 15, 5, 3, 'y');
  c.wall(10, 2, 0, 13, 8, 6);
  c.colonnade(10, 10, 0, 13, 6);
  c.colonnadeSe(23, 2, 0, 8, 6);
  c.roof(10, 2, 13, 8, 6, 5, 'x');
  // the second wing, along the front left
  c.wall(1, 20, 0, 13, 4, 4);
  c.windows([4, 7, 10], 24, 1, 2);
  c.roof(1, 20, 13, 4, 4, 3, 'x');
  c.cypress(21, 16, 6);
  c.cypress(23, 20, 5);
  c.centre();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 28);
  c.ground(0, 0, 28, 28, 'sand');
  c.ground(8, 13, 15, 9, 'paving');
  // the stone wall's back sides
  c.stone(0, 0, 0, 28, 1, 3);
  c.stone(0, 0, 0, 1, 28, 3);
  // a two-storey wing
  c.wall(2, 3, 0, 5, 16, 7);
  c.windowsSe(7, [5, 8, 11, 14, 17], 1, 2);
  c.windowsSe(7, [5, 8, 11, 14, 17], 4, 2);
  c.roof(2, 3, 5, 16, 7, 3, 'y');
  c.wall(12, 2, 0, 14, 9, 7);
  c.colonnade(12, 11, 0, 14, 7);
  c.colonnadeSe(26, 2, 0, 9, 7);
  c.roof(12, 2, 14, 9, 7, 5, 'x');
  // a fountain
  c.stone(14, 15, 0, 5, 5, 1);
  c.ground(15, 16, 3, 3, 'water');
  c.wall(2, 21, 0, 13, 4, 4);
  c.windows([5, 8, 11], 25, 1, 2);
  c.roof(2, 21, 13, 4, 4, 4, 'x');
  c.cypress(24, 17, 6);
  c.cypress(22, 22, 5);
  // the wall's front sides, with a gate in the south-west
  c.stone(0, 27, 0, 9, 1, 3);
  c.stone(14, 27, 0, 14, 1, 3);
  c.stone(27, 0, 0, 1, 28, 3);
  c.centre();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 31);
  c.ground(0, 0, 31, 31, 'sand');
  c.ground(9, 15, 17, 10, 'paving');
  // the wall's back sides and the back tower
  c.stone(0, 0, 0, 31, 1, 4);
  c.stone(0, 0, 0, 1, 31, 4);
  c.stone(0, 0, 0, 3, 3, 9);
  c.wall(3, 4, 0, 5, 17, 7);
  c.windowsSe(8, [6, 9, 12, 15, 18], 1, 2);
  c.windowsSe(8, [6, 9, 12, 15, 18], 4, 2);
  c.roof(3, 4, 5, 17, 7, 3, 'y');
  // the hall on a stone podium, its eaves gilded
  c.stone(12, 2, 0, 17, 11, 1);
  c.wall(13, 3, 1, 15, 9, 7);
  c.colonnade(13, 12, 1, 15, 7);
  c.colonnadeSe(28, 3, 1, 9, 7);
  c.roof(13, 3, 15, 9, 8, 6, 'x', { trim: 'gold' });
  c.stone(15, 17, 0, 6, 6, 1);
  c.ground(16, 18, 4, 4, 'water');
  c.set(...c.p(18, 20, 3), 'gold');
  c.wall(3, 24, 0, 14, 4, 5);
  c.windows([6, 9, 12, 15], 28, 1, 2);
  c.roof(3, 24, 14, 4, 5, 4, 'x');
  c.cypress(26, 19, 6);
  c.cypress(24, 25, 5);
  // the wall's front sides and the other three towers, with banners on the two side towers
  c.stone(0, 30, 0, 10, 1, 4);
  c.stone(15, 30, 0, 16, 1, 4);
  c.stone(30, 0, 0, 1, 31, 4);
  c.stone(28, 0, 0, 3, 3, 9);
  c.crenels(28, 0, 9, 3, 3);
  c.banner(c.p(29.5, 1.5, 10), 5);
  c.stone(0, 28, 0, 3, 3, 9);
  c.crenels(0, 28, 9, 3, 3);
  c.banner(c.p(1.5, 29.5, 10), 5);
  c.stone(28, 28, 0, 3, 3, 9);
  c.crenels(28, 28, 9, 3, 3);
  c.centre();
  c.outline();
  return c;
}

/** The Town Hall's sprite for each art band (1-4). */
export const townHall: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
