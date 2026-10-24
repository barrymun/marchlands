// The hero figure's upper layer (tools/art/figure.ts): what's worn above the legs, back to front: the far arm, the
// body and its breastplate (a woman's with her own cut), the necklace, the belt and its charm, the pauldrons, the
// shield on the far arm, the near arm and the sword it raises. Each piece is a module of its own beside this one, and
// follows its icon's ladder (tools/art/gear/). The ring doesn't show on the figure, and the mount is only its icon.

import type { Sex } from '@marchlands/core';

import type { PixelCanvas } from '../pixel.ts';
import { farArm, nearArm, shoulders } from './arms.ts';
import { belt } from './belt.ts';
import { breastplate, under } from './chest.ts';
import { necklace } from './necklace.ts';
import { shield } from './shield.ts';
import { layer } from './skeleton.ts';
import { sword } from './sword.ts';

export function figureUpper(sex: Sex, level: number): PixelCanvas {
  return layer(`upper-${sex}-${level}`, [
    farArm(level),
    under(sex, level),
    breastplate(sex, level),
    necklace(level),
    belt(sex, level),
    shoulders(level),
    shield(level),
    nearArm(level),
    sword(level),
  ]);
}
