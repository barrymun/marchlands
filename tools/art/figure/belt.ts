// The hero figure's belt and the charm hung from it (tools/art/figure/upper.ts), as the belt and charm icons
// (tools/art/gear/belt.ts, charm.ts). The belt: glowing blue with a gold buckle (0), silver and blue (1), dark with
// silver studs (2), then leather with studs and a gold buckle holding a stone in the level's colour from 3, gilded at 9
// and crimson with a jewelled buckle at 10. The charm hangs at the near hip, where a helm can't hide it (the icon's
// earrings would be under every closed helm): a gold tag on a red cord (0), a silver drop (1-2), a stone in a setting
// in the level's colour from 3, and a crimson crystal at 10.

import { Sex, SpotKind } from '@marchlands/core';

import { BLUE, fill, GOLD, LEATHER, look, type Shades, STEEL } from '../gear/common.ts';
import type { PixelCanvas } from '../pixel.ts';
import { disc } from '../shapes.ts';
import { BELT, layer, part, stone } from './skeleton.ts';

/** Where the charm hangs from the belt. */
const CHARM: readonly [number, number] = [45, BELT[1] + 1];

export function belt(sex: Sex, level: number): PixelCanvas {
  const L = look(level);
  const w = sex === Sex.FEMALE ? 1.5 : 0;
  const band: Shades =
    level === 0
      ? BLUE
      : level === 1
        ? ['steelHi', 'blue', 'blueDark']
        : level === 2
          ? ['hood', 'hoodDark', 'gear0']
          : level === 9
            ? GOLD
            : level >= 10
              ? L.metal
              : LEATHER;
  const strap = part('belt', (c) => {
    fill(
      c,
      [
        [42.5 + w, BELT[0]],
        [57.5 - w, BELT[0]],
        [57.5 - w, BELT[1]],
        [42.5 + w, BELT[1]],
      ],
      band,
    );
    if (level === 2 || (level >= 3 && level < 9)) for (let x = 44 + w; x < 57 - w; x += 3) if (x < 49 || x > 55) c.set(x, BELT[0] + 1, 'steelHi');
    const buckle = level >= 3 ? L.trim : level === 0 ? GOLD : STEEL;
    fill(
      c,
      [
        [50, BELT[0] - 0.5],
        [54, BELT[0] - 0.5],
        [54, BELT[1] + 0.5],
        [50, BELT[1] + 0.5],
      ],
      buckle,
    );
  });
  if (level >= 3) {
    strap.set(52, BELT[0] + 1, L.accent[1]);
    strap.set(51, BELT[0] + 1, L.accent[0]);
    strap.spot(SpotKind.STONE, [51.5, BELT[0] + 1.5], 1);
  }
  const charm = part('charm', (c) => {
    const [x, y] = CHARM;
    if (level === 0) {
      fill(
        c,
        [
          [x - 1, y + 2],
          [x + 2, y + 2],
          [x + 2, y + 6],
          [x - 1, y + 6],
        ],
        ['fireHi', 'gold', 'goldDark'],
      );
      return;
    }
    if (level <= 2) disc(c, x, y + 3.5, 1.6, level === 1 ? 'wool' : 'steel', level === 1 ? 'linen' : 'steelDark');
    else if (level >= 10)
      c.poly(
        [
          [x, y + 1],
          [x + 2, y + 4],
          [x, y + 8],
          [x - 2, y + 4],
        ],
        (px) => (px < x ? 'gear10Hi' : 'gear10'),
      );
    else stone(c, x, y + 3.5, 0.9 + level * 0.06, L.trim, L.accent);
  });
  // the cord or hook from the belt, one pixel, after the outline
  const out = layer(`belt-${level}`, [strap, charm]);
  out.set(CHARM[0], CHARM[1], level === 0 ? 'banner' : level >= 3 ? L.trim[0] : 'steelHi');
  if (level >= 10) {
    out.set(CHARM[0] - 1, CHARM[1] + 3, 'sparkle');
    out.spot(SpotKind.STONE, [CHARM[0], CHARM[1] + 4], 1.5);
  }
  return out;
}
