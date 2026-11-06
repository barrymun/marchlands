// The hero figure's sword (tools/art/figure/upper.ts), raised point up in the near fist, as the weapon icon
// (tools/art/gear/weapon.ts): a wooden practice sword (0), steel (1-2), then a longer blade with its guard swept up and
// a stone in the pommel from 3, runes from 5, a glowing fuller from 6, a horned guard from 8, gilded at 9, and a
// crimson blade with silver edges at 10.

import { SpotKind } from '@marchlands/core';

import { fill, horn, IRON, lit, look, type Shades, STEEL, sweep, WOOD } from '../gear/common.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { HAND_NEAR, part } from './skeleton.ts';

/** The sword in the near fist, raised point up: wooden at 0, steel growing longer and grander, crimson at 10. */
export function sword(level: number): PixelCanvas {
  const L = look(level);
  const [hx, hy] = HAND_NEAR;
  const blade: Shades = level === 0 ? WOOD : level >= 10 ? L.metal : level === 9 ? ['steelHi', 'steelHi', 'steel'] : STEEL;
  const guard: Shades = level === 0 ? WOOD : level <= 2 ? IRON : L.trim;
  const width = level === 0 ? 4.4 : 4.6 + Math.min(level, 8) * 0.15;
  // the blade leans out, clear of the head
  const base: Pt = [hx, hy - 5];
  const tip: Pt = [hx - 5, 11 - Math.min(level, 8) * 0.25];
  const at = (t: number): Pt => [base[0] + (tip[0] - base[0]) * t, base[1] + (tip[1] - base[1]) * t];
  const c = part('sword', (c) => {
    // the blade, from the guard up to the point
    sweep(
      c,
      at,
      (t) => (width / 2) * Math.min(1, (1 - t) / 0.12),
      (_t, side) => (side < -0.2 ? blade[0] : side > 0.35 ? blade[2] : blade[1]),
    );
    // the guard above the fist, its ends swept up from 3, and the pommel below it
    const gw = level === 0 ? 3 : 4 + Math.min(level, 6) * 0.3;
    fill(
      c,
      [
        [hx - gw, hy - 5],
        [hx + gw, hy - 5],
        [hx + gw, hy - 3],
        [hx - gw, hy - 3],
      ],
      guard,
    );
    if (level >= 3)
      for (const x of [hx - gw - 0.25, hx + gw + 0.25])
        fill(
          c,
          [
            [x - 0.75, hy - 7],
            [x + 0.75, hy - 7],
            [x + 0.75, hy - 3],
            [x - 0.75, hy - 3],
          ],
          guard,
        );
    oval(c, hx + 0.5, hy + 4, 1.6, 1.6, lit(hx, hy + 4, 2, guard));
    if (L.horns) {
      horn(c, [hx - gw, hy - 4], [hx - gw - 3, hy - 10], 2.5, guard);
      horn(c, [hx + gw, hy - 4], [hx + gw + 3, hy - 10], 2.5, guard);
    }
  });
  // the fuller, runes and the stones, inside the outline
  if (level >= 1) c.line(at(0.08), at(0.8), level >= 6 ? L.accent[0] : blade[2]);
  if (level >= 5)
    for (let i = 0; i < 4; i++) {
      const [x, y] = at(0.15 + i * 0.12);
      c.set(x - 0.6, y, L.accent[1]);
    }
  if (level >= 10) {
    const [x0, y0] = at(0.02);
    const [x1, y1] = at(0.92);
    c.line([x0 - 1.4, y0], [x1 - 0.8, y1], 'steelHi');
  }
  if (level >= 3) {
    c.set(hx + 0.5, hy + 4, L.accent[1]);
    c.spot(SpotKind.STONE, [hx + 0.5, hy + 4], 0.5);
  }
  return c;
}
