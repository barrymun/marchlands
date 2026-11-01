// Speed-ups: the six Guidelines are a pile of books that grows with the time they save, the top book finer at each
// step; Napoleon's Diary is a strapped campaign notebook with a quill; Archimedes' Note a scroll of geometry under a
// pair of dividers.

import type { PixelCanvas } from '../pixel.ts';
import { oval, rect } from '../shapes.ts';
import { BLUE, canvas, corners, GOLD, GREEN, LEATHER, lyingBook, quill, RED, rod, scroll, sparkle, stamp, tome, type Tone } from './common.ts';

/** The books of a pile, bottom first: each one's cover. */
const PILE: readonly Tone[] = [LEATHER, RED, BLUE, GREEN];

/** A ribbon bookmark hanging from a book's fore-edge at (x, y). */
function bookmark(c: PixelCanvas, x: number, y: number) {
  rect(c, x, y, x, y + 3, 'banner');
  c.set(x - 1, y + 4, 'bannerDark');
  c.set(x + 1, y + 4, 'bannerDark');
}

/**
 * Guidelines: `books` books in a pile (each a little narrower and offset), the top one trimmed in gold from the fifth
 * step (`fine`), with a gem and a glow at the last (`grand`).
 */
function guidelines(seed: string, books: number, { fine = false, grand = false } = {}): () => PixelCanvas {
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
      stamp(c, gx - 1, top.y - 3, ['oho', 'odo'], { o: 'goldDark', h: 'waterLight', d: 'blue' });
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

/** Napoleon's Diary: a dark blue campaign notebook, held shut by a strap, with a quill across it. */
function napoleonsDiary(): PixelCanvas {
  const c = canvas('napoleons-diary');
  const n = { hi: 'blueHi', mid: 'blueDark', dark: 'blueEdge' } as const;
  tome(c, 3, 5, 19, 27, n);
  corners(c, 3, 5, 19, 27);
  // the strap round it and its buckle
  rect(c, 3, 17, 21, 18, 'leatherDark');
  rect(c, 15, 16, 17, 19, GOLD.mid);
  c.set(16, 17, 'leatherDark');
  // a laurel wreath on the cover
  stamp(c, 8, 8, ['g...g', 'g...g', '.g.g.', '..h..'], { g: 'gold', h: 'fireHi' });
  rect(c, 12, 27, 12, 29, 'banner');
  quill(c, [18, 30], [27, 3]);
  c.outline();
  c.line([19, 28], [26, 6], 'linenDark');
  return c;
}

/** Archimedes' Note: a scroll of circles and triangles, with a pair of dividers lying across it. */
function archimedesNote(): PixelCanvas {
  const c = canvas('archimedes-note');
  scroll(c, 6, 4, 23, 28);
  // a circle with a triangle drawn in it
  oval(c, 14.5, 15.5, 6, 6, 'blueDark');
  oval(c, 14.5, 15.5, 5, 5, 'linen');
  c.line([14, 10], [10, 19], 'blueDark');
  c.line([14, 10], [19, 19], 'blueDark');
  c.line([10, 19], [19, 19], 'blueDark');
  rect(c, 9, 24, 19, 24, 'linenDark');
  // the dividers: a hinge at the top, two steel legs
  rod(c, [23, 6], [18, 28], 3.6, 'steelDark');
  rod(c, [23, 6], [28, 27], 3.6, 'steel');
  c.outline();
  c.line([24, 9], [27, 24], 'steelHi');
  stamp(c, 22, 4, ['.o.', 'ogo', '.o.'], { o: 'outline', g: 'gold' });
  return c;
}

export const SPEEDUP_DRAWINGS = {
  beginner: guidelines('beginner-guidelines', 1),
  primary: guidelines('primary-guidelines', 2),
  intermediate: guidelines('intermediate-guidelines', 3),
  senior: guidelines('senior-guidelines', 4),
  master: guidelines('master-guidelines', 4, { fine: true }),
  ultimate: guidelines('ultimate-guidelines', 4, { fine: true, grand: true }),
  napoleonsDiary,
  archimedesNote,
};
