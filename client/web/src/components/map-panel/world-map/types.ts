/** Where the map looks: the tile (fractional) at the middle of the view, and screen pixels per art pixel. */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** The view's size in CSS pixels, and the device pixels to each. */
export interface View {
  w: number;
  h: number;
  dpr: number;
}

/** A tile's type and level, as the map sends them. */
export interface TileInfo {
  type: number;
  level: number;
}

/** A square of the map to load: its first and last column and row (inclusive; the server wraps them round the edge). */
export interface ChunkArea {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A direction the arrow buttons and keys move the map, on screen. */
export type PanDirection = 'up' | 'down' | 'left' | 'right';
