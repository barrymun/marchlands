// Ironmine: a dark, rust-flecked rock mound with a timber-framed mine entrance. Band 1 (levels 1-3) is the mound,
// the entrance, a cart on rails and an ore pile; each band after it is bigger and stronger: a wooden headframe over a
// shaft and a hut, then a smoking stone furnace, then a second entrance, a forge and a walled yard.

import { Axis, IsoCanvas, Rock, Roofing } from '../iso.ts';

const SIZE = 64;
const ORE = { top: 'oreHi', left: 'oreL', right: 'oreR' } as const;

/** A heap of ore: a small rust-topped mound. */
function orePile(c: IsoCanvas, x: number, y: number) {
  c.box(x, y, 0, 3, 3, 1, { top: 'rust', left: 'oreL', right: 'oreR' });
  c.box(x + 0.5, y + 0.5, 1, 2, 2, 1, { top: 'rust', left: 'oreL', right: 'oreR' });
}

/** A headframe over a shaft: two timber legs, a cross beam and the winding wheel. */
function headframe(c: IsoCanvas, x: number, y: number, h: number) {
  c.line(c.p(x, y + 3, 0), c.p(x + 1.5, y + 1.5, h), 'wood');
  c.line(c.p(x + 3, y, 0), c.p(x + 1.5, y + 1.5, h), 'wood');
  c.line(c.p(x + 0.75, y + 2.25, h / 2), c.p(x + 2.25, y + 0.75, h / 2), 'logDark');
  c.wheel(x + 1.5, y + 1.5, h, 2);
}

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'ironmine-1');
  c.grass(0, 0, 20, 20);
  c.path(8, 12, 2, 8);
  c.outcrop(2, 1, 12, 9, 9, Rock.ORE);
  // the face the entrance is cut into
  c.box(5, 8, 0, 6, 3, 5, ORE);
  c.mineEntrance(7, 11, 2, 3);
  c.cart(8, 14, 3);
  orePile(c, 14, 13);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'ironmine-2');
  c.grass(0, 0, 24, 24);
  c.path(8, 13, 2, 11);
  c.outcrop(2, 1, 14, 10, 11, Rock.ORE);
  c.box(5, 9, 0, 7, 3, 6, ORE);
  c.mineEntrance(7, 12, 3, 4);
  headframe(c, 17, 4, 12);
  c.timber(18, 10, 0, 4, 4, 3);
  c.hipRoof(18, 10, 4, 4, 3, 2, Axis.X, Roofing.SHINGLE);
  c.cart(8, 15, 4);
  orePile(c, 13, 17);
  orePile(c, 3, 17);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'ironmine-3');
  c.grass(0, 0, 27, 27);
  c.path(9, 14, 2, 13);
  c.outcrop(1, 1, 16, 11, 13, Rock.ORE);
  c.box(5, 10, 0, 8, 3, 7, ORE);
  c.mineEntrance(8, 13, 3, 4);
  headframe(c, 19, 2, 14);
  // the furnace, smoking
  c.stone(19, 12, 0, 5, 5, 5);
  c.stone(20, 13, 5, 2, 2, 5);
  c.smoke(c.p(21, 14, 10));
  c.windowsSe(24, [14, 15], 0, 2, 'rust');
  c.cart(9, 16, 4);
  c.cart(4, 19, 3);
  orePile(c, 14, 19);
  orePile(c, 2, 22);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'ironmine-4');
  c.grass(0, 0, 30, 30);
  c.path(9, 15, 2, 15);
  c.outcrop(1, 1, 19, 12, 15, Rock.ORE);
  c.box(3, 11, 0, 13, 3, 8, ORE);
  c.mineEntrance(5, 14, 3, 4);
  c.mineEntrance(11, 14, 3, 4);
  headframe(c, 21, 1, 15);
  c.stone(22, 9, 0, 6, 5, 6);
  c.stone(23, 10, 6, 2, 2, 6);
  c.smoke(c.p(24, 11, 12));
  c.windowsSe(28, [11, 12], 0, 2, 'rust');
  // the forge
  c.stone(21, 17, 0, 7, 6, 5);
  c.windows([23, 26], 23, 1, 2, 'rust');
  c.roof(21, 17, 7, 6, 5, 3, Axis.X, { roofing: Roofing.SHINGLE, gable: 'stoneR' });
  c.cart(6, 17, 4);
  c.cart(12, 17, 4);
  orePile(c, 3, 21);
  orePile(c, 14, 22);
  c.stone(0, 29, 0, 8, 1, 2);
  c.stone(13, 29, 0, 17, 1, 2);
  c.stone(29, 0, 0, 1, 30, 2);
  c.anchor();
  c.outline();
  return c;
}

/** The ironmine's sprite for each art band (1-4). */
export const ironmine: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
