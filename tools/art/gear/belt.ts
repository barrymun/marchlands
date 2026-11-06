// The belt (tools/art/gear.ts): a band seen at an angle with its buckle at the front. Glowing blue with a gold buckle
// (0), silver and blue with a square buckle (1), dark set with silver studs (2), then from 3 leather with studs and a
// gold buckle holding a stone in the level's colour, spikes from 7, gilded at 9, and crimson with a jewelled buckle at
// 10.

import { GearPieceId } from '@marchlands/core';

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { canvas, fill, GOLD, LEATHER, look, ring, setStone, type Shades, spike, STEEL } from './common.ts';

export function belt(level: number): PixelCanvas {
  const c = canvas(GearPieceId.BELT, level);
  const L = look(level);
  const band: Shades =
    level === 0
      ? [Colour.BLUE_HI, Colour.BLUE_HI, Colour.BLUE]
      : level === 1
        ? STEEL
        : level === 2
          ? [Colour.HOOD, Colour.HOOD_DARK, Colour.GEAR_0]
          : level >= 9
            ? L.metal
            : LEATHER;
  ring(c, 16, 15, 14, 9, 3.6, band);
  // a stripe or studs round the front of the band
  for (let x = 4; x < 29; x++) {
    const y = 15 + Math.round(Math.sqrt(Math.max(0, 1 - ((x + 0.5 - 16) / 12.5) ** 2)) * 7.2);
    if (level === 1) c.set(x, y, Colour.BLUE);
    if (level === 2 && x % 3 === 0) c.set(x, y, Colour.STEEL_HI);
    if (level >= 3 && x % 3 === 0) c.set(x, y, L.trim[0]);
  }
  // the buckle
  const buckle: Shades = level === 0 ? GOLD : level <= 2 ? STEEL : L.trim;
  fill(
    c,
    [
      [11, 18],
      [21, 18],
      [21, 27],
      [11, 27],
    ],
    buckle,
  );
  const hole: Colour = level === 0 ? Colour.BLUE : level === 2 ? Colour.GEAR_0 : Colour.STEEL_DARK;
  if (level <= 2)
    for (let y = 20; y < 25; y++)
      for (let x = 13; x < 19; x++)
        if (y === 20 || y === 24 || x === 13 || x === 18) continue;
        else c.set(x, y, hole);
  if (level >= 3) setStone(c, 16, 22.5, 1.4 + level * 0.12, buckle, L.accent);
  c.outline();
  if (L.spikes) for (const x of [6, 26]) spike(c, [x, 22 - Math.abs(x - 16) * 0.1], [x + (x - 16) * 0.2, 27], L.trim);
  return c;
}
