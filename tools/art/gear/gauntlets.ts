// The gauntlets (tools/art/gear.ts): a forearm guard standing upright. A blue bracer under a gold crown-shaped cuff (0),
// a silver gauntlet with fingers (1), a dark engraved bracer (2), then from 3 a gauntlet trimmed in gold with a stone
// in the level's colour on the back of the hand, spikes on the knuckles from 7 and along the forearm from 8, gilded at
// 9 and crimson at 10.

import { GearPieceId } from '@marchlands/core';

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { BLUE, canvas, DARK_STEEL, fill, GOLD, horn, look, setStone, type Shades, spike, STEEL } from './common.ts';

const BRACER: Pt[] = [
  [10, 15],
  [21, 14],
  [23, 30],
  [12, 31],
];
const HAND: Pt[] = [
  [10, 3],
  [21, 2],
  [21, 14],
  [11, 15],
];
const THUMB: Pt[] = [
  [5, 7],
  [10, 8],
  [11, 14],
  [7, 13],
];
const CUFF: Pt[] = [
  [9, 14],
  [22, 13],
  [22.5, 18],
  [9.5, 19],
];

export function gauntlets(level: number): PixelCanvas {
  const c = canvas(GearPieceId.GAUNTLETS, level);
  const L = look(level);
  const metal: Shades = level === 0 ? BLUE : level === 1 ? STEEL : level === 2 ? DARK_STEEL : L.metal;
  const trim: Shades = level === 0 ? GOLD : level <= 2 ? metal : L.trim;
  // a hand from level 1, bar 2, with fingers marked
  if (level === 1 || level >= 3) {
    fill(c, THUMB, metal);
    fill(c, HAND, metal);
    // four fingers, their joints marked
    for (let i = 1; i < 4; i++) c.line([10 + i * 2.75, 3], [10.5 + i * 2.75, 9], metal[2]);
    for (let x = 11; x < 21; x++) c.set(x, 9, metal[2]);
  }
  fill(c, BRACER, metal);
  if (level === 2) for (let y = 17; y < 28; y += 3) for (let x = 13; x < 22; x++) if ((x + y) % 3) c.set(x, y + Math.round((x - 13) * -0.15), Colour.HOOD_DARK);
  if (level !== 1 && level !== 2) fill(c, CUFF, trim);
  if (level === 0)
    // the cuff's crown points
    for (const x of [9.5, 14, 18.5])
      c.poly(
        [
          [x, 15 - (x - 9) * 0.08],
          [x + 4, 15 - (x - 9) * 0.08],
          [x + 2, 10 - (x - 9) * 0.08],
        ],
        (px) => (px < x + 2 ? Colour.FIRE_HI : Colour.GOLD),
      );
  if (level >= 3) setStone(c, 16, 12, 0.9 + level * 0.08, L.trim, L.accent);
  if (L.horns) horn(c, [23, 22], [30, 16], 6, L.trim);
  c.outline();
  // spikes on the cuff and down the forearm from 7
  if (L.spikes)
    for (const [x, y] of [
      [9, 16],
      [11, 23],
    ] as const)
      spike(c, [x, y], [x - 4, y - 3], L.trim);
  return c;
}
