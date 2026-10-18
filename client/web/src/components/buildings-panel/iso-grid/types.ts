/** What a tile of the isometric grid holds: a building slot, a locked field, or the gate in the walls. */
type IsoTileKind = 'slot' | 'locked' | 'gate';

/**
 * One building tile of the grid, at a column and row of the diamond (column runs down-right on screen, row down-left).
 * Tiles may sit at fractional positions: slots are spaced out over the ground.
 */
export interface IsoTile {
  col: number;
  row: number;
  kind: IsoTileKind;
  /** The building position on this tile (a slot, a locked field, the gate). */
  pos?: number;
  /** How many tiles across the tile is: 2 for the Town Hall's block, 1 when left out. */
  span?: number;
}

/** A whole tile of the grass the buildings stand on. */
export interface GroundTile {
  col: number;
  row: number;
}

/** A grid to draw: its building tiles, and the ground (`cols` × `rows` whole tiles) they stand on. */
export interface IsoLayout {
  tiles: readonly IsoTile[];
  ground: readonly GroundTile[];
  cols: number;
  rows: number;
}

/**
 * A sprite placed on the grid: its tile point, how far forward it is drawn (`depth`), the building it opens, and its
 * size in pixels (64 when left out, 128 for the Town Hall).
 */
export interface IsoSprite {
  key: string;
  col: number;
  row: number;
  src: string;
  depth: number;
  pos?: number;
  size?: number;
}

/** A point in grid pixels, at the art's own size. */
export interface GridPoint {
  x: number;
  y: number;
}
