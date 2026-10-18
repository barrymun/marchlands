// Beacon Tower: a lookout with a signal fire. Band 1 (levels 1-3) is a wooden watchtower with a small fire; each band
// after it is bigger and stronger: a stone tower with a brazier, then a taller crenellated tower and a guardhouse, then
// a fortified beacon with a great fire, a banner and a walled base.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'beacon-tower-1');
  c.grass(0, 0, 20, 20);
  // four legs and a plank platform
  for (const [x, y] of [
    [8, 8],
    [12, 8],
    [8, 12],
    [12, 12],
  ])
    c.line(c.p(x, y, 0), c.p(x, y, 11), 'wood');
  c.line(c.p(8, 12, 3), c.p(12, 8, 8), 'logDark');
  c.box(7.5, 7.5, 11, 5, 5, 1, { top: 'plankTop', left: 'plankL', right: 'plankR' });
  c.fire(c.p(10, 10, 12), 5);
  c.logs(13, 14, 4, 2);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'beacon-tower-2');
  c.grass(0, 0, 24, 24);
  c.stone(9, 8, 0, 5, 5, 13);
  c.windows([11], 13, 3, 2);
  c.windows([11], 13, 0, 2, 'logDark');
  c.box(8.5, 7.5, 13, 6, 6, 1, { top: 'stoneTop', left: 'stoneL', right: 'stoneR' });
  c.box(10.5, 9.5, 14, 2, 2, 1, { top: 'outline', left: 'metal', right: 'stoneR' });
  c.fire(c.p(11.5, 10.5, 15), 7);
  c.logs(15, 16, 5, 2);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'beacon-tower-3');
  c.grass(0, 0, 27, 27);
  c.stone(10, 7, 0, 6, 6, 17);
  c.windows([12], 13, 4, 2);
  c.windows([12], 13, 9, 2);
  c.windows([12, 13], 13, 0, 3, 'logDark');
  c.box(9.5, 6.5, 17, 7, 7, 1, { top: 'stoneTop', left: 'stoneL', right: 'stoneR' });
  c.crenels(9.5, 6.5, 17, 7, 7);
  c.box(12, 9, 18, 2, 2, 1, { top: 'outline', left: 'metal', right: 'stoneR' });
  c.fire(c.p(13, 10, 19), 8);
  // the guardhouse
  c.wall(17, 13, 0, 6, 5, 4);
  c.windows([19, 20], 18, 0, 3, 'logDark');
  c.hipRoof(17, 13, 6, 5, 4, 2, 'x', 'slate');
  c.logs(4, 17, 6, 2);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'beacon-tower-4');
  c.grass(0, 0, 30, 30);
  // a walled base round the tower
  c.stone(4, 4, 0, 22, 1, 3);
  c.stone(4, 4, 0, 1, 22, 3);
  c.stone(11, 9, 0, 8, 8, 21);
  c.windows([13, 16], 17, 4, 2);
  c.windows([13, 16], 17, 10, 2);
  c.windows([13, 16], 17, 15, 2);
  c.windows([14, 15], 17, 0, 3, 'logDark');
  c.box(10.5, 8.5, 21, 9, 9, 1, { top: 'stoneTop', left: 'stoneL', right: 'stoneR' });
  c.crenels(10.5, 8.5, 21, 9, 9);
  c.box(13.5, 11.5, 22, 3, 3, 1, { top: 'outline', left: 'metal', right: 'stoneR' });
  c.fire(c.p(15, 13, 23), 11);
  c.banner(c.p(11, 17, 22), 6);
  c.wall(20, 19, 0, 5, 5, 4);
  c.hipRoof(20, 19, 5, 5, 4, 2, 'x', 'slate');
  c.logs(6, 20, 6, 3);
  c.stone(4, 25, 0, 8, 1, 3);
  c.stone(17, 25, 0, 9, 1, 3);
  c.stone(25, 4, 0, 1, 22, 3);
  c.anchor();
  c.outline();
  return c;
}

/** The beacon tower's sprite for each art band (1-4). */
export const beaconTower: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
