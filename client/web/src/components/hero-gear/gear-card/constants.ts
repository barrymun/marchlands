import { FRAME_MS } from '@/components/hero-gear/gear-icon/constants';

/** Where the gear card remembers the last gear level it showed, by player (docs/features/gear-animations.md, the bursts). */
export const GEAR_LEVEL_KEY = 'marchlands-gear-level';

/** A level burst runs across the pieces one after another, each a frame of the icons' clock after the one before (two never start together). */
export const LEVEL_BURST_STAGGER_MS = FRAME_MS;
