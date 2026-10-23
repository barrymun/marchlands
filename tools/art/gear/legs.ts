// The legs (tools/art/gear.ts): a pair of legs from the front. Plain white cloth (0), pink with a belt (1), dark greaves
// marked with silver crosses (2), then from 3 cloth in the level's colour with knee plates trimmed in gold, plates on
// the thighs from 6, knee spikes from 7, gilded plates at 9, and crimson armour trimmed in silver at 10.

import type { PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { canvas, CLOTH, fill, lit, look, type Shades, spike } from './common.ts';

const LEFT: Pt[] = [
  [8, 7],
  [16, 7],
  [15, 29],
  [9, 29],
];
const RIGHT: Pt[] = [
  [16, 7],
  [24, 7],
  [23, 29],
  [17, 29],
];

export function legs(level: number): PixelCanvas {
  const c = canvas('legs', level);
  const L = look(level);
  const cloth: Shades =
    level === 0 ? CLOTH : level === 1 ? ['flower', 'bannerHi', 'barnL'] : level === 2 ? ['hood', 'hoodDark', 'gear0'] : level >= 10 ? L.metal : L.accent;
  fill(c, LEFT, cloth);
  fill(c, RIGHT, cloth);
  // the gap between the legs
  for (let y = 14; y < 30; y++) c.set(16, y, 'clear');
  // the waist
  const waist: Shades = level === 1 ? ['leather', 'leather', 'leatherDark'] : level >= 3 ? L.trim : cloth;
  fill(
    c,
    [
      [8, 4],
      [24, 4],
      [24, 8],
      [8, 8],
    ],
    waist,
  );
  if (level === 2)
    for (const x of [12, 20])
      for (let i = -2; i <= 2; i++) {
        c.set(x + i, 19 + i, 'steelHi');
        c.set(x + i, 19 - i, 'steelHi');
      }
  if (level >= 6)
    // plates on the thighs
    for (const x of [12, 20])
      fill(
        c,
        [
          [x - 3.5, 9],
          [x + 3.5, 9],
          [x + 3, 15],
          [x - 3, 15],
        ],
        level >= 10 ? ['steelHi', 'steel', 'steelDark'] : L.metal,
      );
  if (level >= 3)
    for (const x of [12, 20]) {
      oval(c, x, 20, 3.2, 2.6, lit(x, 20, 3, L.trim));
      oval(c, x, 20, 1.8, 1.4, lit(x, 20, 2, level >= 9 ? L.trim : ['steelHi', 'steel', 'steelDark']));
    }
  c.outline();
  if (L.spikes) for (const x of [12, 20]) spike(c, [x, 18], [x, 14], L.trim);
  return c;
}
