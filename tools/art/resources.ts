// Resources: one 16×16 icon per resource (client/web/src/lib/game-art.ts, resourceArtFile), lit from the top left and
// outlined like the troops: an ear of corn for food, stacked logs for lumber, a rock for stone, and stacked ingots of
// iron and gold.

import { PixelCanvas } from './pixel.ts';
import { log } from './shapes.ts';
import type { ResourceKey } from '../../client/web/src/lib/game-art.ts';
import { Colour } from '../../client/web/src/lib/palette.ts';

const SIZE = 16;

/** An ingot from x to x + len with its top at y: a lit top face over a front face, its right end in shade. */
function ingot(c: PixelCanvas, x: number, y: number, len: number, top: Colour, front: Colour, end: Colour) {
  c.poly(
    [
      [x, y + 5],
      [x + 1, y],
      [x + len - 1, y],
      [x + len, y + 5],
    ],
    front,
  );
  c.poly(
    [
      [x + 1, y],
      [x + len - 1, y],
      [x + len - 1.5, y + 2],
      [x + 1.5, y + 2],
    ],
    top,
  );
  c.poly(
    [
      [x + len - 1, y],
      [x + len, y + 5],
      [x + len - 1.5, y + 5],
      [x + len - 1.5, y + 2],
    ],
    end,
  );
  // its edges, so stacked ingots stay apart
  c.line([x, y + 5], [x + 1, y], Colour.OUTLINE);
  c.line([x + 1, y], [x + len - 1, y], Colour.OUTLINE);
  c.line([x + len - 1, y], [x + len, y + 5], Colour.OUTLINE);
  c.line([x, y + 5], [x + len, y + 5], Colour.OUTLINE);
}

/** Three ingots stacked two and one. */
function ingots(seed: string, top: Colour, front: Colour, end: Colour): PixelCanvas {
  const c = new PixelCanvas(SIZE, seed);
  ingot(c, 0, 9, 8, top, front, end);
  ingot(c, 7, 9, 8, top, front, end);
  ingot(c, 3, 4, 9, top, front, end);
  c.outline();
  c.centre();
  return c;
}

/** Food: an ear of corn, its golden kernels showing from the green husk. */
function food(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'food');
  // the cob, an ellipse along the diagonal from the lower left to the upper right
  const [cx, cy, a, b] = [8.5, 7.5, 7, 3.6];
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const [dx, dy] = [x + 0.5 - cx, y + 0.5 - cy];
      const u = (dx - dy) / Math.SQRT2;
      const v = (dx + dy) / Math.SQRT2;
      if ((u / a) ** 2 + (v / b) ** 2 > 1) continue;
      c.set(x, y, v < -1.6 ? Colour.FIRE_HI : v > 1.4 ? Colour.WHEAT_DARK : (x + y) % 2 ? Colour.WHEAT : Colour.GOLD);
    }
  // the husk wrapping its lower end, and the stalk
  c.poly(
    [
      [1, 15],
      [2, 9],
      [6, 9],
      [8, 13],
    ],
    Colour.GREEN_L,
  );
  c.poly(
    [
      [1, 15],
      [7, 10],
      [11, 11],
      [7, 14],
    ],
    Colour.GREEN_D,
  );
  c.poly(
    [
      [2, 12],
      [3, 7],
      [5, 10],
    ],
    Colour.GREEN_HI,
  );
  c.outline();
  c.set(1, 15, Colour.GREEN_EDGE);
  return c;
}

/** Lumber: three logs stacked, their cut ends showing. */
function wood(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'wood');
  log(c, 4, 12, 3, 2.5);
  log(c, 2, 13, 8, 2.5);
  log(c, 1, 11, 13, 2.5);
  c.outline();
  c.centre();
  return c;
}

/** Stone: a quarried block of grey stone, cracked, lit from the top left. */
function stone(): PixelCanvas {
  const c = new PixelCanvas(SIZE, 'stone');
  c.poly(
    [
      [1, 5],
      [8, 1.5],
      [15, 5],
      [8, 8.5],
    ],
    Colour.GRANITE_L,
  );
  c.poly(
    [
      [1, 5],
      [8, 8.5],
      [8, 15],
      [1, 11.5],
    ],
    Colour.STONE_TOP,
  );
  c.poly(
    [
      [8, 8.5],
      [15, 5],
      [15, 11.5],
      [8, 15],
    ],
    Colour.STONE_R,
  );
  c.line([8, 9], [8, 14], Colour.STONE_L);
  c.line([3, 9], [5, 11], Colour.STONE_L);
  c.line([11, 10], [12, 12], Colour.SHINGLE_L);
  c.line([6, 4], [9, 5], Colour.GRANITE_HI);
  c.outline();
  return c;
}

/** The resources drawn in code, by resource key. */
export const RESOURCE_DRAWINGS: Record<ResourceKey, () => PixelCanvas> = {
  gold: () => ingots('gold', Colour.FIRE_HI, Colour.GOLD, Colour.GOLD_DARK),
  food,
  wood,
  stone,
  iron: () => ingots('iron', Colour.STEEL, Colour.STEEL_DARK, Colour.HOOD),
};
