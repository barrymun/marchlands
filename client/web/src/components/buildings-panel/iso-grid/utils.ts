import type { BuildingArt, GridPoint, GroundTile, IsoLayout, IsoSprite, IsoTile } from '@/components/buildings-panel/iso-grid/types';
import { SPRITE, TILE_H, TILE_W } from '@/components/iso-viewport/constants';
import { spriteBox } from '@/components/iso-viewport/utils';

/**
 * The middle of a tile's diamond, in pixels from the middle of tile (0, 0), at the art's own size, rounded to a whole
 * pixel: tiles at fractional positions (spaced-out slots) must still land on the pixel grid, or the art blurs.
 */
export function tilePoint(col: number, row: number): GridPoint {
  return { x: Math.round(((col - row) * TILE_W) / 2) + 0, y: Math.round(((col + row) * TILE_H) / 2) + 0 };
}

/** How far forward a tile is: tiles further forward are drawn later, over the ones behind. */
export function depthOf(col: number, row: number): number {
  return col + row;
}

/** Every cell of a `cols` × `rows` diamond, back to front and, at the same depth, left to right. */
export function gridCells(cols: number, rows: number): [number, number][] {
  const cells: [number, number][] = [];
  for (let col = 0; col < cols; col++) for (let row = 0; row < rows; row++) cells.push([col, row]);
  return cells.sort((a, b) => depthOf(...a) - depthOf(...b) || a[0] - a[1] - (b[0] - b[1]));
}

/**
 * Spacing `n` slots `pitch` tiles apart: the ground they need, in whole tiles (their span plus `extra` spare tiles),
 * and the `margin` from the ground's first tile to the first slot, so the slots sit in the middle of it.
 */
export function spacing(n: number, pitch: number, extra: number): { ground: number; margin: number } {
  const ground = Math.round((n - 1) * pitch) + 1 + extra;
  return { ground, margin: (ground - 1 - (n - 1) * pitch) / 2 };
}

/** Every whole tile of a `cols` × `rows` ground. */
function groundTiles(cols: number, rows: number): GroundTile[] {
  return gridCells(cols, rows).map(([col, row]) => ({ col, row }));
}

/**
 * The town inside the walls: a `cols` × `rows` diamond of slots `pitch` tiles apart on a square of grass. The Town Hall
 * covers the 2×2 block of cells from `townHall`, the building `positions` fill every other cell in order (back to
 * front), and the gate stands on the ground's front corner.
 */
export function townLayout(o: {
  cols: number;
  rows: number;
  pitch: number;
  extra: number;
  townHall: readonly [number, number];
  positions: readonly number[];
  townHallPos: number;
  wallsPos: number;
}): IsoLayout {
  const c = spacing(o.cols, o.pitch, o.extra);
  const r = spacing(o.rows, o.pitch, o.extra);
  const [hi, hj] = o.townHall;
  const inHall = ([i, j]: [number, number]) => i >= hi && i <= hi + 1 && j >= hj && j <= hj + 1;
  const free = gridCells(o.cols, o.rows).filter((cell) => !inHall(cell));
  if (free.length !== o.positions.length) throw new Error(`${free.length} free cells for ${o.positions.length} slots`);
  return {
    tiles: [
      { col: c.margin + (hi + 0.5) * o.pitch, row: r.margin + (hj + 0.5) * o.pitch, kind: 'slot' as const, pos: o.townHallPos, span: 2 },
      ...free.map(([i, j], n) => ({ col: c.margin + i * o.pitch, row: r.margin + j * o.pitch, kind: 'slot' as const, pos: o.positions[n] })),
      { col: c.ground - 0.5, row: r.ground - 0.5, kind: 'gate' as const, pos: o.wallsPos },
    ].sort((a, b) => depthOf(a.col, a.row) - depthOf(b.col, b.row)),
    ground: groundTiles(c.ground, r.ground),
    cols: c.ground,
    rows: r.ground,
  };
}

/**
 * The fields outside the walls: a `cols` × `rows` diamond of fields `pitch` tiles apart on grass, the first
 * `unlocked` positions (back to front) open and the rest locked.
 */
export function fieldLayout(o: { cols: number; rows: number; pitch: number; extra: number; positions: readonly number[]; unlocked: number }): IsoLayout {
  const cells = gridCells(o.cols, o.rows);
  if (cells.length !== o.positions.length) throw new Error(`${cells.length} cells for ${o.positions.length} fields`);
  const c = spacing(o.cols, o.pitch, o.extra);
  const r = spacing(o.rows, o.pitch, o.extra);
  return {
    tiles: cells.map(([i, j], n) => ({
      col: c.margin + i * o.pitch,
      row: r.margin + j * o.pitch,
      kind: n < o.unlocked ? ('slot' as const) : ('locked' as const),
      pos: o.positions[n],
    })),
    ground: groundTiles(c.ground, r.ground),
    cols: c.ground,
    rows: r.ground,
  };
}

/** Whether a point (dx, dy) from the middle of a tile lies on its diamond, `span` tiles across. */
export function inDiamond(dx: number, dy: number, span = 1): boolean {
  return Math.abs(dx) / ((TILE_W / 2) * span) + Math.abs(dy) / ((TILE_H / 2) * span) <= 1;
}

/**
 * The building position under point `p` (pixels from the middle of tile (0, 0), at the art's own size). Sprites stand
 * over the ground, so they are tried first, front to back, by their own pixels (`opaque(src, x, y)`, x and y inside the
 * image); then the tiles' diamonds, front to back. Locked tiles and sprites without a position never answer.
 */
export function hitTest(
  p: GridPoint,
  sprites: readonly IsoSprite[],
  tiles: readonly IsoTile[],
  opaque: (src: string, x: number, y: number) => boolean,
): number | undefined {
  const front = <T extends { col: number; row: number }>(list: readonly T[], depth: (t: T) => number) => [...list].sort((a, b) => depth(b) - depth(a));
  for (const s of front(
    sprites.filter((s) => s.pos != null),
    (s) => s.depth,
  )) {
    const at = tilePoint(s.col, s.row);
    const box = spriteBox(s.size);
    const x = Math.floor(p.x - at.x - box.left);
    const y = Math.floor(p.y - at.y - box.top);
    if (x >= 0 && y >= 0 && x < box.width && y < box.height && opaque(s.src, x, y)) return s.pos;
  }
  for (const t of front(
    tiles.filter((t) => t.kind === 'slot' || t.kind === 'gate'),
    (t) => depthOf(t.col, t.row),
  )) {
    const at = tilePoint(t.col, t.row);
    if (inDiamond(p.x - at.x, p.y - at.y, t.span)) return t.pos;
  }
  return undefined;
}

/** The marker on a tile's ground: an empty plot, a locked field; none under a building or the gate. */
export function markerOf(tile: IsoTile, built: boolean): 'plot' | 'locked' | null {
  if (tile.kind === 'locked') return 'locked';
  return tile.kind === 'slot' && !built ? 'plot' : null;
}

/**
 * The buildings standing on the tiles, as sprites drawn at their tile's depth, as big as the tile (`span` × 64 pixels);
 * `artOf` gives a building's art for its size: its sprite (none: the building is left out), its key in spots.json and
 * its bare twin. The gate's building, the Walls, is drawn as part of the walls instead.
 */
export function buildingSprites(
  tiles: readonly IsoTile[],
  byPos: ReadonlyMap<number, { typeId: number; level: number }>,
  artOf: (typeId: number, level: number, span: number) => BuildingArt | undefined,
): IsoSprite[] {
  return tiles.flatMap((t) => {
    const b = t.kind === 'slot' && t.pos != null ? byPos.get(t.pos) : undefined;
    const span = t.span ?? 1;
    const art = b && b.typeId !== 0 ? artOf(b.typeId, b.level, span) : undefined;
    if (!art?.src) return [];
    const sprite: IsoSprite = {
      key: `b${t.pos}`,
      col: t.col,
      row: t.row,
      src: art.src,
      depth: depthOf(t.col, t.row),
      pos: t.pos,
      size: span * SPRITE,
      file: art.file,
    };
    if (art.bare) sprite.bare = art.bare;
    return [sprite];
  });
}
