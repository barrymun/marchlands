/** A tile's diamond at the art's own size: 64 pixels across and 32 down. */
export const TILE_W = 64;
export const TILE_H = 32;

/** A sprite's size in pixels, unless it says otherwise (the grand Town Hall is twice it). */
export const SPRITE = 64;

/**
 * The zoom levels, in screen pixels per art pixel: where the view opens and where the buttons and keys step, each used
 * only where it lands on whole device pixels. The wheel, the trackpad and a pinch zoom smoothly anywhere between the
 * first and the last.
 */
export const ZOOMS = [1, 1.5, 2, 2.5, 3, 4] as const;

/** How often an animated scene is redrawn, a second: a pixel-art pace, cheap enough for a few thousand pieces. */
export const ANIMATION_FPS = 12;

/** A press that moves less than this many screen pixels is a click, not a drag. */
export const DRAG_SLOP = 4;

/** How far an arrow key moves the view, in tiles. */
export const KEY_STEP = 1;

/**
 * How fast the wheel zooms: the zoom changes by a factor of e for every 1 / WHEEL_RATE pixels of scrolling, so a mouse
 * wheel's notch (about 100 pixels) zooms by about a fifth, and a trackpad's stream of small scrolls glides.
 */
export const WHEEL_RATE = 0.002;

/** The same for a trackpad pinch, which browsers send as wheel events with Ctrl held and much smaller deltas. */
export const PINCH_WHEEL_RATE = 0.01;

/** Pixels in a line of scrolling, for a wheel that counts in lines (Firefox with a mouse). */
export const WHEEL_LINE = 16;

/** How a sprite stands out: brightened (under the pointer, a filter match) or faded (filtered out). */
export const DrawableTone = { LIT: 'lit', DIM: 'dim' } as const;
export type DrawableTone = (typeof DrawableTone)[keyof typeof DrawableTone];

/** The halves of a tile's outline: the back one goes before what stands on the tile, the front one after. */
export const OutlineHalf = { BACK: 'back', FRONT: 'front' } as const;
export type OutlineHalf = (typeof OutlineHalf)[keyof typeof OutlineHalf];

/** Weather over a scene. */
export const Weather = { RAIN: 'rain', SNOW: 'snow', STORM: 'storm' } as const;
export type Weather = (typeof Weather)[keyof typeof Weather];
