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

/** The box a scene's sprites fill, at the art's own size: its size, and where the middle of tile (0, 0) falls in it. */
export interface SceneBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** A direction the arrows move a view, on screen. */
export type PanDirection = 'up' | 'down' | 'left' | 'right';
