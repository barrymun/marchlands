// The charm (tools/art/gear.ts): a small gold tag on a red cord (0), then a pair of drop earrings: pearls (1), silver
// drops (2), and from 3 stones in the level's colour in settings that grow, a second stone from 6, wings from 8, and
// at 10 crimson crystals in silver.

import { GearPieceId, SpotKind } from '@marchlands/core';

import { Colour } from '../../../client/web/src/lib/palette.ts';
import type { PixelCanvas } from '../pixel.ts';
import { disc } from '../shapes.ts';
import { canvas, fill, gem, look, setStone, shine, spike } from './common.ts';

export function charm(level: number): PixelCanvas {
  const c = canvas(GearPieceId.CHARM, level);
  // the tag or the drops swing as one below where they hang from the cord or the hooks
  c.spot(SpotKind.SWING, [16, level === 0 ? 11 : 13]);
  if (level === 0) {
    // a gold tag, engraved, hung from a loop of cord
    fill(
      c,
      [
        [12, 12],
        [20, 12],
        [20, 26],
        [12, 26],
      ],
      [Colour.FIRE_HI, Colour.GOLD, Colour.GOLD_DARK],
    );
    for (let y = 15; y < 24; y += 3) c.line([14, y], [18, y], Colour.GOLD_DARK);
    c.outline();
    c.line([14, 11], [12, 4], Colour.BANNER);
    c.line([18, 11], [20, 4], Colour.BANNER_DARK);
    c.line([12, 4], [20, 4], Colour.BANNER);
    return c;
  }
  const L = look(level);
  for (const x of [10, 22]) {
    if (level === 1) disc(c, x, 17, 3, Colour.WOOL, Colour.LINEN);
    else if (level === 2) {
      disc(c, x, 18, 2.6, Colour.STEEL, Colour.STEEL_DARK);
      c.poly(
        [
          [x - 2, 17],
          [x + 2, 17],
          [x, 12],
        ],
        Colour.STEEL,
      );
    } else if (level >= 10) {
      // a crystal, its point down
      c.poly(
        [
          [x, 11],
          [x + 3.5, 17],
          [x, 26],
          [x - 3.5, 17],
        ],
        (px) => (px < x ? Colour.GEAR_10_HI : Colour.GEAR_10),
      );
    } else {
      const r = 1.6 + level * 0.15;
      setStone(c, x, 18, r, L.trim, L.accent);
      if (level >= 6) disc(c, x, 25, 2.2, L.trim[1], L.trim[2]);
    }
  }
  c.outline();
  // the hooks after the outline, one pixel thick
  for (const x of [10, 22]) {
    const hook = level >= 3 ? L.trim[0] : Colour.STEEL_HI;
    c.line([x, 13], [x, 9], hook);
    c.line([x, 9], [x + 2, 6], hook);
    c.line([x + 2, 6], [x + 3, 8], hook);
    if (level >= 6 && level < 10) gem(c, x, 24, 1, L.accent);
    if (level >= 8) {
      spike(c, [x - 3, 17], [x - 5, 13], L.trim);
      spike(c, [x + 3, 17], [x + 5, 13], L.trim);
    }
    if (level >= 10) shine(c, x - 1, 15);
  }
  return c;
}
