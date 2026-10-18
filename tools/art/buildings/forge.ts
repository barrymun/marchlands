// Forge: a smithy under a tiled roof with a smoking stone chimney. Band 1 (levels 1-3) is the smithy, an anvil and a
// coal heap; each band after it is bigger and stronger: an open shed and a weapon rack, then a glowing furnace and a
// second chimney, then a stone foundry with three chimneys and a yard of anvils.

import { IsoCanvas } from '../iso.ts';

const SIZE = 64;

/** A heap of coal. */
function coal(c: IsoCanvas, x: number, y: number) {
  c.box(x, y, 0, 3, 3, 1, { top: 'outline', left: 'oreR', right: 'outline' });
  c.box(x + 0.5, y + 0.5, 1, 2, 2, 1, { top: 'oreR', left: 'outline', right: 'outline' });
}

/** A stone chimney from the ground, smoking. */
function chimney(c: IsoCanvas, x: number, y: number, h: number) {
  c.stone(x, y, 0, 2, 2, h);
  c.smoke(c.p(x + 1, y + 1, h));
}

function band1(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 20, 'forge-1');
  c.ground(0, 0, 20, 20, 'sand');
  c.wall(5, 4, 0, 9, 6, 5);
  c.windows([8, 9], 10, 0, 3, 'fire');
  c.roof(5, 4, 9, 6, 5, 3, 'x', { roofing: 'tile' });
  chimney(c, 14, 5, 10);
  c.anvil(9, 13);
  coal(c, 3, 13);
  c.anchor();
  c.outline();
  return c;
}

function band2(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 24, 'forge-2');
  c.ground(0, 0, 24, 24, 'sand');
  c.wall(4, 3, 0, 11, 7, 6);
  c.windows([9, 10], 10, 0, 3, 'fire');
  c.roof(4, 3, 11, 7, 6, 4, 'x', { roofing: 'tile' });
  chimney(c, 15, 4, 12);
  // an open shed
  c.timber(17, 9, 0, 5, 6, 3);
  c.hipRoof(17, 9, 5, 6, 3, 2, 'y', 'shingle');
  c.anvil(8, 14);
  c.anvil(12, 16);
  c.rack(5, 18);
  coal(c, 2, 13);
  c.anchor();
  c.outline();
  return c;
}

function band3(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 27, 'forge-3');
  c.ground(0, 0, 27, 27, 'sand');
  c.wall(4, 3, 0, 14, 8, 7);
  c.windows([9, 10, 13, 14], 11, 0, 3, 'fire');
  c.roof(4, 3, 14, 8, 7, 4, 'x', { roofing: 'tile' });
  chimney(c, 2, 3, 13);
  chimney(c, 18, 4, 14);
  c.timber(20, 11, 0, 5, 7, 3);
  c.hipRoof(20, 11, 5, 7, 3, 2, 'y', 'shingle');
  c.anvil(8, 15);
  c.anvil(12, 17);
  c.anvil(16, 15);
  c.rack(5, 20);
  c.rack(17, 21);
  coal(c, 2, 15);
  c.crates(9, 22, 3);
  c.anchor();
  c.outline();
  return c;
}

function band4(): IsoCanvas {
  const c = new IsoCanvas(SIZE, 30, 'forge-4');
  c.ground(0, 0, 30, 30, 'paving');
  c.stone(3, 3, 0, 19, 9, 8);
  c.windows([7, 8, 12, 13, 17, 18], 12, 0, 3, 'fire');
  c.windows([5, 10, 15, 20], 12, 5, 2);
  c.roof(3, 3, 19, 9, 8, 4, 'x', { roofing: 'tile', gable: 'stoneR' });
  chimney(c, 1, 2, 15);
  chimney(c, 11, 1, 16);
  chimney(c, 22, 2, 15);
  c.stone(23, 9, 0, 5, 9, 5);
  c.windowsSe(28, [12, 15], 0, 3, 'fire');
  c.roof(23, 9, 5, 9, 5, 2, 'y', { roofing: 'shingle', gable: 'stoneL' });
  c.anvil(7, 16);
  c.anvil(11, 18);
  c.anvil(15, 16);
  c.anvil(19, 18);
  c.rack(5, 23);
  c.rack(13, 24);
  c.rack(21, 23);
  coal(c, 2, 16);
  c.crates(24, 20, 6);
  c.anchor();
  c.outline();
  return c;
}

/** The forge's sprite for each art band (1-4). */
export const forge: Record<number, () => IsoCanvas> = { 1: band1, 2: band2, 3: band3, 4: band4 };
