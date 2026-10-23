// The necklace (tools/art/gear.ts): a chain hanging in a U from the top corners with a pendant at the bottom. A red
// cord with an amber pendant (0), a plain silver chain (1), a small silver pendant (2), then from 3 a gold chain and a
// stone in the level's colour that grows, side stones from 6, a spiked setting from 8, and at 10 a crimson heart in
// silver.

import type { Colour, PixelCanvas } from '../pixel.ts';
import { disc } from '../shapes.ts';
import { canvas, gem, heart, lit, look, setStone, type Shades, spike } from './common.ts';

/** The chain at `t` (0 to 1), from the top left down to the bottom middle and back up. */
const chain = (t: number): [number, number] => [5 + 22 * t, 4 + 15 * (1 - (2 * t - 1) ** 2)];

export function necklace(level: number): PixelCanvas {
  const c = canvas('necklace', level);
  const L = look(level);
  const links: readonly Colour[] = level === 0 ? ['bannerHi', 'bannerDark'] : level <= 2 ? ['steelHi', 'steelDark'] : [L.trim[0], L.trim[2]];
  const r = level === 0 ? 3 : level === 1 ? 0 : level === 2 ? 2 : 2 + level * 0.25;
  const py = 21 + r * 0.6;
  // the pendant, before the outline
  if (level === 0) disc(c, 16, py, r, 'fire', 'roofD');
  else if (level === 2) disc(c, 16, py, r, 'steel', 'steelDark');
  else if (level >= 10) {
    // a crimson heart set in silver
    heart(c, 16, py, 5.6, lit(16, py, 5, L.trim));
    heart(c, 16, py, 3.8, (x, y) => (x + y < 16 + py - 2 ? 'gear10' : 'gear10Dark'));
    c.set(14, py - 2, 'sparkle');
  } else if (level >= 3) setStone(c, 16, py, r, L.trim, L.accent);
  if (level >= 6)
    for (const t of [0.28, 0.72]) {
      const [x, y] = chain(t);
      disc(c, x, y + 1.5, 1.6, L.trim[1], L.trim[2]);
    }
  c.outline();
  // the chain after the outline, so it stays one pixel thick: links in two shades
  for (let i = 0; i <= 44; i++) {
    const [x, y] = chain(i / 44);
    if (r > 0 && Math.abs(x - 16) < 1 && y > py - r - 1) continue;
    c.set(x, y, links[i % 2]);
  }
  if (level === 0) c.line([16, 19], [16, py - r], 'bannerDark');
  if (level >= 2 && level < 10) c.line([16, 19], [16, py - r - (level >= 3 ? 1 : 0)], links[0]);
  if (level >= 6)
    for (const t of [0.28, 0.72]) {
      const [x, y] = chain(t);
      gem(c, Math.round(x), Math.round(y + 1), 1, L.accent);
    }
  if (level >= 8) {
    const shades: Shades = L.trim;
    spike(c, [16, py + r + 1], [16, py + r + 4], shades);
    spike(c, [16 - r - 1, py], [16 - r - 3, py + 1], shades);
    spike(c, [16 + r + 1, py], [16 + r + 3, py + 1], shades);
  }
  return c;
}
