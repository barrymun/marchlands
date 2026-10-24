// The hero figure's shield (tools/art/figure/upper.ts), on the far arm and turned with the body, as the shield icon
// (tools/art/gear/shield.ts): round and wooden with an iron rim and boss (0), a kite shield with light and dark halves
// (1), rimmed (2), rimmed in gold with a boss stone in the level's colour from 3, a cross from 5, spiked corners from 7,
// gilded at 9 and crimson rimmed in silver at 10.

import { fill, IRON, lit, look, type Shades, spike, STEEL, trimmed, WOOD } from '../gear/common.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { part, stone } from './skeleton.ts';

/** The shield on the far arm, seen turned with the body: round and wooden at 0, a kite shield from 1. */
export function shield(level: number): PixelCanvas {
  const L = look(level);
  const c = part('shield', (c) => {
    if (level === 0) {
      oval(c, 61, 41, 6.5, 9, lit(61, 41, 8, IRON));
      oval(c, 61, 41, 5, 7.5, lit(61, 41, 7, WOOD));
      for (let y = 34; y <= 48; y++) c.set(59, y, 'plankR');
      oval(c, 61.5, 41, 1.6, 1.8, lit(61, 41, 2, IRON));
      return;
    }
    const metal: Shades = level <= 2 ? STEEL : L.metal;
    const pts: Pt[] = [
      [55, 30],
      [67, 30],
      [68, 37],
      [61.5, 55],
      [55, 37],
    ];
    if (level >= 2) trimmed(c, pts, metal, level >= 3 ? L.trim : IRON, 1.3);
    else fill(c, pts, metal);
    if (level === 1)
      // its halves light and dark
      c.poly(
        [
          [61.5, 30],
          [67, 30],
          [68, 37],
          [61.5, 55],
        ],
        lit(64, 38, 8, ['steel', 'steelDark', 'hoodDark']),
      );
    if (level >= 5) {
      const col = L.trim[1];
      for (let y = 32; y <= 50; y++) c.set(61, y, col);
      for (let x = 56; x <= 66; x++) c.set(x, 37, col);
    }
    if (level >= 3) stone(c, 61, 37, 1 + level * 0.1, L.trim, L.accent);
  });
  if (L.spikes) {
    spike(c, [66, 30], [69, 27], L.trim);
    spike(c, [55, 30], [53, 27], L.trim);
  }
  return c;
}
