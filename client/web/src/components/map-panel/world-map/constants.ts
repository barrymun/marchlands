/** A map tile's diamond at the art's own size, and its 64×64 sprite anchored with the diamond's middle at (32, 46). */
export const TILE_W = 64;
export const TILE_H = 32;
export const SPRITE = 64;
export const ANCHOR = { x: 32, y: 46 } as const;

/** The map loads in squares of this many tiles: the most one request may ask for (MAP_VIEW_MAX on the server). */
export const CHUNK = 21;

/** The zoom levels, in screen pixels per art pixel; each is used only where it lands on whole device pixels. */
export const ZOOMS = [1, 1.5, 2, 2.5, 3, 4] as const;

/** The map opens START_STEPS_OUT zoom steps out from the largest zoom that still shows at least this many tiles across. */
export const MIN_TILES_ACROSS = 6;

/** How many zoom steps further out than that the map opens, for a wide first look round. */
export const START_STEPS_OUT = 2;

/** How many tiles an arrow button moves the map: diagonally in tile terms, straight up, down or across on screen. */
export const PAN_STEP = 4;

/** A press that moves less than this many screen pixels is a click, not a drag. */
export const DRAG_SLOP = 4;
