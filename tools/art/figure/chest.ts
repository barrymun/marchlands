// The hero figure's chest (tools/art/figure/upper.ts): the body under the breastplate (a padded coat, or mail from 3)
// and the breastplate over it, as the chest icon (tools/art/gear/chest.ts): blue steel with blue padding trimmed in gold
// (0), steel (1-2), trimmed in gold with a stone in the level's colour from 3, a raised collar from 6, gilded at 9 and
// crimson trimmed in silver at 10. A woman's is narrower at the waist and shaped over the bust.

import { Sex } from '@marchlands/core';

import { BLUE, CLOTH, fill, GOLD, lit, look, type Shades, STEEL, trimmed } from '../gear/common.ts';
import type { Colour, PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { part, stone, torso } from './skeleton.ts';

/** The breastplate's metal and trim at a level. */
export function plate(level: number): { metal: Shades; trim: Shades | null } {
  if (level === 0) return { metal: BLUE, trim: GOLD };
  if (level <= 2) return { metal: STEEL, trim: null };
  const L = look(level);
  return { metal: L.metal, trim: L.trim };
}

/** Chain mail: rows of rings, lit on the left. */
const mail =
  (cx: number) =>
  (x: number, y: number): Colour =>
    (x + y) % 2 ? (x < cx ? 'mailHi' : 'mail') : 'steelDark';

/** The breastplate, from the collar to the belt; a woman's shaped over the bust and narrower at the waist. */
export function breastplate(sex: Sex, level: number): PixelCanvas {
  const L = look(level);
  const { metal, trim } = plate(level);
  const female = sex === Sex.FEMALE;
  return part('chest', (c) => {
    const pts: Pt[] = female
      ? [
          [42, 23],
          [57, 23],
          [60, 27],
          [57.5, 35],
          [56, 43],
          [44, 43],
          [42.5, 35],
          [40, 27],
        ]
      : [
          [42, 23],
          [57, 23],
          [60, 27],
          [58.5, 36],
          [57.5, 43],
          [42.5, 43],
          [41.5, 36],
          [40, 27],
        ];
    if (trim) trimmed(c, pts, metal, trim, 1.4);
    else fill(c, pts, metal);
    // the neck cut out
    oval(c, 50, 22, 4, 2.4, 'clear');
    if (female) {
      // the plate shaped over the bust, each side a dome lit from the top left
      oval(c, 46, 30.5, 3.8, 3.2, lit(45.5, 30, 3.6, metal));
      oval(c, 55, 30.5, 3, 2.8, lit(54.5, 30, 3, metal));
      for (const [x0, x1, y] of [
        [43, 49, 34],
        [53, 57, 33],
      ] as const)
        for (let x = x0; x <= x1; x++) c.set(x, y, metal[2]);
    }
    // the ridge down the front, turned towards the right with the body
    if (level === 0) for (let y = 27; y < 42; y += 3) for (let x = 43; x < 58; x++) if (c.get(x, y) === BLUE[1]) c.set(x, y, 'blueDark');
    if (level >= 1) for (let y = female ? 35 : 26; y < 42; y++) c.set(52, y, metal[2]);
    if (level >= 3) stone(c, female ? 51 : 52, female ? 37 : 35, 1.2 + level * 0.1, trim ?? GOLD, L.accent);
    if (level >= 6) {
      // a raised collar
      const col = trim ?? GOLD;
      c.poly(
        [
          [43, 19],
          [46, 18],
          [47, 24],
          [43, 24],
        ],
        lit(45, 21, 3, col),
      );
      c.poly(
        [
          [54, 18],
          [57, 19],
          [57, 24],
          [54, 24],
        ],
        lit(55, 21, 3, col),
      );
    }
  });
}

/** The body under the breastplate: a padded coat, or mail from 3. */
export function under(sex: Sex, level: number): PixelCanvas {
  return part('under', (c) => {
    if (level <= 2) fill(c, torso(sex), CLOTH);
    else c.poly(torso(sex), mail(48));
  });
}
