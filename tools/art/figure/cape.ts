// The hero figure's cape layer (tools/art/figure.ts), behind the body, as the back icon (tools/art/gear/back.ts): blue
// with wavy white stripes hung from a wooden rod (0), red (1), dark grey (2), then the level's colour under a gold
// collar from 3, edged in gold from 5, torn at the hem from 8, and at 10 a pair of crimson bat wings spread behind the
// shoulders. The rows below the shoulders stir (a `sway` spot: from its row, `n` rows down).

import { SpotKind } from '@marchlands/core';

import { BLUE, lit, look, type Shades, spike, STEEL } from '../gear/common.ts';
import { CLEAR, type Colour, type PixelCanvas, type Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { layer, part } from './skeleton.ts';

const TOP = 21;
const HEM = 76;
/** Hung from the shoulders, falling out behind the near side (the back is to the left as the hero turns right). */
const CAPE: Pt[] = [
  [41, TOP],
  [59, TOP],
  [61, HEM],
  [32, HEM],
];

/** A cape's cloth: folds as stripes down it, lit on the left, with wavy bands of `stripe` across it. */
const folds =
  ([hi, mid, dark]: Shades, stripe?: Colour) =>
  (x: number, y: number): Colour => {
    if (stripe && Math.floor((y + Math.round(Math.sin(x * 0.7) * 1.5)) / 4) % 4 === 0) return stripe;
    const f = (x + 2) % 6;
    return f === 0 ? dark : x < 44 ? hi : f === 1 ? hi : mid;
  };

/** Bat wings: membranes between bones, spread from behind the shoulders. */
function wings(): PixelCanvas {
  const root: Pt = [50, 30];
  const tips: Record<number, Pt[]> = {
    [-1]: [
      [28, 10],
      [24, 30],
      [30, 44],
      [40, 52],
    ],
    [1]: [
      [72, 10],
      [76, 28],
      [70, 42],
      [60, 50],
    ],
  };
  const membrane = part('wings', (c) => {
    for (const dir of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const [a, b] = [tips[dir][i], tips[dir][i + 1]];
        c.poly(dir < 0 ? [root, a, b] : [root, b, a], (x, y) => ((x + y) % 7 === 0 ? 'gear10Dark' : i % 2 ? 'gear10' : 'gear10Hi'));
      }
  });
  for (const dir of [-1, 1]) {
    for (const tip of tips[dir].slice(0, 3)) membrane.line(root, tip, 'gear0Dark');
    const [tx, ty] = tips[dir][0];
    spike(membrane, [tx + dir * -1, ty + 1], [tx + dir * 2, ty - 3], STEEL);
  }
  membrane.spot(SpotKind.SWAY, [50, 30], 22);
  return membrane;
}

export function figureCape(level: number): PixelCanvas {
  if (level >= 10) return layer('cape-10', [wings()]);
  const L = look(level);
  const cloth: Shades = level === 0 ? BLUE : level === 1 ? ['bannerHi', 'banner', 'bannerDark'] : level === 2 ? ['hood', 'hoodDark', 'gear0'] : L.accent;
  const cape = part('cape', (c) => {
    c.poly(CAPE, folds(cloth, level === 0 ? 'wool' : undefined));
    if (level >= 8)
      // a torn hem
      for (let x = 32; x <= 61; x++) for (let y = HEM - ((x * 7) % 5); y <= HEM; y++) c.set(x, y, CLEAR);
    if (level >= 5)
      // edged in gold
      for (let y = TOP + 2; y < HEM - 1; y++) {
        const f = (y - TOP) / (HEM - TOP);
        c.set(41 - 9 * f + 1, y, L.trim[1]);
        c.set(59 + 2 * f - 1, y, L.trim[1]);
      }
    // the rod or collar behind the neck
    if (level === 0) for (let x = 38; x <= 62; x++) for (const y of [TOP - 1, TOP]) c.set(x, y, y === TOP - 1 ? 'plankTop' : 'trunk');
    else oval(c, 50, TOP, 8, 2.2, lit(50, TOP, 8, level <= 2 ? STEEL : L.trim));
  });
  cape.spot(SpotKind.SWAY, [50, 34], HEM - 34);
  return layer(`cape-${level}`, [cape]);
}
