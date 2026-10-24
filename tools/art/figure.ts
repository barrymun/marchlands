// The hero figure on the Heroes page's character sheet (docs/features/hero-figure-art.md): a man or a woman drawn
// wearing the 14 gear pieces at one level, in layers the client stacks back to front (cape, legs, skin, upper, hair,
// helm), so a body's skin tone and hair are files of their own and every level's gear fits every body. The stones
// glow at level 10 only, so only level 10's are kept as spots.

import type { Sex } from '@marchlands/core';

import { figureCape } from './figure/cape.ts';
import { figureHelm } from './figure/helm.ts';
import { figureLegs } from './figure/legs.ts';
import { figureUpper } from './figure/upper.ts';
import type { PixelCanvas } from './pixel.ts';

/** Drop the stones' spots below level 10, where nothing glows. */
function glowing(c: PixelCanvas, level: number): PixelCanvas {
  if (level < 10) c.spots.splice(0, c.spots.length, ...c.spots.filter((s) => s.k !== 'stone'));
  return c;
}

/** The layers that follow the gear level, by name: the cape and helm by level, the legs and upper body by sex too. */
export const FIGURE_GEAR = {
  cape: (level: number) => glowing(figureCape(level), level),
  helm: (level: number) => glowing(figureHelm(level), level),
  legs: (sex: Sex, level: number) => glowing(figureLegs(sex, level), level),
  upper: (sex: Sex, level: number) => glowing(figureUpper(sex, level), level),
};
