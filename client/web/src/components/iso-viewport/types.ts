/** Where a view looks: the tile (fractional) at its middle, and screen pixels per art pixel. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** A view's size in CSS pixels, and the device pixels to each. */
export interface View {
  w: number;
  h: number;
  dpr: number;
}

/** A point of a view, in CSS pixels from its top left. */
export interface ViewPoint {
  x: number;
  y: number;
}

/**
 * A sprite to draw: its tile (column runs down-right on screen, row down-left; fractional for spaced-out slots), its
 * image, its size in pixels (64 when left out), and how it stands out: `lit` brightened (under the pointer, a filter
 * match), `dim` faded (filtered out).
 */
export interface Drawable {
  key: string;
  col: number;
  row: number;
  src: string;
  size?: number;
  tone?: 'lit' | 'dim';
}

/** A small pixel-art image made in code (an animation frame): RGBA pixels at the art's own size, named by `id` for caching. */
export interface PixelArt {
  id: string;
  w: number;
  h: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * A frame laid over the scene (smoke, a turning sail, a walker): drawn with its top left `x`, `y` art pixels from the
 * middle of tile (col, row), at `alpha` (1 when left out).
 */
export interface Overlay {
  key: string;
  col: number;
  row: number;
  art: PixelArt;
  x: number;
  y: number;
  alpha?: number;
  /** it gives light (a lit window, a fire): drawn over the night's darkness rather than under it */
  light?: boolean;
}

/** Weather over a scene. */
export type Weather = 'rain' | 'snow' | 'storm';

/**
 * The sky over a scene at a moment: how dark it is (0 day, 1 deep night), the weather and its drops or flakes (in CSS
 * pixels of the view), and a lightning flash (0 none, 1 full).
 */
export interface Sky {
  darkness: number;
  weather: Weather | null;
  particles: readonly Particle[];
  flash: number;
}

/** A raindrop or snowflake, in CSS pixels of the view, and how long it is (a raindrop's streak). */
export interface Particle {
  x: number;
  y: number;
  len: number;
}

/**
 * Half of a tile's outline on the ground (a valley held, the selection), placed among the pieces in the scene's order:
 * the `back` half (its two far edges, from the left corner over the top to the right) goes before what stands on the
 * tile and the `front` half (the two near edges) after it, so whatever stands in front of an edge hides it. Its colour
 * is the stroke of a CSS class (`className`, `stroke-sky-400`), its width and dashes in CSS pixels.
 */
export interface Outline {
  key: string;
  col: number;
  row: number;
  half: 'back' | 'front';
  className: string;
  width: number;
  dash?: readonly number[];
}

/** Anything the viewport draws over the ground, back to front: a sprite, an overlay or half a tile's outline. */
export type Piece = Drawable | Overlay | Outline;

/** The box a scene's sprites fill, at the art's own size: its size, and where the middle of tile (0, 0) falls in it. */
export interface SceneBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** A direction the arrows move a view, on screen. */
export type PanDirection = 'up' | 'down' | 'left' | 'right';
