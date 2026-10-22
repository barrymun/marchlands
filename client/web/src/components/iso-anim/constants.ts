import spotsJson from '@/assets/spots.json';
import type { Rgb, Side, Spot, TownState } from '@/components/iso-anim/types';

/** Where the moving parts stand on every sprite drawn in code, by `<folder>/<file>` (npm run art:draw). */
export const SPOTS = spotsJson as Record<string, readonly Spot[]>;

/** The sprites' palette colours the animations use (tools/art/pixel.ts, PALETTE). */
export const C = {
  outline: [52, 36, 28],
  wood: [122, 88, 56],
  canvas: [246, 238, 216],
  logDark: [104, 72, 42],
  logEnd: [210, 172, 116],
  smoke: [176, 176, 180],
  smokeDark: [142, 142, 148],
  fire: [240, 132, 40],
  fireHi: [252, 222, 100],
  banner: [178, 44, 44],
  bannerDark: [128, 30, 32],
  horse: [124, 78, 46],
  horseDark: [86, 52, 30],
  wool: [242, 240, 230],
  woolShade: [214, 210, 198],
  dust: [222, 200, 156],
  dustDark: [196, 170, 122],
  dustDeep: [156, 130, 90],
  granite: [206, 204, 196],
  graniteDark: [160, 158, 152],
  white: [255, 250, 236],
  lamp: [255, 214, 140],
  gold: [232, 186, 72],
  plank: [176, 132, 86],
  skin: [234, 186, 142],
  hair: [86, 52, 30],
  metal: [150, 156, 166],
} as const satisfies Record<string, Rgb>;

/** Banner colours of armies on the map, by whose they are. */
export const SIDE_COLOURS: Readonly<Record<Side, Rgb>> = {
  own: [72, 112, 172],
  ally: [92, 134, 66],
  enemy: [178, 44, 44],
};

/** Clothes people in the town wear, one picked for each (seeded). */
export const CLOTHES = [
  [178, 44, 44],
  [72, 112, 172],
  [92, 134, 66],
  [190, 150, 82],
  [128, 30, 32],
  [242, 240, 230],
  [104, 72, 42],
] as const satisfies readonly Rgb[];

/** Spots whose part is drawn moving over a bare sprite (tools/art/draw.ts, MOVING). */
export const MOVING_SPOTS: ReadonlySet<string> = new Set(['sails', 'wheel', 'sheep']);

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
