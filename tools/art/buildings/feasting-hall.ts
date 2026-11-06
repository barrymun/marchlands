// Feasting Hall: a long plastered hall under a green roof. Band 1 (levels 1-3) is the hall and a table outside;
// each band after it is bigger and stronger: a kitchen with a smoking chimney, then a colonnade and a garden, then a
// great hall between towers with banners round a courtyard fountain.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { Axis, IsoCanvas, PAVING, Roofing } from '../iso.ts';

const SIZE = 64;

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'feasting-hall-1');
  c.grass(0, 0, 20, 20);
  c.ground(3, 11, 14, 6, PAVING);
  c.wall(3, 4, 0, 14, 6, 5);
  c.windows([9, 10], 10, 0, 3, Colour.LOG_DARK);
  c.windows([5, 7, 13, 15], 10, 2, 1);
  c.roof(3, 4, 14, 6, 5, 4, Axis.X, { roofing: Roofing.GREEN });
  c.box(6, 13, 0, 7, 1, 1, { top: Colour.PLANK_TOP, left: Colour.PLANK_L, right: Colour.PLANK_R });
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'feasting-hall-2');
  c.grass(0, 0, 24, 24);
  c.ground(2, 11, 18, 8, PAVING);
  c.wall(2, 3, 0, 16, 7, 6);
  c.windows([9, 10], 10, 0, 4, Colour.LOG_DARK);
  c.windows([4, 6, 13, 15], 10, 2, 2);
  c.roof(2, 3, 16, 7, 6, 4, Axis.X, { roofing: Roofing.GREEN });
  // the kitchen
  c.stone(19, 4, 0, 4, 5, 4);
  c.hipRoof(19, 4, 4, 5, 4, 2, Axis.Y, Roofing.SLATE);
  c.stone(20, 5, 6, 1, 1, 3);
  c.smoke(c.p(20.5, 5.5, 9));
  c.box(4, 14, 0, 8, 1, 1, { top: Colour.PLANK_TOP, left: Colour.PLANK_L, right: Colour.PLANK_R });
  c.box(4, 17, 0, 8, 1, 1, { top: Colour.PLANK_TOP, left: Colour.PLANK_L, right: Colour.PLANK_R });
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'feasting-hall-3');
  c.grass(0, 0, 27, 27);
  c.ground(2, 13, 20, 7, PAVING);
  c.wall(2, 3, 0, 18, 8, 7);
  c.colonnade(2, 11, 0, 18, 7);
  c.roof(2, 3, 18, 8, 7, 5, Axis.X, { roofing: Roofing.GREEN });
  c.stone(21, 4, 0, 4, 6, 5);
  c.hipRoof(21, 4, 4, 6, 5, 2, Axis.Y, Roofing.SLATE);
  c.stone(22, 5, 7, 1, 1, 3);
  c.smoke(c.p(22.5, 5.5, 10));
  c.garden(3, 21, 7, 4);
  c.cypress(14, 23, 6);
  c.cypress(20, 22, 6);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'feasting-hall-4');
  c.grass(0, 0, 30, 30);
  c.ground(3, 14, 23, 13, PAVING);
  // towers at both ends of the great hall
  c.stone(1, 2, 0, 4, 4, 13);
  c.crenels(1, 2, 13, 4, 4);
  c.wall(5, 3, 0, 18, 9, 9);
  c.colonnade(5, 12, 0, 18, 8);
  c.roof(5, 3, 18, 9, 9, 6, Axis.X, { roofing: Roofing.GREEN, trim: Colour.GOLD });
  c.stone(23, 2, 0, 4, 4, 13);
  c.crenels(23, 2, 13, 4, 4);
  c.banner(c.p(3, 4, 14), 5);
  c.banner(c.p(25, 4, 14), 5);
  c.stone(12, 18, 0, 6, 6, 1);
  c.ground(13, 19, 4, 4, Colour.WATER);
  c.box(4, 17, 0, 6, 1, 1, { top: Colour.PLANK_TOP, left: Colour.PLANK_L, right: Colour.PLANK_R });
  c.box(20, 17, 0, 6, 1, 1, { top: Colour.PLANK_TOP, left: Colour.PLANK_L, right: Colour.PLANK_R });
  c.cypress(4, 26, 6);
  c.cypress(25, 26, 6);
  c.anchor();
  c.outline();
  return c;
}

/** The feasting hall's sprite for each art band (1-4). */
export const feastingHall: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
