// City items: a white flag of truce, a map with the city's new place marked (City Teleporter), a stone tablet of laws
// (Civil Code) and a flask of green medicine (Penicillin).

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { disc, oval, rect } from '../shapes.ts';
import { canvas, GREEN, lathe, PARCHMENT, rod, sparkle, stamp, STONE } from './common.ts';

/** Truce Agreement: a white flag of truce, waving from its pole. */
function truceAgreement(): PixelCanvas {
  const c = canvas('truce-agreement');
  rod(c, [8, 3], [8, 30], 2, Colour.WOOD);
  for (let x = 9; x <= 27; x++) {
    const wave = Math.round(Math.sin((x - 9) / 3) * 1.5);
    const shade = Math.cos((x - 9) / 3);
    rect(c, x, 5 + wave, x, 18 + wave - Math.floor((x - 9) / 6), shade > 0.4 ? Colour.SPARKLE : shade < -0.4 ? Colour.LINEN : Colour.WOOL);
  }
  disc(c, 8, 2, 1.5, Colour.GOLD);
  c.outline();
  return c;
}

/** City Teleporter: a map unrolled from its roller, a dotted road leading over land and water to a red cross. */
function cityTeleporter(): PixelCanvas {
  const c = canvas('city-teleporter');
  rect(c, 8, 6, 28, 26, PARCHMENT.mid);
  rect(c, 8, 6, 28, 7, PARCHMENT.hi);
  rect(c, 8, 25, 28, 26, PARCHMENT.dark);
  oval(c, 15, 15, 6, 5, Colour.GRASS);
  oval(c, 14, 14, 4, 3, Colour.LEAF);
  oval(c, 25, 21, 4, 4, Colour.WATER);
  stamp(c, 11, 18, ['l..', '.l.', '..l'], { l: Colour.LEAF_DARK });
  // the road to the new place
  for (const [x, y] of [
    [11, 22],
    [13, 21],
    [15, 20],
    [17, 18],
    [19, 16],
    [21, 14],
  ])
    c.set(x, y, Colour.OUTLINE);
  stamp(c, 22, 9, ['r...r', '.r.r.', '..r..', '.r.r.', 'r...r'], { r: Colour.BANNER });
  // the roller on the left
  rect(c, 4, 4, 8, 28, Colour.LINEN_DARK);
  rect(c, 4, 4, 5, 28, PARCHMENT.hi);
  rect(c, 6, 4, 6, 28, PARCHMENT.mid);
  for (const y of [2, 29]) rect(c, 5, y, 7, y + 1, Colour.WOOD);
  c.outline();
  return c;
}

/** Civil Code: a stone tablet of laws, rounded at the top, its lines carved into it. */
function civilCode(): PixelCanvas {
  const c = canvas('civil-code');
  lathe(c, 16, 2, [5, 8, 9.5, 10, 10.5, ...Array<number>(22).fill(11)], STONE);
  rect(c, 15, 4, 16, 27, Colour.STONE_L);
  for (let y = 8; y <= 25; y += 3)
    for (const [x0, x1] of [
      [8, 13],
      [18, 23],
    ])
      rect(c, x0, y, y === 26 ? x0 + 2 : x1, y, Colour.STONE_R);
  rect(c, 6, 28, 26, 28, Colour.STONE_R);
  c.outline();
  return c;
}

/** Penicillin: a round flask of green medicine, corked, with bubbles. */
function penicillin(): PixelCanvas {
  const c = canvas('penicillin');
  lathe(c, 16, 2, [3, 3, 3], { hi: Colour.PLANK_TOP, mid: Colour.PLANK_L, dark: Colour.PLANK_R });
  lathe(c, 16, 5, [2.5, 2.5, 2.5, 2.5, 3, 3.5], { hi: Colour.SPARKLE, mid: Colour.WATER_LIGHT, dark: Colour.WATER });
  disc(c, 16, 20, 10, Colour.WATER_LIGHT, Colour.WATER);
  disc(c, 16, 20, 8.6, Colour.WATER_LIGHT);
  for (let y = 16; y <= 30; y++)
    for (let x = 6; x <= 26; x++) {
      const [dx, dy] = [x - 16, y - 20];
      if (dx * dx + dy * dy > 8.6 * 8.6) continue;
      c.set(x, y, y === 16 ? GREEN.hi : dx + dy > 6 ? GREEN.dark : GREEN.mid);
    }
  c.outline();
  oval(c, 11, 14, 1.2, 2.2, Colour.SPARKLE);
  for (const [x, y] of [
    [18, 20],
    [14, 23],
    [20, 25],
  ])
    c.set(x, y, GREEN.hi);
  sparkle(c, 25, 7, 1);
  return c;
}

export const CITY_DRAWINGS = { truceAgreement, cityTeleporter, civilCode, penicillin };
