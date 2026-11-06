import spotsJson from '@/assets/spots.json';
import type { Spot } from '@/components/iso-anim/types';
import { PALETTE } from '@/lib/palette';

/** The figure's layers by file name (`upper-f-3.png`, lib/game-art.ts); Vite gives each file a hashed name. */
export const FIGURE_ART: Record<string, string> = Object.fromEntries(
  Object.entries(import.meta.glob<string>('@/assets/figure/*.png', { eager: true, query: '?url', import: 'default' })).map(([file, url]) => [
    file.slice(file.lastIndexOf('/') + 1),
    url,
  ]),
);

/** Where the capes stir and level 10's stones lie, by `figure/<file>` (npm run art:draw). */
export const FIGURE_SPOTS = spotsJson as Record<string, readonly Spot[] | undefined>;

/** Every layer is a square of this many pixels, drawn at whole multiples. */
export const FIGURE_SIZE = 96;

/** One breath, in and out: the body rises a pixel for part of it. */
export const BREATH_MS = 3600;
/** The part of a breath the body is raised, from and to (shares of BREATH_MS). */
export const BREATH_UP: readonly [number, number] = [0.35, 0.75];
/** One stir of the cape, and how many pixels its hem moves at most. */
export const SWAY_MS = 2800;
export const SWAY_PX = 1.4;
/** One pulse of the stones' glow, and its colour (the gear's level 10 light, softened). */
export const GLOW_MS = 2000;
export const GLOW_RGB: readonly [number, number, number] = PALETTE.STONE_GLOW;

/** How a layer moves: the cape stirs, the body breathes, the legs stand still. */
export const FigureMotion = { SWAY: 'sway', BREATH: 'breath', STILL: 'still' } as const;
export type FigureMotion = (typeof FigureMotion)[keyof typeof FigureMotion];
