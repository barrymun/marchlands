/** A map tile's diamond at the art's own size: 64 pixels across and 32 down. */
export const TILE_W = 64;
export const TILE_H = 32;

/** A sprite's size in pixels (building, ground, wall piece); the Town Hall's is twice that. */
export const SPRITE = 64;

/** How far apart slots stand, in tiles: a little grass between neighbours, so tall buildings don't crowd each other. */
export const SLOT_PITCH = 1.3;

/** The Town Hall's and the Walls' positions. */
export const TOWN_HALL = -1;
export const WALLS = -2;

/** The screen height kept clear of a grid (the header and the card's title), so a whole grid fits on screen. */
export const HEADROOM = '13rem';
