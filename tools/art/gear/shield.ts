// The shield (tools/art/gear.ts): a round wooden shield with an iron rim and boss (0), then a kite shield, its halves
// light and dark (1), rimmed (2), and from 3 rimmed in gold with a boss stone in the level's colour, a cross from 5,
// spiked corners from 7, gilded at 9 and crimson rimmed in silver at 10.

import type { PixelCanvas, Pt } from '../pixel.ts';
import { disc } from '../shapes.ts';
import { canvas, DARK_STEEL, fill, inset, look, setStone, type Shades, spike, STEEL } from './common.ts';

export function shield(level: number): PixelCanvas {
  const c = canvas('shield', level);
  if (level === 0) {
    // planks inside an iron rim, round an iron boss
    for (let y = 4; y < 28; y++)
      for (let x = 4; x < 28; x++) {
        const d = Math.hypot(x + 0.5 - 16, y + 0.5 - 16);
        if (d > 11.5) continue;
        if (d > 10) c.set(x, y, x + y > 34 ? 'steelDark' : 'metal');
        else c.set(x, y, x + y > 38 ? 'plankR' : Math.floor((x - 4) / 4) % 2 ? 'plankL' : 'plankTop');
      }
    disc(c, 16, 16, 2.6, 'steelHi', 'steelDark');
    c.outline();
    return c;
  }
  const L = look(level);
  const w = 9 + Math.min(level, 10) * 0.25;
  const outer: Pt[] = [
    [16 - w, 4],
    [16 + w, 4],
    [16 + w, 13],
    [16, 29],
    [16 - w, 13],
  ];
  const body: Shades = level <= 2 ? STEEL : L.metal;
  const rim: Shades | null = level === 1 ? null : level === 2 ? DARK_STEEL : L.trim;
  if (rim) fill(c, outer, rim);
  // the halves, the lit one on the left
  c.poly(rim ? inset(outer, 2.2) : outer, (x, y) => (x < 16 ? body[0] : y > 22 ? body[2] : body[1]));
  if (level === 2) for (let y = 6; y < 26; y++) c.set(16, y, 'steelDark');
  if (level >= 5) {
    // a cross in the level's colour
    for (let y = 7; y < 24; y++) c.set(16, y, L.accent[1]);
    for (let x = 16 - w + 3; x < 16 + w - 3; x++) c.set(x, 12, L.accent[1]);
  }
  if (level >= 3) setStone(c, 16, 12, level >= 6 ? 2 : 1.4, L.trim, L.accent);
  c.outline();
  if (L.spikes && level >= 7) {
    spike(c, [16 - w, 4], [16 - w - 2, 1], L.trim);
    spike(c, [16 + w, 4], [16 + w + 2, 1], L.trim);
  }
  if (L.horns) {
    spike(c, [16 - w, 13], [16 - w - 3, 15], L.trim);
    spike(c, [16 + w, 13], [16 + w + 3, 15], L.trim);
  }
  return c;
}
