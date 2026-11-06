// Hero items: a vial of holy water (resetting a hero's points), Excalibur (attack), and books for the rest: The Wealth
// of Nations with its gold (politics), The Art of War on bamboo slips (intelligence), and three books of experience
// that grow with it, Anabasis plain, the Epitome of Military Science bound in gold, On War the grandest.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { disc, rect } from '../shapes.ts';
import { BLUE, canvas, coin, corners, GOLD, GREEN, lathe, LEATHER, RED, rod, sparkle, stamp, STEEL, tome } from './common.ts';

/** Holy Water: a slender corked vial of blue water, glinting. */
function holyWater(): PixelCanvas {
  const c = canvas('holy-water');
  lathe(c, 16, 2, [2.5, 2.5, 2.5], { hi: Colour.PLANK_TOP, mid: Colour.PLANK_L, dark: Colour.PLANK_R });
  lathe(c, 16, 5, [3.5, 2, 2, 2.5, 3.5, 4.5, 5, 5.5, 5.5], { hi: Colour.SPARKLE, mid: Colour.WATER_LIGHT, dark: Colour.WATER });
  lathe(c, 16, 14, [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 5.5, 5, 4], { hi: Colour.WATER_LIGHT, mid: Colour.WATER, dark: Colour.WATER_DEEP });
  rect(c, 11, 14, 20, 14, Colour.WATER_LIGHT);
  c.outline();
  rect(c, 12, 16, 12, 24, Colour.SPARKLE);
  sparkle(c, 24, 9);
  sparkle(c, 7, 18, 1);
  return c;
}

/** Excalibur: a gleaming sword, point up and to the right, its gold hilt set with a blue stone. */
function excalibur(): PixelCanvas {
  const c = canvas('excalibur');
  rod(c, [10, 22], [28, 4], 4, STEEL.mid);
  rod(c, [5, 17], [15, 27], 3, GOLD.mid);
  rod(c, [9, 23], [5, 27], 3, LEATHER.mid);
  disc(c, 4, 28, 2, GOLD.mid);
  c.outline();
  c.line([11, 20], [27, 4], STEEL.hi);
  c.line([13, 22], [28, 6], STEEL.dark);
  c.set(4, 28, Colour.BLUE_HI);
  c.set(10, 22, Colour.BLUE);
  sparkle(c, 23, 6);
  return c;
}

/** The Wealth of Nations: a green book with a gold coin on its cover, more coins before it. */
function wealthOfNations(): PixelCanvas {
  const c = canvas('wealth-of-nations');
  tome(c, 6, 3, 22, 25, GREEN);
  corners(c, 6, 3, 22, 25);
  coin(c, 15, 13);
  coin(c, 21, 26);
  coin(c, 26, 28);
  c.outline();
  return c;
}

/** The Art of War: a scroll of bamboo slips, bound with cord, half rolled up. */
function artOfWar(): PixelCanvas {
  const c = canvas('art-of-war');
  for (let x = 3; x <= 21; x += 2) {
    rect(c, x, 6, x, 26, x % 4 === 1 ? Colour.THATCH_HI : Colour.THATCH_L);
    rect(c, x + 1, 6, x + 1, 26, Colour.THATCH_D);
    for (let y = 9; y <= 22; y += 3) c.set(x, y, Colour.OUTLINE);
  }
  // the rolled part
  disc(c, 25, 16, 6, Colour.THATCH_L, Colour.THATCH_D);
  rect(c, 22, 6, 28, 26, Colour.THATCH_L);
  rect(c, 22, 6, 23, 26, Colour.THATCH_HI);
  rect(c, 27, 6, 28, 26, Colour.THATCH_D);
  for (const y of [9, 23]) rect(c, 3, y, 28, y, Colour.BANNER);
  c.outline();
  return c;
}

/** Anabasis: a plain leather book. */
function anabasis(): PixelCanvas {
  const c = canvas('anabasis');
  tome(c, 8, 5, 22, 26, LEATHER);
  stamp(c, 13, 11, ['.ddd.', 'd...d', 'd...d', '.ddd.'], { d: LEATHER.dark });
  c.outline();
  return c;
}

/** Epitome of Military Science: a blue book with gold corners and a sword on its cover. */
function epitome(): PixelCanvas {
  const c = canvas('epitome-of-military-science');
  tome(c, 6, 3, 23, 27, BLUE);
  corners(c, 6, 3, 23, 27);
  stamp(c, 13, 7, ['...g...', '...g...', '...g...', '...g...', '...g...', '...g...', '.ggggg.', '...d...', '...d...', '..ddd..'], { g: GOLD.hi, d: GOLD.mid });
  c.outline();
  return c;
}

/** On War: a thick red book with gold corners, a clasp and crossed swords on its cover. */
function onWar(): PixelCanvas {
  const c = canvas('on-war');
  tome(c, 4, 2, 24, 28, RED);
  corners(c, 4, 2, 24, 28);
  stamp(c, 9, 8, ['g.......g', '.g.....g.', '..g...g..', '...g.g...', '....g....', '...g.g...', '.ddd.ddd.', '.d.....d.', 'd.......d'], {
    g: GOLD.hi,
    d: GOLD.mid,
  });
  rect(c, 22, 14, 26, 17, GOLD.mid);
  rect(c, 22, 14, 26, 14, GOLD.hi);
  c.outline();
  sparkle(c, 27, 4);
  return c;
}

export const HERO_DRAWINGS = { holyWater, excalibur, wealthOfNations, artOfWar, anabasis, epitome, onWar };
