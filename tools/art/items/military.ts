// Military boosts: the War Horn and the Olifant, a gold-banded ivory horn (attack), the Gambeson and the Hauberk, still
// drawn as a leather corselet and a steel one trimmed in gold (defence), the Imperial Banner, Bernward's Hammer on a block
// of marble (a second building queue), Elizabeth's Bread and Granary, still drawn as a flame in a goblet and a grander
// jewelled one (upkeep), and the marshal's signet and his sealed charter (training cost). The icons still drawn as the
// old items are redrawn in docs/features/item-names.md, phase 5.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { type PixelCanvas } from '../pixel.ts';
import { disc, oval, rect } from '../shapes.ts';
import { canvas, flame, GOLD, lathe, LEATHER, RED, rod, scroll, sparkle, stamp, STEEL, STONE, type Tone, writing } from './common.ts';

/** A horn curving from its tip at the upper left to its mouth at the lower right, banded in `band`, slung on a strap. */
function horn(seed: string, body: Tone, tip: Tone, band: Tone): () => PixelCanvas {
  return () => {
    const c = canvas(seed);
    const at = (t: number): [number, number] => {
      const s = 1 - t;
      return [s * s * 4 + 2 * s * t * 6 + t * t * 25, s * s * 5 + 2 * s * t * 27 + t * t * 18];
    };
    // the strap, from near the tip to near the mouth, looping above
    for (let t = 0; t <= 1; t += 0.02) {
      const [ax, ay] = at(0.3);
      const [bx, by] = at(0.85);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 13;
      disc(c, x, y, 0.8, LEATHER.dark);
    }
    for (let t = 0; t <= 1; t += 0.01) {
      const [x, y] = at(t);
      const r = 0.9 + 4.2 * t ** 1.6;
      const near = (k: number) => Math.abs(t - k) < 0.03;
      const tone = t < 0.18 ? tip : near(0.5) || near(0.78) ? band : body;
      disc(c, x, y, r, tone.mid, tone.dark);
      if (r > 1.5) disc(c, x - r * 0.35, y - r * 0.35, r * 0.3, tone.hi);
    }
    // the mouth, facing right
    const [mx, my] = at(1);
    oval(c, mx + 1, my, 2.2, 5.2, band.mid);
    oval(c, mx + 1.5, my + 0.5, 1.2, 3.8, Colour.OUTLINE);
    c.outline();
    return c;
  };
}

/** A cuirass seen from the front: shoulders, a waist and a skirt of strips; `trim` edges it. */
function corselet(seed: string, tone: Tone, trim?: Tone): () => PixelCanvas {
  return () => {
    const c = canvas(seed);
    const widths = [9, 10, 10.5, 10.5, 10, 8.5, 8, 8, 8, 8, 8, 7.5, 7.5, 7, 7, 7, 7.5, 7.5];
    lathe(c, 16, 4, widths, tone);
    // the neck opening and the arm holes
    for (const [y, hw] of [
      [4, 4],
      [5, 3],
      [6, 2],
    ])
      for (let x = 16 - hw; x < 16 + hw; x++) c.set(x, y, Colour.CLEAR);
    // the ridge down the middle and the belt
    rect(c, 16, 8, 16, 20, tone.dark);
    rect(c, 15, 8, 15, 19, tone.hi);
    rect(c, 9, 21, 22, 22, trim ? trim.mid : LEATHER.dark);
    if (trim) {
      rect(c, 14, 7, 17, 7, trim.mid);
      c.set(15, 21, trim.hi);
      stamp(c, 14, 11, ['.hh.', 'hmmd', 'hmmd', '.dd.'], { h: trim.hi, m: trim.mid, d: trim.dark });
    }
    // the skirt of strips below the belt
    for (let x = 9; x <= 21; x += 3) {
      rect(c, x, 23, x + 1, 28, tone.mid);
      c.set(x, 23, tone.hi);
      if (trim) rect(c, x, 28, x + 1, 28, trim.mid);
    }
    c.outline();
    return c;
  };
}

/** Imperial Banner: a red war banner with a gold sun, swallow-tailed, on a spear-tipped pole. */
function imperialBanner(): PixelCanvas {
  const c = canvas('imperial-banner');
  rod(c, [8, 4], [8, 30], 2, Colour.WOOD);
  c.poly(
    [
      [9, 6],
      [28, 6],
      [24, 13],
      [28, 21],
      [9, 21],
    ],
    (x) => (x % 6 < 2 ? RED.hi : x % 6 > 3 ? RED.dark : RED.mid),
  );
  stamp(c, 13, 9, ['g.g.g', '.ggg.', 'ggogg', '.ggg.', 'g.g.g'], { g: Colour.GOLD, o: Colour.FIRE_HI });
  rect(c, 9, 6, 27, 6, Colour.GOLD);
  c.poly(
    [
      [6, 4],
      [8, 0],
      [10, 4],
    ],
    GOLD.mid,
  );
  c.outline();
  c.set(8, 1, GOLD.hi);
  return c;
}

/** Bernward's Hammer: a sculptor's hammer and chisel resting on a block of marble. */
function bernwardsHammer(): PixelCanvas {
  const c = canvas('bernwards-hammer');
  // the marble block, its top and two faces
  c.poly(
    [
      [6, 24],
      [16, 21],
      [28, 24],
      [18, 27],
    ],
    STONE.hi,
  );
  c.poly(
    [
      [6, 24],
      [18, 27],
      [18, 31],
      [6, 28],
    ],
    STONE.mid,
  );
  c.poly(
    [
      [18, 27],
      [28, 24],
      [28, 28],
      [18, 31],
    ],
    STONE.dark,
  );
  // the chisel, its blade on the marble
  rod(c, [24, 7], [24, 19], 3, Colour.WOOD);
  rod(c, [24, 18], [24, 24], 2, STEEL.mid);
  // the hammer: its handle across the block, its head raised
  rod(c, [21, 23], [9, 9], 3, Colour.WOOD);
  c.poly(
    [
      [2, 9],
      [10, 2],
      [16, 9],
      [8, 16],
    ],
    STEEL.dark,
  );
  c.poly(
    [
      [2, 9],
      [10, 2],
      [12, 4],
      [4, 11],
    ],
    STEEL.mid,
  );
  c.outline();
  c.line([3, 9], [9, 3], STEEL.hi);
  c.line([23, 8], [23, 17], Colour.PLANK_TOP);
  return c;
}

/** A goblet with a flame in it; the grand one is wider, set with red stones, its flame higher. */
function goblet(seed: string, grand: boolean): () => PixelCanvas {
  return () => {
    const c = canvas(seed);
    const cup = grand ? [8, 8, 7.5, 7, 6.5, 6, 5, 4, 3] : [7, 7, 6.5, 6, 5.5, 4.5, 3.5, 2.5];
    const y0 = 14;
    lathe(c, 16, y0, [...cup, 1.5, 1.5, 2.5, 1.5, 1.5, 3.5, 5.5, 6.5], GOLD);
    // the cup's rim and the flame rising from it
    oval(c, 16, y0, cup[0] ?? 7, 1.6, GOLD.dark);
    flame(c, 16, y0, grand ? 13 : 9);
    if (grand)
      for (const x of [11, 16, 21]) {
        c.set(x, y0 + 4, Colour.BANNER);
        c.set(x, y0 + 3, Colour.BANNER_HI);
      }
    c.outline();
    if (grand) {
      sparkle(c, 6, 6);
      sparkle(c, 27, 10, 1);
    }
    return c;
  };
}

/** A round red wax seal centred on (x, y), radius `r`, its rim pressed into waves and a crown in its middle. */
function bigSeal(c: PixelCanvas, x: number, y: number, r: number) {
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) disc(c, x + Math.cos(a) * r * 0.85, y + Math.sin(a) * r * 0.85, r * 0.3, RED.mid, RED.dark);
  disc(c, x, y, r * 0.95, RED.mid, RED.dark);
  if (r < 6) return;
  disc(c, x, y, r * 0.65, RED.dark);
  disc(c, x - 0.3, y - 0.3, r * 0.55, RED.mid);
  stamp(c, x - 2, y - 2, ['d.d.d', 'ddddd', 'ddddd'], { d: RED.dark });
  c.set(x - r * 0.5, y - r * 0.6, RED.hi);
  c.set(x - r * 0.6, y - r * 0.5, RED.hi);
}

/** Marshal's Seal: a large red wax seal on two ribbons. */
function marshalsSeal(): PixelCanvas {
  const c = canvas('marshals-seal');
  c.poly(
    [
      [10, 14],
      [15, 16],
      [11, 30],
      [9, 27],
      [6, 29],
    ],
    Colour.BLUE,
  );
  c.poly(
    [
      [17, 16],
      [22, 14],
      [26, 29],
      [23, 27],
      [21, 30],
    ],
    Colour.BLUE_DARK,
  );
  bigSeal(c, 16, 11, 9);
  c.outline();
  return c;
}

/** Marshal's Charter: a written charter with a red seal hanging from it on cords. */
function marshalsCharter(): PixelCanvas {
  const c = canvas('marshals-charter');
  scroll(c, 7, 2, 24, 23);
  writing(c, 10, 21, 6, 16);
  c.line([14, 23], [15, 26], Colour.BLUE);
  c.line([18, 23], [17, 26], Colour.BLUE_DARK);
  bigSeal(c, 16, 27, 4);
  c.outline();
  return c;
}

export const MILITARY_DRAWINGS = {
  warHorn: horn('war-horn', { hi: Colour.WALL_TOP, mid: Colour.LINEN, dark: Colour.LINEN_DARK }, LEATHER, LEATHER),
  olifant: horn('olifant', { hi: Colour.SPARKLE, mid: Colour.WOOL, dark: Colour.LINEN }, GOLD, GOLD),
  gambeson: corselet('gambeson', LEATHER),
  hauberk: corselet('hauberk', STEEL, GOLD),
  imperialBanner,
  bernwardsHammer,
  elizabethsBread: goblet('elizabeths-bread', false),
  elizabethsGranary: goblet('elizabeths-granary', true),
  marshalsSeal,
  marshalsCharter,
};
