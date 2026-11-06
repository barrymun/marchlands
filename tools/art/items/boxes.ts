// Boxes: the three medal boxes are chests of wood bound in bronze, of iron bound in steel and of gold set with stones,
// each with a medal on its lock; the Hero Package is a red pouch tied with gold cord; the Welcome Package a gift box.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { oval, rect } from '../shapes.ts';
import { BLUE, BRONZE, canvas, GOLD, lathe, RED, sparkle, stamp, STEEL, type Tone, WOOD } from './common.ts';

/** A chest seen from the front: a rounded lid over the body, `body` planks bound in `band`, a lock with a medal on it. */
function chest(seed: string, body: Tone, band: Tone, { gems = false } = {}): () => PixelCanvas {
  return () => {
    const c = canvas(seed);
    // the lid, curved, then the body
    for (let y = 8; y <= 15; y++) {
      const hw = 11 * Math.sqrt(1 - ((15 - y) / 8.5) ** 2);
      rect(c, Math.round(16 - hw), y, Math.round(16 + hw) - 1, y, y < 11 ? body.hi : body.mid);
    }
    rect(c, 5, 16, 26, 28, body.mid);
    rect(c, 5, 16, 6, 28, body.hi);
    rect(c, 25, 16, 26, 28, body.dark);
    for (const y of [20, 24]) rect(c, 5, y, 26, y, body.dark);
    // the bands: round the lid's edge, down each side and along the bottom
    rect(c, 5, 15, 26, 16, band.mid);
    rect(c, 5, 15, 26, 15, band.hi);
    for (const x of [8, 22]) {
      rect(c, x, 9, x + 1, 28, band.mid);
      rect(c, x, 9, x, 28, band.hi);
    }
    rect(c, 5, 28, 26, 28, band.dark);
    // the lock plate, with a medal on it
    rect(c, 13, 14, 18, 21, band.dark);
    rect(c, 14, 15, 17, 20, band.mid);
    stamp(c, 14, 16, ['.rr.', 'gmmg', 'gmmg', '.gg.'], { r: Colour.BANNER, g: GOLD.dark, m: GOLD.hi });
    if (gems)
      for (const x of [11, 20]) {
        c.set(x, 12, Colour.BANNER);
        c.set(x, 11, Colour.BANNER_HI);
        c.set(x, 24, Colour.BLUE);
      }
    c.outline();
    if (gems) sparkle(c, 26, 7);
    return c;
  };
}

/** Hero Package: a red pouch, its neck tied with gold cord. */
function heroPackage(): PixelCanvas {
  const c = canvas('hero-package');
  lathe(c, 16, 4, [4, 5, 4, 3, 3, 4, 6, 8, 9.5, 10.5, 11, 11.5, 11.5, 11.5, 11.5, 11, 10.5, 10, 9, 8, 6.5, 4.5], RED);
  // the cord round its neck, with its ends hanging
  rect(c, 12, 8, 19, 9, GOLD.mid);
  rect(c, 12, 8, 19, 8, GOLD.hi);
  c.line([18, 10], [21, 15], GOLD.mid);
  c.line([19, 10], [22, 16], GOLD.dark);
  // a gold sword stitched on its front
  stamp(c, 14, 14, ['..g..', '..g..', '..g..', '..g..', 'ggggg', '..d..', '..d..'], { g: GOLD.mid, d: GOLD.dark });
  c.outline();
  return c;
}

/** Welcome Package: a gift box tied with a red ribbon and a bow. */
function welcomePackage(): PixelCanvas {
  const c = canvas('welcome-package');
  // the box: its top and two faces
  c.poly(
    [
      [3, 13],
      [15, 9],
      [29, 13],
      [17, 17],
    ],
    BLUE.hi,
  );
  c.poly(
    [
      [3, 13],
      [17, 17],
      [17, 30],
      [3, 26],
    ],
    BLUE.mid,
  );
  c.poly(
    [
      [17, 17],
      [29, 13],
      [29, 26],
      [17, 30],
    ],
    BLUE.dark,
  );
  // the ribbon round it
  c.poly(
    [
      [8, 11.5],
      [10, 11],
      [24, 15.5],
      [22, 16],
    ],
    RED.mid,
  );
  c.poly(
    [
      [22, 11.5],
      [24, 12],
      [12, 15.5],
      [10, 15],
    ],
    RED.mid,
  );
  rect(c, 9, 15, 10, 28, RED.mid);
  rect(c, 23, 15, 24, 28, RED.dark);
  // the bow
  oval(c, 12.5, 9, 3.5, 2.5, RED.mid);
  oval(c, 19.5, 9, 3.5, 2.5, RED.dark);
  oval(c, 12, 8.5, 1.5, 1, RED.hi);
  rect(c, 15, 9, 17, 11, RED.hi);
  c.outline();
  return c;
}

export const BOX_DRAWINGS = {
  juniorMedalBox: chest('junior-medal-box', WOOD, BRONZE),
  mediumMedalBox: chest('medium-medal-box', { hi: Colour.SLATE_HI, mid: Colour.SLATE_L, dark: Colour.SLATE_D }, STEEL),
  seniorMedalBox: chest('senior-medal-box', GOLD, { hi: Colour.SPARKLE, mid: Colour.FIRE_HI, dark: Colour.GOLD_DARK }, { gems: true }),
  heroPackage,
  welcomePackage,
};
