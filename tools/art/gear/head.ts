// The head (tools/art/gear.ts), seen from the front: a round blue-steel cap with a gold rim (0), a closed silver helm
// with a dark visor (1), a great helm with an eye slit (2), then from 3 a great helm trimmed in gold with a crest, a
// plume in the level's colour from 4, wings from 6, horns from 7, gilded at 9, and at 10 a crimson helm with silver
// horns and a glowing slit.

import type { Colour, PixelCanvas, Pt } from '../pixel.ts';
import { BLUE, canvas, fill, GOLD, horn, look, plume, type Shades, spike, STEEL, trimmed } from './common.ts';

/** A helm's shell: straight sides, a rounded top from `top`, down to `bottom`. */
function shell(left: number, right: number, top: number, bottom: number): Pt[] {
  const mid = (left + right) / 2;
  const half = (right - left) / 2;
  const arc: Pt[] = Array.from({ length: 9 }, (_, i) => {
    const a = Math.PI + (i / 8) * Math.PI;
    return [mid + Math.cos(a) * half, top + half * 0.8 + Math.sin(a) * half * 0.8];
  });
  return [...arc, [right, bottom], [left, bottom]];
}

export function head(level: number): PixelCanvas {
  const c = canvas('head', level);
  const L = look(level);
  if (level === 0) {
    // a round cap over a gold rim
    fill(c, shell(6, 26, 8, 22), BLUE);
    fill(
      c,
      [
        [5, 20],
        [27, 20],
        [27, 24],
        [5, 24],
      ],
      GOLD,
    );
    c.outline();
    return c;
  }
  const metal: Shades = level <= 2 ? STEEL : L.metal;
  const top = level >= 4 ? 9 : 5;
  const pts = shell(8, 24, top, 29);
  if (level >= 3) trimmed(c, pts, metal, L.trim, 1.8);
  else fill(c, pts, metal);
  // the visor or eye slit, and breaths
  const slit: Colour = level >= 10 ? 'gear10Hi' : 'gear0Dark';
  const sy = top + 9;
  for (let x = 10; x < 23; x++) c.set(x, sy, slit);
  if (level >= 2) for (let y = sy; y < sy + 7; y++) c.set(16, y, slit);
  if (level === 1) for (let x = 10; x < 23; x++) c.set(x, sy + 1, slit);
  if (level <= 2)
    for (const [x, y] of [
      [12, sy + 6],
      [14, sy + 7],
      [19, sy + 6],
      [21, sy + 7],
    ] as const)
      c.set(x, y, 'steelDark');
  if (level >= 3) for (let y = top + 1; y < sy; y++) c.set(16, y, L.trim[1]);
  if (level >= 10) c.set(13, sy, 'sparkle');
  // a plume in the level's colour from 4, horns from 8, filled so the outline goes round them
  if (level >= 4) plume(c, [17, top], [24, 1], -2, 2.4, L.accent);
  if (L.horns) {
    horn(c, [10, top + 6], [2, top - 5], 5, L.trim);
    horn(c, [22, top + 6], [30, top - 5], 5, L.trim);
  }
  c.outline();
  // wings at 6 and 7: thin, after the outline
  if (level >= 6 && !L.horns) {
    spike(c, [8, top + 6], [3, top + 1], L.trim);
    spike(c, [24, top + 6], [29, top + 1], L.trim);
    spike(c, [8, top + 8], [4, top + 5], L.trim);
    spike(c, [24, top + 8], [28, top + 5], L.trim);
  }
  return c;
}
