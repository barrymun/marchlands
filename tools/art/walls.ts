// The walls round the city, as frame pieces in the oblique top-down view (client/web/src/lib/game-art.ts, WALL_PIECES):
// `wall` (16×16) repeats along the back and front walls and `side` (16×16) down the side walls, so both tile with no
// seam; `corner` (24×24) is a tower and `gate` (32×32) the gatehouse. Band 1 (levels 1-3) is a wooden palisade, band 2
// low stone walls, band 3 high stone walls with towers, band 4 a crenellated fortress with banners.

import { IsoCanvas } from './iso.ts';
import type { WallPiece } from '../../client/web/src/lib/game-art.ts';
import { Colour } from '../../client/web/src/lib/palette.ts';

type Fill = Colour | ((x: number, y: number) => Colour);

function rect(c: IsoCanvas, x: number, y: number, w: number, h: number, fill: Fill) {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) c.set(xx, yy, typeof fill === 'function' ? fill(xx, yy) : fill);
}

/** Dressed stone: mortar lines every 3 rows from `top`, joints staggered every 8 columns. */
const masonry =
  (top: number, face: Colour = Colour.STONE_L) =>
  (x: number, y: number): Colour => {
    const row = y - top;
    if (row % 3 === 2) return Colour.STONE_R;
    const course = Math.floor(row / 3);
    return (x + (course % 2) * 4) % 8 === 0 ? Colour.STONE_R : face;
  };

/** Upright logs, two pixels each, with pointed tops at `top`. */
function palisade(c: IsoCanvas, x0: number, w: number, top: number, bottom: number) {
  for (let x = x0; x < x0 + w; x += 2) {
    rect(c, x, top + 1, 1, bottom - top - 1, Colour.PLANK_L);
    rect(c, x + 1, top + 1, 1, bottom - top - 1, Colour.PLANK_R);
    c.set(x, top, Colour.PLANK_TOP);
  }
  rect(c, x0, top + Math.floor((bottom - top) / 2), w, 1, Colour.LOG_DARK);
}

/** A stretch of wall seen from the front: its walkway on top, its face below, at a band's height. */
function wall(band: number): IsoCanvas {
  const c = new IsoCanvas(16, 0);
  if (band === 1) palisade(c, 0, 16, 3, 16);
  else {
    const top = band === 2 ? 7 : band === 3 ? 2 : 3;
    if (band === 4) rect(c, 0, 0, 16, 3, (x) => (x % 4 < 2 ? Colour.STONE_TOP : Colour.CLEAR));
    rect(c, 0, top, 16, 2, Colour.STONE_TOP);
    rect(c, 0, top + 2, 16, 16 - top - 2, masonry(top + 2));
    if (band === 4) rect(c, 7, 8, 1, 4, Colour.OUTLINE);
  }
  c.outline({ edges: false });
  return c;
}

/** A stretch of the left wall seen from above: the walkway, the outer face's edge and the inner shadow. */
function side(band: number): IsoCanvas {
  const c = new IsoCanvas(16, 0);
  if (band === 1) {
    // log ends, seen from above
    for (let y = 0; y < 16; y += 4) {
      rect(c, 5, y, 6, 4, Colour.PLANK_R);
      rect(c, 6, y + 1, 4, 2, Colour.LOG_END);
    }
  } else {
    const [x0, x1] = band === 2 ? [5, 11] : [3, 13];
    rect(c, x0, 0, x1 - x0, 16, (_x, y) => (y % 8 === 0 ? Colour.STONE_L : Colour.STONE_TOP));
    rect(c, x0 - 1, 0, 1, 16, Colour.STONE_L);
    rect(c, x1, 0, 1, 16, Colour.STONE_R);
    if (band === 4) rect(c, 1, 0, 2, 16, (_x, y) => (y % 4 < 2 ? Colour.STONE_TOP : Colour.CLEAR));
  }
  c.outline({ edges: false });
  return c;
}

/** A corner tower. */
function corner(band: number): IsoCanvas {
  const c = new IsoCanvas(24, 0);
  if (band === 1) {
    // a wooden watchtower
    rect(c, 6, 10, 1, 14, Colour.WOOD);
    rect(c, 17, 10, 1, 14, Colour.WOOD);
    c.line([6, 22], [17, 12], Colour.LOG_DARK);
    rect(c, 4, 5, 16, 4, Colour.PLANK_TOP);
    rect(c, 4, 9, 16, 2, Colour.PLANK_L);
    palisade(c, 4, 16, 2, 5);
  } else {
    const [x0, x1, top] = band === 2 ? [5, 19, 7] : [3, 21, 5];
    if (band >= 3) rect(c, x0, top - 3, x1 - x0, 3, (x) => ((x - x0) % 4 < 2 ? Colour.STONE_TOP : Colour.CLEAR));
    rect(c, x0, top, x1 - x0, 5, Colour.STONE_TOP);
    rect(c, x0, top + 5, Math.round((x1 - x0) * 0.7), 24 - top - 5, masonry(top + 5));
    rect(c, x0 + Math.round((x1 - x0) * 0.7), top + 5, x1 - x0 - Math.round((x1 - x0) * 0.7), 24 - top - 5, masonry(top + 5, Colour.STONE_R));
    if (band >= 3) rect(c, Math.floor((x0 + x1) / 2) - 1, top + 9, 1, 4, Colour.OUTLINE);
    if (band === 4) c.banner([12, top - 2], 6);
  }
  c.outline();
  return c;
}

/** The gatehouse in the front wall. */
function gate(band: number): IsoCanvas {
  const c = new IsoCanvas(32, 0);
  /** Wooden doors in an opening. */
  const doors = (x: number, y: number, w: number, h: number) => {
    rect(c, x, y, w, h, (xx) => (xx % 2 ? Colour.PLANK_R : Colour.PLANK_L));
    rect(c, x, y + 2, w, 1, Colour.LOG_DARK);
    rect(c, x, y + h - 3, w, 1, Colour.LOG_DARK);
    rect(c, x + Math.floor(w / 2), y, 1, h, Colour.OUTLINE);
  };
  if (band === 1) {
    palisade(c, 0, 32, 12, 32);
    rect(c, 7, 6, 2, 26, Colour.WOOD);
    rect(c, 23, 6, 2, 26, Colour.WOOD);
    rect(c, 6, 9, 20, 2, Colour.WOOD);
    doors(9, 13, 14, 19);
  } else if (band === 2) {
    rect(c, 0, 9, 32, 2, Colour.STONE_TOP);
    rect(c, 0, 11, 32, 21, masonry(11));
    rect(c, 10, 15, 12, 17, Colour.OUTLINE);
    doors(11, 17, 10, 15);
  } else {
    // two towers flanking an arch
    rect(c, 8, 8, 16, 2, Colour.STONE_TOP);
    rect(c, 8, 10, 16, 22, masonry(10));
    rect(c, 11, 15, 10, 17, Colour.OUTLINE);
    if (band === 4) {
      // a portcullis
      for (let x = 12; x < 21; x += 2) rect(c, x, 15, 1, 10, Colour.METAL);
      rect(c, 11, 18, 10, 1, Colour.METAL);
      rect(c, 11, 22, 10, 1, Colour.METAL);
    } else doors(12, 17, 8, 15);
    for (const x0 of [1, 23]) {
      rect(c, x0, 3, 8, 3, (x) => (band === 4 && (x - x0) % 4 >= 2 ? Colour.CLEAR : Colour.STONE_TOP));
      rect(c, x0, 6, 8, 3, Colour.STONE_TOP);
      rect(c, x0, 9, 6, 23, masonry(9));
      rect(c, x0 + 6, 9, 2, 23, masonry(9, Colour.STONE_R));
      rect(c, x0 + 3, 13, 1, 4, Colour.OUTLINE);
    }
    if (band === 4) {
      c.banner([4, 4], 4);
      c.banner([26, 4], 4);
    }
  }
  c.outline();
  return c;
}

/** The walls' pieces for each art band. */
export const WALL_DRAWINGS: Record<WallPiece, (band: number) => IsoCanvas> = { wall, side, corner, gate };
