// The hero figure's necklace (tools/art/figure/upper.ts), over the breastplate at the neck, as the necklace icon
// (tools/art/gear/necklace.ts): an amber pendant on a red cord (0), a plain silver chain (1), a small silver pendant
// (2), then a gold chain and a stone in the level's colour that grows from 3, and a crimson heart in silver at 10.

import { heart, lit, look, type Shades } from '../gear/common.ts';
import type { Colour, PixelCanvas } from '../pixel.ts';
import { disc } from '../shapes.ts';
import { part, stone } from './skeleton.ts';

/** The chain at `t` (0 to 1): from the near side of the neck down to the front and up to the far side. */
const chain = (t: number): [number, number] => [46.5 + 8.5 * t, 22.5 + 4 * (1 - (2 * t - 1) ** 2)];

export function necklace(level: number): PixelCanvas {
  const L = look(level);
  const links: readonly Colour[] = level === 0 ? ['bannerHi', 'bannerDark'] : level <= 2 ? ['steelHi', 'steelDark'] : [L.trim[0], L.trim[2]];
  const [px, py] = [51, 28.5];
  const c = part('necklace', (c) => {
    if (level === 0) disc(c, px, py, 1.3, 'fire', 'roofD');
    else if (level === 2) disc(c, px, py, 1, 'steel', 'steelDark');
    else if (level >= 10) {
      const silver: Shades = L.trim;
      heart(c, px, py + 0.5, 2.6, lit(px, py, 2.5, silver));
      heart(c, px, py + 0.5, 1.6, (x, y) => (x + y < px + py ? 'gear10' : 'gear10Dark'));
    } else if (level >= 3) stone(c, px, py + 0.5, 0.7 + level * 0.07, L.trim, L.accent);
  });
  // the chain after the outline, one pixel thick, links in two shades
  for (let i = 0; i <= 20; i++) {
    const [x, y] = chain(i / 20);
    if (level !== 1 && Math.abs(x - px) < 1 && y > py - 2.5) continue;
    c.set(x, y, links[i % 2]);
  }
  if (level >= 10) {
    c.set(px - 1, py - 0.5, 'sparkle');
    c.spot('stone', [px, py + 0.5], 1.6);
  }
  return c;
}
