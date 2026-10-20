import { describe, expect, it } from 'vitest';
import type { IsoSprite, IsoTile } from '@/components/buildings-panel/iso-grid/types';
import {
  buildingSprites,
  depthOf,
  fieldLayout,
  gridCells,
  hitTest,
  inDiamond,
  markerOf,
  spacing,
  tilePoint,
  townLayout,
} from '@/components/buildings-panel/iso-grid/utils';

describe(tilePoint.name, () => {
  it('puts tile (0, 0) at the origin', () => {
    expect(tilePoint(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it('rounds a fractional position to a whole pixel', () => {
    expect(tilePoint(1.3, 0)).toEqual({ x: 42, y: 21 });
    expect(tilePoint(0.75, 0.75)).toEqual({ x: 0, y: 24 });
  });

  it('moves half a tile right and down per column, half a tile left and down per row', () => {
    expect(tilePoint(1, 0)).toEqual({ x: 32, y: 16 });
    expect(tilePoint(0, 1)).toEqual({ x: -32, y: 16 });
    expect(tilePoint(2, 2)).toEqual({ x: 0, y: 64 });
  });
});

describe(depthOf.name, () => {
  it('is the sum of column and row, so the front corner is deepest', () => {
    expect(depthOf(0, 0)).toBe(0);
    expect(depthOf(5, 5)).toBe(10);
    expect(depthOf(3, 1)).toBe(depthOf(1, 3));
  });
});

describe(gridCells.name, () => {
  it('lists every cell once', () => {
    const cells = gridCells(6, 6);
    expect(cells).toHaveLength(36);
    expect(new Set(cells.map((c) => c.join())).size).toBe(36);
  });

  it('runs back to front, and left to right at the same depth', () => {
    expect(gridCells(2, 2)).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ]);
  });

  it('handles a diamond wider than it is deep', () => {
    expect(gridCells(8, 5)).toHaveLength(40);
  });
});

describe(spacing.name, () => {
  it('spreads 6 slots 1.3 tiles apart over 9 tiles with one spare, centred', () => {
    expect(spacing(6, 1.3, 1)).toEqual({ ground: 9, margin: 0.75 });
  });

  it('packs slots one tile apart edge to edge with no spare', () => {
    expect(spacing(6, 1, 0)).toEqual({ ground: 6, margin: 0 });
  });

  it('centres an uneven span', () => {
    const { ground, margin } = spacing(8, 1.3, 1);
    expect(ground).toBe(11);
    expect(margin + 7 * 1.3 + margin).toBeCloseTo(ground - 1);
  });
});

describe(townLayout.name, () => {
  const positions = Array.from({ length: 32 }, (_, i) => i);
  const town = townLayout({ cols: 6, rows: 6, pitch: 1.3, extra: 1, townHall: [2, 2], positions, townHallPos: -1, wallsPos: -2 });

  it('lays a square of whole grass tiles big enough for the spaced slots', () => {
    expect([town.cols, town.rows]).toEqual([9, 9]);
    expect(town.ground).toHaveLength(81);
  });

  it('puts the Town Hall in the middle of its 2×2 block, two tiles across', () => {
    expect(town.tiles.find((t) => t.pos === -1)).toEqual({ col: 0.75 + 2.5 * 1.3, row: 0.75 + 2.5 * 1.3, kind: 'slot', pos: -1, span: 2 });
  });

  it('fills every other cell with a slot, each once', () => {
    const slots = town.tiles.filter((t) => t.kind === 'slot' && t.pos !== -1);
    expect(slots.map((t) => t.pos!).sort((a, b) => a - b)).toEqual(positions);
    const hall = town.tiles.find((t) => t.pos === -1)!;
    expect(slots.every((t) => Math.abs(t.col - hall.col) > 1 || Math.abs(t.row - hall.row) > 1)).toBe(true);
  });

  it('keeps the slots apart and clear of the walls round the ground', () => {
    const slots = town.tiles.filter((t) => t.kind === 'slot');
    expect(Math.min(...slots.map((t) => t.col))).toBeCloseTo(0.75);
    expect(Math.max(...slots.map((t) => t.col))).toBeCloseTo(8 - 0.75);
    expect(town.tiles.find((t) => t.pos === 0)).toMatchObject({ col: 0.75, row: 0.75 });
    expect(town.tiles.find((t) => t.pos === 1)!.row - town.tiles.find((t) => t.pos === 0)!.row).toBeCloseTo(1.3);
  });

  it('puts the gate on the front corner of the ground', () => {
    expect(town.tiles.find((t) => t.kind === 'gate')).toEqual({ col: 8.5, row: 8.5, kind: 'gate', pos: -2 });
  });

  it('is in drawing order, back to front', () => {
    const depths = town.tiles.map((t) => depthOf(t.col, t.row));
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it('refuses a layout with a different number of free cells than slots', () => {
    expect(() =>
      townLayout({ cols: 6, rows: 6, pitch: 1.3, extra: 1, townHall: [2, 2], positions: positions.slice(1), townHallPos: -1, wallsPos: -2 }),
    ).toThrow();
  });
});

describe(fieldLayout.name, () => {
  const positions = Array.from({ length: 40 }, (_, i) => 1001 + i);
  const fields = (unlocked: number) => fieldLayout({ cols: 8, rows: 5, pitch: 1.3, extra: 1, positions, unlocked });

  it('opens the first `unlocked` fields, back to front, and locks the rest', () => {
    const { tiles } = fields(3);
    expect(tiles).toHaveLength(40);
    expect(tiles.slice(0, 3).every((t) => t.kind === 'slot')).toBe(true);
    expect(tiles.slice(3).every((t) => t.kind === 'locked')).toBe(true);
    expect(tiles[0].pos).toBe(1001);
  });

  it('locks every field with nothing unlocked, and none with all of them', () => {
    expect(fields(0).tiles.every((t) => t.kind === 'locked')).toBe(true);
    expect(fields(40).tiles.every((t) => t.kind === 'slot')).toBe(true);
  });

  it('lays grass under them, with some to spare round the edge', () => {
    const { ground, cols, rows } = fields(3);
    expect([cols, rows]).toEqual([11, 7]);
    expect(ground).toHaveLength(77);
  });

  it('refuses a diamond that does not hold every field', () => {
    expect(() => fieldLayout({ cols: 6, rows: 6, pitch: 1.3, extra: 1, positions, unlocked: 3 })).toThrow();
  });
});

describe(inDiamond.name, () => {
  it('holds the middle and the four corners', () => {
    expect(inDiamond(0, 0)).toBe(true);
    expect(inDiamond(32, 0)).toBe(true);
    expect(inDiamond(0, -16)).toBe(true);
  });

  it('leaves out the corners of the box round it', () => {
    expect(inDiamond(20, 10)).toBe(false);
    expect(inDiamond(33, 0)).toBe(false);
  });

  it('grows with the span of the tile', () => {
    expect(inDiamond(60, 0, 2)).toBe(true);
    expect(inDiamond(65, 0, 2)).toBe(false);
  });
});

describe(hitTest.name, () => {
  const tiles: IsoTile[] = [
    { col: 0, row: 0, kind: 'slot', pos: 1 },
    { col: 1, row: 0, kind: 'slot', pos: 2 },
    { col: 1, row: 1, kind: 'locked', pos: 3 },
  ];
  const sprite = (col: number, row: number, pos?: number): IsoSprite => ({ key: `s${col}${row}`, col, row, src: `b${col}${row}`, depth: col + row, pos });
  const solid = () => true;
  const clear = () => false;

  it('finds an empty tile by its diamond', () => {
    expect(hitTest({ x: 0, y: 0 }, [], tiles, clear)).toBe(1);
    expect(hitTest({ x: 32, y: 16 }, [], tiles, clear)).toBe(2);
  });

  it('answers nothing off the tiles, and nothing for a locked tile', () => {
    expect(hitTest({ x: 0, y: -40 }, [], tiles, clear)).toBeUndefined();
    expect(hitTest({ x: 0, y: 32 }, [], tiles, clear)).toBeUndefined();
  });

  it('prefers a building whose pixels are under the point, even over a tile in front', () => {
    // the building on (0, 0) rises 30 pixels above its tile; the point is on tile (1, 0)'s diamond
    const tall = sprite(0, 0, 1);
    const opaqueAbove = (src: string, x: number, y: number) => src === tall.src && x >= 40 && y >= 40;
    expect(hitTest({ x: 20, y: 10 }, [tall], tiles, opaqueAbove)).toBe(1);
  });

  it('tries the sprites front to back', () => {
    expect(hitTest({ x: 16, y: 8 }, [sprite(0, 0, 1), sprite(1, 0, 2)], tiles, solid)).toBe(2);
  });

  it('finds the gate by its diamond, at a fractional position', () => {
    const gate: IsoTile = { col: 2.5, row: 2.5, kind: 'gate', pos: -2 };
    expect(hitTest({ x: 0, y: 80 }, [], [gate], clear)).toBe(-2);
  });

  it('falls through a transparent pixel to the tile below, and ignores sprites without a position', () => {
    expect(hitTest({ x: 0, y: 0 }, [sprite(1, 0, 2)], tiles, clear)).toBe(1);
    expect(hitTest({ x: 0, y: 0 }, [sprite(1, 0)], tiles, solid)).toBe(1);
  });
});

describe(markerOf.name, () => {
  it('marks an empty slot as a plot, and nothing under a building', () => {
    expect(markerOf({ col: 0, row: 0, kind: 'slot', pos: 1 }, false)).toBe('plot');
    expect(markerOf({ col: 0, row: 0, kind: 'slot', pos: 1 }, true)).toBeNull();
  });

  it('roughens a locked field, and leaves the gate bare', () => {
    expect(markerOf({ col: 0, row: 0, kind: 'locked', pos: 1040 }, false)).toBe('locked');
    expect(markerOf({ col: 0, row: 0, kind: 'gate', pos: -2 }, false)).toBeNull();
  });
});

describe(buildingSprites.name, () => {
  const tiles: IsoTile[] = [
    { col: 0, row: 0, kind: 'slot', pos: 1 },
    { col: 1, row: 0, kind: 'slot', pos: 2 },
    { col: 1, row: 1, kind: 'slot', pos: 3 },
    { col: 2, row: 2, kind: 'gate', pos: -2 },
  ];
  const byPos = new Map([
    [1, { typeId: 1, level: 4 }],
    [2, { typeId: 0, level: 0 }],
    [-2, { typeId: 33, level: 1 }],
  ]);

  it('stands each built building on its tile, at its depth', () => {
    expect(buildingSprites(tiles, byPos, (type, level) => ({ src: `art-${type}-${level}`, file: `f-${type}` }))).toEqual([
      { key: 'b1', col: 0, row: 0, src: 'art-1-4', depth: 0, pos: 1, size: 64, file: 'f-1' },
    ]);
  });

  it('carries the bare twin of a building with turning parts', () => {
    expect(buildingSprites(tiles, byPos, () => ({ src: 'a', file: 'f', bare: 'a-bare' }))[0]).toMatchObject({ src: 'a', bare: 'a-bare' });
  });

  it('draws a building on a 2×2 tile at twice the size, asking for its big art', () => {
    const hall: IsoTile[] = [{ col: 1, row: 1, kind: 'slot', pos: 1, span: 2 }];
    expect(buildingSprites(hall, byPos, (_type, _level, span) => ({ src: `art-${span}`, file: 'hall' }))).toEqual([
      { key: 'b1', col: 1, row: 1, src: 'art-2', depth: 2, pos: 1, size: 128, file: 'hall' },
    ]);
  });

  it('leaves out a building without art', () => {
    expect(buildingSprites(tiles, byPos, () => undefined)).toEqual([]);
    expect(buildingSprites(tiles, byPos, () => ({ src: undefined, file: 'f' }))).toEqual([]);
  });
});
