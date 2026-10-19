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
