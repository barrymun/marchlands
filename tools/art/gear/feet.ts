// The feet (tools/art/gear.ts): a pair of boots, toes to the left, the right one behind. Blue and white with gold trim
// (0), silver plate (1), silver with pointed toes (2), then from 3 plate trimmed in gold with a stone in the level's
// colour at the ankle, spikes at the knee from 7 and the heel from 8, gilded at 9 and crimson trimmed in silver at 10.

import type { PixelCanvas, Pt } from '../pixel.ts';
import { BLUE, canvas, CLOTH, fill, gem, GOLD, look, type Shades, spike, STEEL } from './common.ts';

/** A boot whose shaft starts at x, its toe pointing left (`toe` pixels longer for pointed sabatons). */
function boot(x: number, y: number, toe: number): { shaft: Pt[]; foot: Pt[] } {
  return {
    shaft: [
      [x, y],
      [x + 8, y],
      [x + 8, y + 18],
      [x, y + 18],
    ],
    foot: [
      [x - 1, y + 17],
      [x + 8, y + 17],
      [x + 8, y + 23],
      [x - 4 - toe, y + 23],
      [x - 3 - toe, y + 21],
    ],
  };
}

export function feet(level: number): PixelCanvas {
  const c = canvas('feet', level);
  const L = look(level);
  const metal: Shades = level === 0 ? BLUE : level <= 2 ? STEEL : L.metal;
  const trim: Shades | null = level === 0 ? GOLD : level >= 3 ? L.trim : null;
  const toe = level === 2 ? 2 : level >= 3 ? 1 : 0;
  // the right boot behind, then the left in front
  for (const [x, y] of [
    [19, 3],
    [11, 6],
  ] as const) {
    const b = boot(x, y, toe);
    fill(c, b.shaft, metal);
    fill(c, b.foot, metal);
    if (level === 0)
      fill(
        c,
        [
          [x, y],
          [x + 8, y],
          [x + 8, y + 4],
          [x, y + 4],
        ],
        CLOTH,
      );
    if (trim) for (let i = 0; i < 9; i++) c.set(x + i, y + (level === 0 ? 4 : 0), trim[1]);
    if (trim) for (let i = -3 - toe; i < 9; i++) c.set(x + i, y + 22, trim[2]);
    if (level === 1 || level === 2) for (const dy of [6, 10, 14]) for (let i = 1; i < 8; i++) c.set(x + i, y + dy, 'steelDark');
    if (level >= 3) {
      // a band at the ankle set with a stone
      for (let i = 0; i < 9; i++) for (const dy of [14, 15]) c.set(x + i, y + dy, L.trim[dy === 14 ? 0 : 1]);
      gem(c, x + 3, y + 14, level >= 6 ? 1.5 : 1, L.accent);
    }
  }
  c.outline();
  if (L.spikes)
    for (const [x, y] of [
      [19, 3],
      [11, 6],
    ] as const)
      spike(c, [x + 8, y + 2], [x + 11, y - 2], L.trim);
  if (L.horns)
    for (const [x, y] of [
      [19, 3],
      [11, 6],
    ] as const)
      spike(c, [x + 8, y + 20], [x + 11, y + 22], L.trim);
  return c;
}
