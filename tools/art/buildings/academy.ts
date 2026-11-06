// Academy: a plastered school under a slate roof. Band 1 (levels 1-3) is the school on a lawn; each band after it is
// bigger and stronger: a columned porch and a garden, then a library wing and an observatory dome, then wings round a
// courtyard with a statue under a gilded observatory dome.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { Axis, IsoCanvas, PAVING, Roofing } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'academy-1');
  c.grass(0, 0, 20, 20);
  c.path(9, 11, 2, 9);
  c.wall(4, 4, 0, 11, 7, 6);
  c.windows([6, 13], 11, 1, 2);
  c.windows([6, 8, 11, 13], 11, 4, 1);
  c.windows([9, 10], 11, 0, 3, Colour.LOG_DARK);
  c.roof(4, 4, 11, 7, 6, 4, Axis.X, { roofing: Roofing.SLATE });
  c.cypress(16, 14, 5);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'academy-2');
  c.grass(0, 0, 24, 24);
  c.ground(5, 13, 13, 4, PAVING);
  c.wall(4, 3, 0, 15, 8, 7);
  c.windows([6, 8, 15, 17], 11, 4, 2);
  c.roof(4, 3, 15, 8, 7, 4, Axis.X, { roofing: Roofing.SLATE });
  // the porch
  c.colonnade(9, 12, 0, 5, 5);
  c.box(9, 11, 5, 5, 1, 1, { top: Colour.WALL_TOP, left: Colour.WALL_L, right: Colour.WALL_R });
  c.garden(2, 18, 6, 4);
  c.cypress(19, 17, 6);
  c.cypress(21, 20, 5);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'academy-3');
  c.grass(0, 0, 27, 27);
  c.ground(5, 14, 15, 5, PAVING);
  c.wall(4, 3, 0, 16, 9, 8);
  c.windows([6, 8, 16, 18], 12, 4, 2);
  c.roof(4, 3, 16, 9, 8, 5, Axis.X, { roofing: Roofing.SLATE });
  c.colonnade(10, 13, 0, 5, 6);
  c.box(10, 12, 6, 5, 1, 1, { top: Colour.WALL_TOP, left: Colour.WALL_L, right: Colour.WALL_R });
  // the library wing and the observatory
  c.wall(21, 6, 0, 5, 12, 6);
  c.windowsSe(26, [9, 12, 15], 2, 2);
  c.roof(21, 6, 5, 12, 6, 3, Axis.Y, { roofing: Roofing.SLATE });
  c.stone(1, 4, 0, 3, 3, 9);
  c.dome(0.5, 3.5, 9, 4, Roofing.SLATE);
  c.garden(3, 20, 7, 5);
  c.cypress(21, 22, 6);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'academy-4');
  c.grass(0, 0, 30, 30);
  c.ground(6, 15, 17, 11, PAVING);
  c.stone(1, 3, 0, 4, 4, 13);
  c.dome(0.5, 2.5, 13, 5, Roofing.GOLD);
  c.wall(5, 2, 0, 18, 10, 9);
  c.windows([7, 9, 19, 21], 12, 5, 2);
  c.roof(5, 2, 18, 10, 9, 5, Axis.X, { roofing: Roofing.SLATE, trim: Colour.GOLD });
  c.colonnade(11, 13, 0, 6, 7);
  c.box(11, 12, 7, 6, 1, 1, { top: Colour.WALL_TOP, left: Colour.WALL_L, right: Colour.WALL_R });
  c.wall(24, 5, 0, 5, 15, 7);
  c.windowsSe(29, [8, 11, 14, 17], 2, 2);
  c.roof(24, 5, 5, 15, 7, 3, Axis.Y, { roofing: Roofing.SLATE });
  c.wall(1, 9, 0, 4, 14, 6);
  c.roof(1, 9, 4, 14, 6, 3, Axis.Y, { roofing: Roofing.SLATE });
  c.statue(13, 19);
  c.garden(7, 23, 5, 4);
  c.garden(18, 23, 5, 4);
  c.cypress(26, 25, 6);
  c.anchor();
  c.outline();
  return c;
}

/** The academy's sprite for each art band (1-4). */
export const academy: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
