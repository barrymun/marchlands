import { SpotKind } from '@marchlands/core';

import spotsJson from '@/assets/spots.json';
import type { Rgb, Spot } from '@/components/iso-anim/types';
import { ANIMATION_FPS } from '@/components/iso-viewport/constants';

/** Where the glints, glowing blades and stars stand on each gear sprite, by `gear/<file>` (npm run art:draw -- gear). */
export const GEAR_SPOTS = spotsJson as Record<string, readonly Spot[] | undefined>;

/** Every gear piece and backdrop is this many pixels square, and the icon's canvas with them. */
export const GEAR_SIZE = 32;

/** The gear levels each effect starts at (docs/features/gear-animations.md): stones glint, then glow, then a glint crosses the metal. */
export const GLINT_FROM = 3;
export const HALO_FROM = 6;
export const SWEEP_FROM = 9;

/** One frame of the icons' movement, as the town's: the effects that count frames are timed in these. */
export const FRAME_MS = 1000 / ANIMATION_FPS;

/** A stone flares once in this long (ms), for a frame per entry of GLINT_ARMS: its arms then, and how bright. */
export const GLINT_EVERY_MS = 6000;
export const GLINT_ARMS: readonly (readonly [arms: number, alpha: number])[] = [
  [1, 200],
  [2, 255],
  [1, 220],
  [0, 160],
];

/** A backdrop star flares once in this long (ms): its arms grow by a pixel for STAR_FRAMES frames. */
export const STAR_EVERY_MS = 3400;
export const STAR_FRAMES = 4;

/** A glint crosses gilded and crimson metal once in this long (ms), taking SWEEP_MS. */
export const SWEEP_EVERY_MS = 7000;
export const SWEEP_MS = 900;

/** One slow pulse of a stone's glow and a glowing blade below level 10 (ms); level 10 keeps the figure's (GLOW_MS). */
export const PULSE_MS = 2600;
/** How bright a glowing blade gets at the top of its pulse (0-255). */
export const BLADE_ALPHA = 96;

/** A burst (a star added, a level gained): its frames, the piece's white flash at each of the first, and how many sparks fly out. */
export const BURST_FRAMES = 12;
export const BURST_FLASH: readonly number[] = [170, 110, 60, 25];
export const BURST_SPARKS = 12;

/** The pieces' own movement (spots the art scripts record at its pivot): which kinds there are. */
export const MOVE_KINDS: ReadonlySet<SpotKind> = new Set([SpotKind.STIR, SpotKind.FLAP, SpotKind.NOD, SpotKind.SWING, SpotKind.SWAY]);
/** A piece moves by itself once in this long (ms), for MOVE_MS. */
export const MOVE_EVERY_MS = 5500;
export const MOVE_MS = 1500;
/** How far each movement goes at its furthest point (pixels, before rounding): a cape's hem, a plume's tip, a wing's tip, the muzzle, a pendant. */
export const MOVE_PX: Readonly<Partial<Record<SpotKind, number>>> = {
  [SpotKind.STIR]: 1.6,
  [SpotKind.SWAY]: 1.6,
  [SpotKind.FLAP]: 2,
  [SpotKind.NOD]: 1.4,
  [SpotKind.SWING]: 1.4,
};

/** The sprites' palette colours the icons move in (tools/art/pixel.ts, PALETTE): white light, gold (a burst's sparks below level 3), and each level's bright colour (gearNHi). */
export const WHITE: Rgb = [255, 255, 255];
export const GOLD: Rgb = [232, 186, 72];
export const GEAR_LIGHT: Readonly<Record<number, Rgb>> = {
  3: [104, 140, 236],
  4: [92, 204, 184],
  5: [132, 112, 226],
  6: [188, 104, 178],
  7: [244, 100, 192],
  8: [252, 162, 74],
  9: [252, 224, 112],
  10: [244, 96, 116],
};
