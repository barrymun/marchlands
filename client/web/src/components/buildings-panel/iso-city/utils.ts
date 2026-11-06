import { WALLS } from '@/components/buildings-panel/iso-grid/constants';
import type { IsoSprite } from '@/components/buildings-panel/iso-grid/types';
import { CityWallPiece } from '@/lib/game-art';

/**
 * The walls round a `cols` × `rows` town, as sprites (`artOf` gives a piece's image): a stretch of wall along every
 * tile's outer edge, towers on the back, left and right corners, and the gate (the Walls' building) on the front
 * corner. The back walls are drawn before everything inside and the front walls after, so buildings stand between them.
 */
export function wallSprites(cols: number, rows: number, artOf: (piece: CityWallPiece) => string): IsoSprite[] {
  const back = -1000;
  const front = 1000;
  return [
    { key: 'tower-back', col: -0.5, row: -0.5, src: artOf(CityWallPiece.TOWER), depth: back - 1 },
    ...Array.from({ length: cols }, (_, c) => ({ key: `wall-back-x${c}`, col: c, row: -0.5, src: artOf(CityWallPiece.WALL_X), depth: back + c })),
    ...Array.from({ length: rows }, (_, r) => ({ key: `wall-back-y${r}`, col: -0.5, row: r, src: artOf(CityWallPiece.WALL_Y), depth: back + r })),
    ...Array.from({ length: cols }, (_, c) => ({ key: `wall-front-x${c}`, col: c, row: rows - 0.5, src: artOf(CityWallPiece.WALL_X), depth: front + c })),
    ...Array.from({ length: rows }, (_, r) => ({ key: `wall-front-y${r}`, col: cols - 0.5, row: r, src: artOf(CityWallPiece.WALL_Y), depth: front + r })),
    { key: 'tower-left', col: -0.5, row: rows - 0.5, src: artOf(CityWallPiece.TOWER), depth: front + cols + rows },
    { key: 'tower-right', col: cols - 0.5, row: -0.5, src: artOf(CityWallPiece.TOWER), depth: front + cols + rows },
    { key: 'gate', col: cols - 0.5, row: rows - 0.5, src: artOf(CityWallPiece.GATE), depth: front + cols + rows + 1, pos: WALLS },
  ];
}
