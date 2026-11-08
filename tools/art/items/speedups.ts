// Speed-ups: the six speed-up books (Novice's Notes … Villard's Sketchbook) are a pile of books that grows with the time they save, the top book finer at each
// step; Otto's Muster Roll is a strapped campaign notebook with a quill; Henry's Castle Law a scroll of geometry under a
// pair of dividers.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { oval, rect } from '../shapes.ts';
import { BLUE, canvas, corners, GOLD, GREEN, LEATHER, lyingBook, quill, RED, rod, scroll, sparkle, stamp, tome, type Tone } from './common.ts';

/** The books of a pile, bottom first: each one's cover. */
const PILE: readonly Tone[] = [LEATHER, RED, BLUE, GREEN];

/** A ribbon bookmark hanging from a book's fore-edge at (x, y). */
function bookmark(c: PixelCanvas, x: number, y: number) {
  rect(c, x, y, x, y + 3, Colour.BANNER);
  c.set(x - 1, y + 4, Colour.BANNER_DARK);
  c.set(x + 1, y + 4, Colour.BANNER_DARK);
}

/**
 * A speed-up book: `books` books in a pile (each a little narrower and offset), the top one trimmed in gold from the fifth
 * step (`fine`), with a gem and a glow at the last (`grand`).
 */
function bookPile(seed: string, books: number, { fine = false, grand = false } = {}): () => PixelCanvas {
  return () => {
    const c = canvas(seed);
    const t = books === 1 ? 8 : books === 2 ? 7 : books === 3 ? 6 : 5;
    const base = 27;
    let top = { x: 0, y: 0, w: 0 };
    for (let i = 0; i < books; i++) {
      const w = (books === 1 ? 24 : 22) - i * 2;
      const x = 3 + (i % 2 === 0 ? i : i + 1);
      const y = base - i * t - t + 1;
      const tone = i === books - 1 && fine ? (grand ? RED : BLUE) : (PILE[i] ?? LEATHER);
      lyingBook(c, x, y, w, t, tone);
      top = { x, y, w };
    }
    if (fine) {
      // gold bands across the top book's cover and its fore-edge
      for (let i = 1; i <= 3; i++) {
        c.set(top.x + 3 + i, top.y - i, GOLD.mid);
        c.set(top.x + top.w - 4 + i, top.y - i, GOLD.mid);
      }
      c.set(top.x + 3, top.y, GOLD.hi);
      c.set(top.x + top.w - 4, top.y, GOLD.hi);
    }
    if (grand) {
      const gx = top.x + Math.floor(top.w / 2) + 2;
      stamp(c, gx - 1, top.y - 3, ['oho', 'odo'], { o: Colour.GOLD_DARK, h: Colour.WATER_LIGHT, d: Colour.BLUE });
    }
    if (books > 1) bookmark(c, top.x + top.w - 5, top.y + t);
    c.outline();
    c.centre();
    if (grand) {
      sparkle(c, 26, 5);
      sparkle(c, 4, 9, 1);
    }
    return c;
  };
}

/** Otto's Muster Roll: a dark blue campaign notebook, held shut by a strap, with a quill across it. */
function ottosMusterRoll(): PixelCanvas {
  const c = canvas('ottos-muster-roll');
  const n = { hi: Colour.BLUE_HI, mid: Colour.BLUE_DARK, dark: Colour.BLUE_EDGE } as const;
  tome(c, 3, 5, 19, 27, n);
  corners(c, 3, 5, 19, 27);
  // the strap round it and its buckle
  rect(c, 3, 17, 21, 18, Colour.LEATHER_DARK);
  rect(c, 15, 16, 17, 19, GOLD.mid);
  c.set(16, 17, Colour.LEATHER_DARK);
  // a laurel wreath on the cover
  stamp(c, 8, 8, ['g...g', 'g...g', '.g.g.', '..h..'], { g: Colour.GOLD, h: Colour.FIRE_HI });
  rect(c, 12, 27, 12, 29, Colour.BANNER);
  quill(c, [18, 30], [27, 3]);
  c.outline();
  c.line([19, 28], [26, 6], Colour.LINEN_DARK);
  return c;
}

/** Henry's Castle Law: a scroll of circles and triangles, with a pair of dividers lying across it. */
function henrysCastleLaw(): PixelCanvas {
  const c = canvas('henrys-castle-law');
  scroll(c, 6, 4, 23, 28);
  // a circle with a triangle drawn in it
  oval(c, 14.5, 15.5, 6, 6, Colour.BLUE_DARK);
  oval(c, 14.5, 15.5, 5, 5, Colour.LINEN);
  c.line([14, 10], [10, 19], Colour.BLUE_DARK);
  c.line([14, 10], [19, 19], Colour.BLUE_DARK);
  c.line([10, 19], [19, 19], Colour.BLUE_DARK);
  rect(c, 9, 24, 19, 24, Colour.LINEN_DARK);
  // the dividers: a hinge at the top, two steel legs
  rod(c, [23, 6], [18, 28], 3.6, Colour.STEEL_DARK);
  rod(c, [23, 6], [28, 27], 3.6, Colour.STEEL);
  c.outline();
  c.line([24, 9], [27, 24], Colour.STEEL_HI);
  stamp(c, 22, 4, ['.o.', 'ogo', '.o.'], { o: Colour.OUTLINE, g: Colour.GOLD });
  return c;
}

export const SPEEDUP_DRAWINGS = {
  novicesNotes: bookPile('novices-notes', 1),
  apprenticesNotes: bookPile('apprentices-notes', 2),
  journeymansNotes: bookPile('journeymans-notes', 3),
  mastersNotes: bookPile('masters-notes', 4),
  grandmastersNotes: bookPile('grandmasters-notes', 4, { fine: true }),
  villardsSketchbook: bookPile('villards-sketchbook', 4, { fine: true, grand: true }),
  ottosMusterRoll,
  henrysCastleLaw,
};
