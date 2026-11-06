// Production boosts, the one-day tool and its seven-day better one for each resource: a ploughshare and an iron rake
// (food), a bow saw and a two-man saw (lumber), a pickaxe and the pickaxe crossed with a sledgehammer (stone), a pair of
// bellows and a blast furnace (iron), and a tax decree, alone and with a stack of gold (gold).

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { disc, oval, rect } from '../shapes.ts';
import { canvas, coin, GOLD, LEATHER, rod, scroll, STEEL, STONE, waxSeal, writing } from './common.ts';

/** Plowshares: a wooden plough handle driving an iron share into a furrow of soil. */
function plowshares(): PixelCanvas {
  const c = canvas('plowshares');
  oval(c, 20, 27, 11, 3, Colour.SOIL);
  oval(c, 18, 26, 6, 1.5, Colour.DIRT);
  rod(c, [4, 5], [19, 21], 3, Colour.WOOD);
  rod(c, [4, 5], [5, 4], 3, Colour.LOG_DARK);
  rod(c, [2, 9], [8, 3], 2, Colour.LOG_DARK);
  c.poly(
    [
      [16, 18],
      [23, 18],
      [30, 26],
      [17, 25],
    ],
    STEEL.mid,
  );
  c.poly(
    [
      [17, 22],
      [27, 23],
      [30, 26],
      [17, 25],
    ],
    STEEL.dark,
  );
  c.line([17, 19], [22, 19], STEEL.hi);
  c.outline();
  return c;
}

/** Iron Rake: a long-handled rake with an iron head and teeth. */
function ironRake(): PixelCanvas {
  const c = canvas('iron-rake');
  rod(c, [28, 2], [9, 21], 2.5, Colour.WOOD);
  rod(c, [3, 17], [14, 28], 3, STEEL.dark);
  rod(c, [3, 16], [14, 27], 1.5, STEEL.mid);
  for (let i = 0; i <= 5; i++) {
    const [x, y] = [3.5 + i * 2, 18 + i * 2];
    rod(c, [x, y], [x - 3, y + 3], 1.5, STEEL.mid);
  }
  c.outline();
  c.line([27, 3], [20, 10], Colour.PLANK_TOP);
  return c;
}

/** Arch Saw: a bow saw, its blade held taut under an arched wooden frame. */
function archSaw(): PixelCanvas {
  const c = canvas('arch-saw');
  for (let x = 5; x <= 27; x += 0.5) {
    const u = (x - 16) / 11;
    disc(c, x, 22 - 15 * (1 - u * u), 1.5, Colour.WOOD);
  }
  rod(c, [3, 23], [29, 23], 3, STEEL.mid);
  rod(c, [2, 21], [6, 26], 3, Colour.LOG_DARK);
  c.outline();
  for (let x = 6; x <= 28; x += 2) c.set(x, 25, STEEL.dark);
  c.line([5, 22], [28, 22], STEEL.hi);
  for (let x = 8; x <= 24; x += 1) {
    const u = (x - 16) / 11;
    c.set(x, Math.round(21 - 15 * (1 - u * u)), Colour.PLANK_TOP);
  }
  return c;
}

/** Double Saw: a long two-man saw with a handle at each end. */
function doubleSaw(): PixelCanvas {
  const c = canvas('double-saw');
  c.poly(
    [
      [5, 21],
      [26, 8],
      [28, 12],
      [16, 21],
      [7, 25],
    ],
    STEEL.mid,
  );
  c.poly(
    [
      [6, 23],
      [27, 10],
      [28, 12],
      [16, 21],
      [7, 25],
    ],
    STEEL.dark,
  );
  rod(c, [3, 18], [7, 27], 3, Colour.WOOD);
  rod(c, [24, 5], [29, 14], 3, Colour.WOOD);
  c.outline();
  c.line([7, 21], [25, 10], STEEL.hi);
  for (const [x, y] of [
    [9, 25],
    [12, 24],
    [15, 22],
    [18, 20],
    [21, 18],
    [24, 15],
  ])
    c.set(x, y, Colour.OUTLINE);
  return c;
}

/** A pickaxe: its handle from the butt (x0, y0) to the head at (x1, y1), and the curved iron head across it, `arm` long each way. */
function pick(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number, arm = 11) {
  rod(c, [x0, y0], [x1, y1], 3, Colour.WOOD);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [px, py] = [(y0 - y1) / len, (x1 - x0) / len];
  const [dx, dy] = [(x1 - x0) / len, (y1 - y0) / len];
  for (const s of [1, -1]) {
    const mid: [number, number] = [x1 + s * px * arm * 0.55, y1 + s * py * arm * 0.55];
    rod(c, [x1, y1], mid, 4, STEEL.mid);
    rod(c, mid, [x1 + s * px * arm - dx * 3, y1 + s * py * arm - dy * 3], 2, STEEL.mid);
  }
  rod(c, [x1 + px * 2 + dx, y1 + py * 2 + dy], [x1 - px * 2 + dx, y1 - py * 2 + dy], 2, STEEL.dark);
}

/** Quarrying Tools: a pickaxe. */
function quarryingTools(): PixelCanvas {
  const c = canvas('quarrying-tools');
  pick(c, 7, 30, 19, 8);
  c.outline();
  return c;
}

/** A sledgehammer: its handle from the butt (x0, y0) to the head at (x1, y1), and the iron head across it. */
function sledge(c: PixelCanvas, x0: number, y0: number, x1: number, y1: number) {
  rod(c, [x0, y0], [x1, y1], 3, Colour.WOOD);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const [px, py] = [((y0 - y1) / len) * 5, ((x1 - x0) / len) * 5];
  const [dx, dy] = [((x1 - x0) / len) * 3, ((y1 - y0) / len) * 3];
  c.poly(
    [
      [x1 + px - dx, y1 + py - dy],
      [x1 + px + dx, y1 + py + dy],
      [x1 - px + dx, y1 - py + dy],
      [x1 - px - dx, y1 - py - dy],
    ],
    STEEL.dark,
  );
  c.poly(
    [
      [x1 + px - dx, y1 + py - dy],
      [x1 + px + dx * 0.2, y1 + py + dy * 0.2],
      [x1 - px + dx * 0.2, y1 - py + dy * 0.2],
      [x1 - px - dx, y1 - py - dy],
    ],
    STEEL.mid,
  );
}

/** Adv Quarrying Tools: a pickaxe crossed with a sledgehammer. */
function advQuarryingTools(): PixelCanvas {
  const c = canvas('adv-quarrying-tools');
  sledge(c, 25, 30, 8, 10);
  pick(c, 7, 30, 22, 10, 8);
  c.outline();
  return c;
}

/** Blower: a pair of bellows, leather pleated between two wooden boards narrowing to an iron nozzle. */
function blower(): PixelCanvas {
  const c = canvas('blower');
  rod(c, [7, 10], [2, 6], 2.5, Colour.WOOD);
  rod(c, [7, 23], [2, 27], 2.5, Colour.WOOD);
  c.poly(
    [
      [6, 11],
      [25, 15],
      [25, 18],
      [6, 23],
    ],
    LEATHER.mid,
  );
  for (const x of [9, 13, 17]) c.line([x, 13], [x, 21], LEATHER.dark);
  c.poly(
    [
      [5, 8],
      [18, 8],
      [26, 15],
      [6, 13],
    ],
    Colour.PLANK_L,
  );
  c.poly(
    [
      [6, 9],
      [17, 9],
      [21, 12],
      [7, 11],
    ],
    Colour.PLANK_TOP,
  );
  c.poly(
    [
      [6, 21],
      [26, 18],
      [18, 25],
      [5, 25],
    ],
    Colour.PLANK_R,
  );
  rod(c, [24, 16.5], [31, 16.5], 3, STEEL.mid);
  c.outline();
  c.line([25, 16], [30, 16], STEEL.hi);
  return c;
}

/** Blast Furnace: a tapering stone furnace, fire in its mouth and flames from its top. */
function blastFurnace(): PixelCanvas {
  const c = canvas('blast-furnace');
  c.poly(
    [
      [9, 9],
      [22, 9],
      [27, 29],
      [4, 29],
    ],
    (x, y) => ((Math.floor(y / 3) % 2 ? x + 2 : x) % 6 === 0 || y % 3 === 0 ? STONE.dark : x < 12 ? STONE.hi : x > 20 ? Colour.STONE_R : STONE.mid),
  );
  rect(c, 8, 7, 23, 9, Colour.STONE_R);
  rect(c, 8, 7, 23, 7, STONE.hi);
  // the glowing mouth
  oval(c, 15.5, 25, 5, 5, Colour.OUTLINE);
  oval(c, 15.5, 25.5, 4, 4, Colour.FIRE);
  oval(c, 15.5, 26.5, 2.5, 2.5, Colour.FIRE_HI);
  rect(c, 10, 27, 21, 29, Colour.STONE_R);
  rect(c, 11, 27, 20, 27, Colour.FIRE);
  // flames over the top
  c.poly(
    [
      [8, 8],
      [12, 1],
      [15, 4],
      [19, 0],
      [23, 8],
    ],
    Colour.FIRE,
  );
  c.poly(
    [
      [12, 7],
      [14, 3],
      [16, 5],
      [18, 2],
      [19, 7],
    ],
    Colour.FIRE_HI,
  );
  c.outline();
  return c;
}

/** Tax Policy: a decree with a gold coin pressed into it. */
function taxPolicy(): PixelCanvas {
  const c = canvas('tax-policy');
  scroll(c, 7, 3, 24, 28);
  writing(c, 10, 21, 7, 17);
  coin(c, 20, 22);
  c.outline();
  return c;
}

/** A stack of `n` gold coins seen from the side, its top coin's face at (x, y). */
function coinStack(c: PixelCanvas, x: number, y: number, n: number) {
  for (let i = n - 1; i >= 0; i--) {
    oval(c, x, y + i * 2 + 1, 4.5, 2, GOLD.dark);
    oval(c, x, y + i * 2, 4.5, 2, GOLD.mid);
  }
  oval(c, x - 1, y - 0.5, 2, 0.8, GOLD.hi);
}

/** Adv Tax Policy: the decree, sealed in red wax, with a stack of gold before it. */
function advTaxPolicy(): PixelCanvas {
  const c = canvas('adv-tax-policy');
  scroll(c, 5, 2, 20, 26);
  writing(c, 8, 17, 6, 14);
  waxSeal(c, 10, 20);
  coinStack(c, 24, 21, 4);
  coinStack(c, 18, 26, 2);
  c.outline();
  return c;
}

export const PRODUCTION_DRAWINGS = {
  plowshares,
  ironRake,
  archSaw,
  doubleSaw,
  quarryingTools,
  advQuarryingTools,
  blower,
  blastFurnace,
  taxPolicy,
  advTaxPolicy,
};
