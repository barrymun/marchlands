/** The map loads in squares of this many tiles: the most one request may ask for (MAP_VIEW_MAX on the server). */
export const CHUNK = 21;

/** The map opens START_STEPS_OUT zoom steps out from the largest zoom that still shows at least this many tiles across. */
export const MIN_TILES_ACROSS = 6;

/** How many zoom steps further out than that the map opens, for a wide first look round. */
export const START_STEPS_OUT = 2;

/** How many tiles an arrow button moves the map: diagonally in tile terms, straight up, down or across on screen. */
export const PAN_STEP = 4;

/** The historic cities' map sprites are this big, taller than every other tile's (lib/game-art.ts historicArtFile). */
export const HISTORIC_SPRITE = 96;

/** Farm targets' outlines: dashed, this city's bright, the player's other cities' pale (the key matches them). */
export const FARM_OUTLINE = {
  here: { className: 'stroke-sky-400', width: 2.5, dash: '5 3' },
  other: { className: 'stroke-sky-200/80', width: 2, dash: '5 3' },
} as const;
