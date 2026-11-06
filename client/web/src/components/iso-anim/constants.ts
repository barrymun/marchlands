import { SpotKind } from '@marchlands/core';

import spotsJson from '@/assets/spots.json';
import type { Rgb, Spot, TownState } from '@/components/iso-anim/types';
import type { ArmySide } from '@/lib/game-art';
import { PALETTE } from '@/lib/palette';

/** Where the moving parts stand on every sprite drawn in code, by `<folder>/<file>` (npm run art:draw). */
export const SPOTS = spotsJson as Record<string, readonly Spot[]>;

/** The base colours the animations use (lib/palette.ts), by what they draw. */
export const C = {
  outline: PALETTE.OUTLINE,
  wood: PALETTE.WOOD,
  canvas: PALETTE.WALL_TOP,
  logDark: PALETTE.LOG_DARK,
  logEnd: PALETTE.LOG_END,
  smoke: PALETTE.SMOKE,
  smokeDark: PALETTE.SMOKE_DARK,
  fire: PALETTE.FIRE,
  fireHi: PALETTE.FIRE_HI,
  banner: PALETTE.BANNER,
  bannerDark: PALETTE.BANNER_DARK,
  horse: PALETTE.HORSE,
  horseDark: PALETTE.HORSE_DARK,
  wool: PALETTE.WOOL,
  woolShade: PALETTE.WOOL_SHADE,
  dust: PALETTE.SANDSTONE_HI,
  dustDark: PALETTE.SANDSTONE_L,
  dustDeep: PALETTE.SANDSTONE_R,
  granite: PALETTE.GRANITE_L,
  graniteDark: PALETTE.GRANITE_R,
  white: PALETTE.LAMP_WHITE,
  lamp: PALETTE.LAMP,
  gold: PALETTE.GOLD,
  plank: PALETTE.PLANK_TOP,
  skin: PALETTE.SKIN,
  hair: PALETTE.HORSE_DARK,
  metal: PALETTE.METAL,
} as const satisfies Record<string, Rgb>;

/** Banner colours of armies on the map, by whose they are. */
export const SIDE_COLOURS: Readonly<Record<ArmySide, Rgb>> = {
  own: PALETTE.BLUE,
  ally: PALETTE.LEAF,
  enemy: PALETTE.BANNER,
};

/** Clothes people in the town wear, one picked for each (seeded). */
export const CLOTHES = [
  PALETTE.BANNER,
  PALETTE.BLUE,
  PALETTE.LEAF,
  PALETTE.THATCH_L,
  PALETTE.BANNER_DARK,
  PALETTE.WOOL,
  PALETTE.LOG_DARK,
] as const satisfies readonly Rgb[];

/** Spots whose part is drawn moving over a bare sprite (tools/art/draw.ts, MOVING). */
export const MOVING_SPOTS: ReadonlySet<SpotKind> = new Set([SpotKind.SAILS, SpotKind.WHEEL, SpotKind.SHEEP]);

/** A smoke plume's frames, and how many puffs rise in it at once. */
export const SMOKE_FRAMES = 10;
export const SMOKE_PUFFS = 3;

/** Sails turn a quarter (their pattern repeats) over this many frames; a wheel turns an eighth. */
export const SAIL_FRAMES = 6;
export const WHEEL_FRAMES = 6;

/** A quarry's dust plume's frames, and a blast's. */
export const DUST_FRAMES = 12;
export const BLAST_FRAMES = 10;
/** A quarry blasts once in this many seconds (each quarry at its own moment). */
export const BLAST_EVERY_S = 18;

/** How fast people walk, in tiles a second, and how many steps a walker's route has before it turns back. */
export const WALK_SPEED = 0.4;
export const ROUTE_STEPS = 12;

/** A city doing nothing in particular: what the buildings show until the town's state has loaded. */
export const QUIET_TOWN: TownState = {
  training: [],
  cavalry: false,
  siege: false,
  research: false,
  forts: false,
  injured: false,
  enemy: false,
  armyOut: false,
  zoneId: 0,
  attackedAt: null,
};

/** How long a town smoulders after an attack (ms, real time), its fires dying down as it goes. */
export const AFTERMATH_MS = 30 * 60 * 1000;
/** How many buildings at most burn after an attack. */
export const AFTERMATH_FIRES = 4;

/** Construction's frames (builders' hammers up and down, dust now and then). */
export const BUILD_FRAMES = 8;
/** A finished level's sparkle: its frames, and how long it shows (ms) after the building finished. */
export const SPARKLE_FRAMES = 10;
export const SPARKLE_MS = 1250;
