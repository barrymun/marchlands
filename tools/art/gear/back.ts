// The back (tools/art/gear.ts): a cloak from behind. Blue with wavy white stripes, hung from a wooden rod (0), a red
// cape under a silver collar (1), a dark grey cape under a studded collar (2), then from 3 a cape in the level's colour
// under a gold collar, edged in gold from 5, torn at the hem from 8, and at 10 a pair of bat wings in crimson.

import type { Colour, PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { BLUE, canvas, lit, look, type Shades, spike, STEEL } from './common.ts';

const CAPE: Pt[] = [
  [11, 6],
  [21, 6],
  [27, 29],
  [5, 29],
];

/** A cape's cloth: folds as vertical stripes, lit on the left. */
const folds =
  ([hi, mid, dark]: Shades, stripe?: Colour) =>
  (x: number, y: number): Colour => {
    if (stripe && Math.floor((y + Math.round(Math.sin(x * 0.9) * 1.5)) / 3) % 3 === 0) return stripe;
    const f = (x + 1) % 5;
    return f === 0 ? dark : x < 13 ? hi : f === 1 ? hi : mid;
  };

export function back(level: number): PixelCanvas {
  const c = canvas('back', level);
  const L = look(level);
  if (level >= 10) {
    // bat wings: membranes between bones, spread from the middle
    const root: Pt = [16, 10];
    for (const dir of [-1, 1]) {
      const tips: Pt[] = [
        [16 + dir * 14, 3],
        [16 + dir * 13, 17],
        [16 + dir * 8, 21],
        [16 + dir * 2, 26],
      ];
      for (let i = 0; i < tips.length - 1; i++)
        c.poly(dir < 0 ? [root, tips[i], tips[i + 1]] : [root, tips[i + 1], tips[i]], (x, y) =>
          (x + y) % 7 === 0 ? 'gear10Dark' : i % 2 ? 'gear10' : 'gear10Hi',
        );
    }
    oval(c, 16, 11, 3, 4, lit(16, 11, 3, STEEL));
    c.outline();
    for (const dir of [-1, 1])
      for (const tip of [
        [16 + dir * 14, 3],
        [16 + dir * 13, 17],
        [16 + dir * 8, 21],
      ] as Pt[])
        c.line(root, tip, 'gear0Dark');
    spike(c, [16 - 13, 4], [16 - 15, 0], STEEL);
    spike(c, [16 + 13, 4], [16 + 15, 0], STEEL);
    // the wings flap from their root, the tips lifting most
    c.spot('flap', root, 14);
    return c;
  }
  const cloth: Shades = level === 0 ? BLUE : level === 1 ? ['bannerHi', 'banner', 'bannerDark'] : level === 2 ? ['hood', 'hoodDark', 'gear0'] : L.accent;
  c.poly(CAPE, folds(cloth, level === 0 ? 'wool' : undefined));
  if (level >= 8)
    // a torn hem
    for (let x = 5; x < 28; x++) for (let y = 29 - ((x * 7) % 4); y < 30; y++) c.set(x, y, 'clear');
  if (level >= 5) for (let y = 7; y < 29; y++) for (const x of [Math.round(11 - (y - 6) * 0.26), Math.round(21 + (y - 6) * 0.26)]) c.set(x, y, L.trim[1]);
  // the rod or collar
  if (level === 0) for (let x = 6; x < 27; x++) for (const y of [4, 5]) c.set(x, y, y === 4 ? 'plankTop' : 'trunk');
  else {
    const collar: Shades = level <= 2 ? STEEL : L.trim;
    oval(c, 16, 6, 7, 3, lit(16, 6, 7, collar));
    if (level === 2) for (const x of [11, 14, 18, 21]) c.set(x, 6, 'steelHi');
    if (level >= 3) c.set(16, 6, L.accent[0]);
  }
  c.outline();
  if (level === 0) {
    c.set(5, 4, 'trunk');
    c.set(27, 4, 'trunk');
  }
  if (L.horns) {
    spike(c, [10, 5], [7, 1], L.trim);
    spike(c, [22, 5], [25, 1], L.trim);
  }
  // the cape stirs below the rod or collar, the hem most
  const hung = level === 0 ? 6 : 9;
  c.spot('stir', [16, hung], 29 - hung);
  return c;
}
