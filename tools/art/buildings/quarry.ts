// Quarry: a pale stone outcrop being cut on green ground. Band 1 (levels 1-3) is the outcrop, a cut floor, a pile of
// blocks and a slate-roofed hut; each band after it is bigger and stronger: a wooden crane and more blocks, then
// terraces cut into the rock and a stone workshop, then a wide terraced pit with two cranes and a block yard.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

/** A pile of cut blocks: a row of `n` on the ground and a shorter row on top. */
function blocks(c: IsoCanvas, x: number, y: number, n: number) {
  const faces = { top: 'graniteHi', left: 'graniteL', right: 'graniteR' } as const;
  for (let i = 0; i < n; i++) c.box(x + i * 2, y, 0, 2, 2, 1, faces);
  for (let i = 0; i < n - 1; i++) c.box(x + 1 + i * 2, y + 0.5, 1, 2, 2, 1, faces);
}

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'quarry-1');
  c.grass(0, 0, 20, 20);
  c.path(10, 12, 2, 8);
  c.outcrop(2, 2, 10, 8, 9, 'granite');
  // the cut floor in front of the face
  c.box(3, 9, 0, 8, 3, 1, { top: 'graniteHi', left: 'graniteL', right: 'graniteR' });
  c.timber(14, 3, 0, 4, 4, 3);
  c.hipRoof(14, 3, 4, 4, 3, 2, 'x', 'slate');
  blocks(c, 12, 13, 2);
  c.centre();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'quarry-2');
  c.grass(0, 0, 24, 24);
  c.path(11, 14, 2, 10);
  c.outcrop(2, 2, 13, 10, 11, 'granite');
  c.box(3, 11, 0, 11, 3, 1, { top: 'graniteHi', left: 'graniteL', right: 'graniteR' });
  c.derrick(12, 12, 12);
  c.timber(17, 3, 0, 5, 5, 4);
  c.windows([19], 8, 0, 3, 'logDark');
  c.hipRoof(17, 3, 5, 5, 4, 3, 'x', 'slate');
  blocks(c, 14, 15, 3);
  blocks(c, 4, 17, 2);
  c.centre();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'quarry-3');
  const faces = { top: 'graniteHi', left: 'graniteL', right: 'graniteR' } as const;
  c.grass(0, 0, 27, 27);
  c.path(12, 16, 2, 11);
  // terraces cut into the rock, stepping down to the front, under a rough crown
  c.outcrop(2, 1, 16, 4, 13, 'granite');
  c.box(2, 5, 0, 16, 4, 8, faces);
  c.box(2, 9, 0, 16, 3, 5, faces);
  c.box(2, 12, 0, 16, 3, 2, faces);
  c.derrick(15, 14, 14);
  // a stone workshop
  c.stone(20, 3, 0, 5, 6, 5);
  c.windows([22], 9, 0, 3);
  c.hipRoof(20, 3, 5, 6, 5, 3, 'y', 'slate');
  blocks(c, 16, 18, 3);
  blocks(c, 3, 19, 3);
  c.fence(2, 25, 24, 25);
  c.centre();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'quarry-4');
  const faces = { top: 'graniteHi', left: 'graniteL', right: 'graniteR' } as const;
  c.grass(0, 0, 30, 30);
  c.path(13, 18, 2, 12);
  c.outcrop(1, 1, 20, 4, 15, 'granite');
  c.box(1, 5, 0, 20, 4, 11, faces);
  c.box(1, 9, 0, 20, 3, 8, faces);
  c.box(1, 12, 0, 20, 3, 5, faces);
  c.box(1, 15, 0, 20, 3, 2, faces);
  c.derrick(6, 17, 15);
  c.derrick(17, 17, 15);
  // the workshop, two storeys
  c.stone(23, 2, 0, 6, 8, 8);
  c.windows([25], 10, 0, 3);
  c.windows([24, 27], 10, 4, 2);
  c.roof(23, 2, 6, 8, 8, 4, 'y', { roofing: 'slate', gable: 'stoneL' });
  // the block yard
  blocks(c, 3, 21, 3);
  blocks(c, 3, 25, 3);
  blocks(c, 17, 21, 4);
  blocks(c, 17, 25, 3);
  c.stone(0, 29, 0, 12, 1, 2);
  c.stone(17, 29, 0, 13, 1, 2);
  c.stone(29, 0, 0, 1, 30, 2);
  c.centre();
  c.outline();
  return c;
}

/** The quarry's sprite for each art band (1-4). */
export const quarry: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
