// The hero figure's helm layer (tools/art/figure.ts), over the hair: a round blue-steel cap with a gold rim (0), a
// closed helm (1-2), from 3 a great helm trimmed in gold, a plume in the level's colour from 4 flowing back, wings at 6
// and 7, horns from 8, gilded at 9, and at 10 crimson with silver horns and a glowing slit, as the head icon
// (tools/art/gear/head.ts). The face looks right, so the slit and the breaths are on the right.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { BLUE, fill, GOLD, horn, look, plume, type Shades, spike, STEEL, trimmed } from '../gear/common.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { HEAD, layer, part } from './skeleton.ts';

/** A helm's shell round the skull: a dome over the crown, the face plate forward to the right, down to `bottom`. */
function shell(bottom: number): Pt[] {
  const arc: Pt[] = Array.from({ length: 11 }, (_, i) => {
    const a = Math.PI + (i / 10) * Math.PI;
    return [HEAD.cx + 0.5 + Math.cos(a) * 7, HEAD.cy - 1 + Math.sin(a) * 7.5];
  });
  return [...arc, [57.5, bottom - 2], [55, bottom], [44, bottom], [43, bottom - 4]];
}

export function figureHelm(level: number): PixelCanvas {
  if (level === 0)
    return layer('helm-0', [
      part('cap', (c) => {
        // a round cap over a gold rim, the hair and face below it
        const dome: Pt[] = Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI + (i / 10) * Math.PI;
          return [HEAD.cx + Math.cos(a) * 6.6, HEAD.cy - 2 + Math.sin(a) * 6.4];
        });
        fill(c, dome, BLUE);
        fill(
          c,
          [
            [43, HEAD.cy - 3],
            [57, HEAD.cy - 3],
            [57, HEAD.cy - 1],
            [43, HEAD.cy - 1],
          ],
          GOLD,
        );
      }),
    ]);
  const L = look(level);
  const metal: Shades = level <= 2 ? STEEL : L.metal;
  const bottom = 22;
  const helm = part('helm', (c) => {
    if (level >= 3) trimmed(c, shell(bottom), metal, L.trim, 1.4);
    else fill(c, shell(bottom), metal);
    // the eye slit and the breaths, on the face to the right
    const slit: Colour = level >= 10 ? Colour.GEAR_10_HI : Colour.GEAR_0_DARK;
    for (let x = 51; x <= 57; x++) c.set(x, 13, slit);
    if (level === 1) for (let x = 51; x <= 57; x++) c.set(x, 14, slit);
    if (level >= 2) for (let y = 13; y <= 19; y++) c.set(54, y, slit);
    if (level <= 2)
      for (const [x, y] of [
        [52, 18],
        [56, 18],
        [52, 20],
        [56, 20],
      ] as const)
        c.set(x, y, Colour.STEEL_DARK);
    // a crest over the dome from 3
    if (level >= 3) for (let y = 7; y <= 12; y++) c.set(54, y, L.trim[1]);
    if (level >= 10) c.set(52, 13, Colour.SPARKLE);
    if (L.horns) {
      horn(c, [46, 10], [41, 5], 6, L.trim);
      horn(c, [42, 6], [38, 1], 3.5, L.trim);
      horn(c, [55, 8], [59, 3], 5, L.trim);
      horn(c, [58.5, 4], [60.5, 1], 3, L.trim);
    }
  });
  const parts = [helm];
  // a plume from the crest, flowing back
  if (level >= 4)
    parts.unshift(
      part('plume', (c) => {
        plume(c, [52, 6], L.horns ? [39, 15] : [38, 9], L.horns ? 3 : 5, 2.6, L.accent);
      }),
    );
  const out = layer(`helm-${level}`, parts);
  // wings at 6 and 7, thin, after the outline
  if (level >= 6 && !L.horns) {
    spike(out, [44, 12], [39, 6], L.trim);
    spike(out, [44, 15], [40, 10], L.trim);
  }
  return out;
}
