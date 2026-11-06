// The chest (tools/art/gear.ts): a breastplate from the front. Blue steel with blue padding, trimmed in gold (0), steel
// with a red heart-shaped boss (1), riveted steel plates (2), then from 3 trimmed in gold with a stone in the level's
// colour, a raised collar from 6, spiked shoulders from 7, horns on the collar from 8, gilded at 9 and crimson with a
// silver collar at 10.

import { CLEAR, type PixelCanvas, type Pt } from '../pixel.ts';
import { BLUE, canvas, fill, GOLD, heart, horn, lit, look, setStone, type Shades, spike, STEEL, trimmed } from './common.ts';

const BODY: Pt[] = [
  [8, 4],
  [24, 4],
  [28, 11],
  [25, 29],
  [7, 29],
  [4, 11],
];

export function chest(level: number): PixelCanvas {
  const c = canvas('chest', level);
  const L = look(level);
  const metal: Shades = level === 0 ? BLUE : level <= 2 ? STEEL : L.metal;
  const trim: Shades | null = level === 0 ? GOLD : level >= 3 ? L.trim : null;
  if (trim) trimmed(c, BODY, metal, trim, 1.8);
  else fill(c, BODY, metal);
  // the neck and the arms cut out
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) {
      if (((x + 0.5 - 16) / 5.5) ** 2 + ((y + 0.5 - 3) / 4) ** 2 <= 1) c.set(x, y, CLEAR);
      if (((x + 0.5 - 3) / 3.5) ** 2 + ((y + 0.5 - 7) / 5) ** 2 <= 1 || ((x + 0.5 - 29) / 3.5) ** 2 + ((y + 0.5 - 7) / 5) ** 2 <= 1) c.set(x, y, CLEAR);
    }
  // a ridge down the middle, or padding
  if (level === 0) for (let y = 9; y < 27; y += 3) for (let x = 9; x < 24; x++) c.set(x, y, 'blueDark');
  else for (let y = 8; y < 27; y++) c.set(16, y, metal[2]);
  if (level === 1) heart(c, 16, 15, 4, (x, y) => (x + y < 30 ? 'bannerHi' : 'bannerDark'));
  if (level === 2)
    for (const y of [19, 23]) {
      for (let x = 8; x < 25; x++) c.set(x, y, 'steelDark');
      for (const x of [9, 23]) c.set(x, y - 1, 'steelHi');
    }
  if (level >= 3) setStone(c, 16, 14, 1.4 + level * 0.15, L.trim, L.accent);
  if (level >= 6) {
    // a raised collar
    const col: Shades = L.trim;
    for (let x = 10; x < 23; x++) c.set(x, 6 + Math.round(Math.abs(x - 16) * -0.2 + 1), col[1]);
    c.poly(
      [
        [10, 3],
        [13, 2],
        [13, 7],
        [10, 7],
      ],
      lit(11, 5, 2, col),
    );
    c.poly(
      [
        [19, 2],
        [22, 3],
        [22, 7],
        [19, 7],
      ],
      lit(21, 5, 2, col),
    );
  }
  if (L.horns) {
    horn(c, [11, 5], [6, -1], 4.5, L.trim);
    horn(c, [21, 5], [26, -1], 4.5, L.trim);
  }
  c.outline();
  if (L.spikes) {
    spike(c, [5, 11], [1, 8], L.trim);
    spike(c, [27, 11], [31, 8], L.trim);
  }
  return c;
}
