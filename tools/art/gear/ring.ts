// The ring (tools/art/gear.ts): a band seen at an angle. Bronze engraved with a pattern (0), silver with a dark band
// (1), silver engraved with vines (2), then from 3 a stone in the level's colour on top that grows, claws round it
// from 7, gilded at 9, and at 10 a crimson band with silver claws and a glowing stone.

import type { PixelCanvas } from '../pixel.ts';
import { ring as band, BRONZE, canvas, look, setStone, type Shades, shine, spike, STEEL } from './common.ts';

export function ring(level: number): PixelCanvas {
  const c = canvas('ring', level);
  const L = look(level);
  const metal: Shades = level === 0 ? BRONZE : level <= 2 ? STEEL : L.metal;
  band(c, 16, 19, 11, 8, 3.2, metal);
  // engraving on the front of the band
  for (let x = 7; x < 26; x++) {
    const y = 19 + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 16) / 9.5) ** 2)) * 6.2);
    if (level === 0 && x % 2) c.set(x, y, 'thatchEdge');
    if (level === 1) c.set(x, y, 'steelDark');
    if (level === 2 && (x % 3 === 0 || (x % 3 === 1 && y % 2))) c.set(x, y - (x % 2), 'hoodDark');
    if (level >= 3 && x % 4 === 0) c.set(x, y, L.trim[1]);
  }
  if (level >= 3) {
    const r = 2 + (level - 3) * 0.25;
    setStone(c, 16, 11 - r * 0.3, r, L.trim, L.accent);
  }
  c.outline();
  if (level >= 7) {
    const r = 2 + (level - 3) * 0.25 + 1.5;
    spike(c, [16 - r, 11], [16 - r - 1, 7], L.trim);
    spike(c, [16 + r, 11], [16 + r + 1, 7], L.trim);
  }
  if (level >= 10) shine(c, 15, 8);
  return c;
}
