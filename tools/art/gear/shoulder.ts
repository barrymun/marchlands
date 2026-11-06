// The shoulder (tools/art/gear.ts): a pauldron, a dome over overlapping plates. Blue steel trimmed in gold over white
// cloth (0), plain grey plates (1), steel worked in a spiral (2), then from 3 plates edged in gold with a stone in the
// level's colour, cloth in that colour from 5, spikes from 6, gilded at 9 and crimson with silver spikes at 10.

import { GearPieceId } from '@marchlands/core';

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { BLUE, canvas, CLOTH, GOLD, horn, IRON, lit, look, setStone, type Shades, spike, STEEL } from './common.ts';

export function shoulder(level: number): PixelCanvas {
  const c = canvas(GearPieceId.SHOULDER, level);
  const L = look(level);
  const metal: Shades = level === 0 ? BLUE : level === 1 ? IRON : level === 2 ? STEEL : L.metal;
  const edge: Shades = level === 0 ? GOLD : level >= 3 ? L.trim : [Colour.STEEL_DARK, Colour.STEEL_DARK, Colour.HOOD_DARK];
  // cloth hanging below
  const cloth: Shades | null = level === 0 ? CLOTH : level >= 5 ? L.accent : null;
  if (cloth)
    for (let y = 21; y < 30; y++)
      for (let x = 8; x < 25; x++)
        if (Math.abs(x - 16) < 8 - (y - 21) * 0.15) c.set(x, y, (x + Math.floor(y / 3)) % 4 === 0 ? cloth[2] : x < 14 ? cloth[0] : cloth[1]);
  // three plates, the lowest first, each overlapping the one below
  for (const [cy, ry, rx] of [
    [21, 4, 12],
    [17, 4.5, 12.5],
  ] as const) {
    oval(c, 16, cy, rx, ry, lit(16, cy, rx, metal));
    for (let x = 16 - rx + 1; x < 16 + rx; x++) c.set(x, cy + Math.round(ry * Math.sqrt(Math.max(0, 1 - ((x - 16) / rx) ** 2))) - 1, edge[1]);
  }
  oval(c, 16, 12, 11, 8.5, lit(16, 12, 11, metal));
  for (let x = 6; x < 27; x++) c.set(x, 12 + Math.round(8.5 * Math.sqrt(Math.max(0, 1 - ((x - 16) / 11) ** 2))) - 1, edge[1]);
  if (level === 2)
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = a * 0.55;
      c.set(16 + Math.cos(a) * r, 11 + Math.sin(a) * r * 0.75, Colour.STEEL_DARK);
    }
  if (level >= 3) setStone(c, 16, 11, 1.4 + level * 0.12, L.trim, L.accent);
  if (L.horns) horn(c, [16, 6], [16, -1], 5, L.trim);
  c.outline();
  // spikes along the top from 6
  if (level >= 6) for (const x of [10, 22]) spike(c, [x, 6], [x + (x - 16) * 0.5, 1], L.trim);
  return c;
}
