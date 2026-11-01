import { describe, expect, it } from 'vitest';

import type { Camera, View } from '@/components/iso-viewport/types';
import { CHUNK } from '@/components/map-panel/world-map/constants';
import { chunksFor, decodeTiles, startZoom, visibleTiles, wrap } from '@/components/map-panel/world-map/utils';

const view: View = { w: 640, h: 320, dpr: 1 };
const cam: Camera = { x: 100, y: 200, zoom: 1 };

describe(wrap.name, () => {
  it('keeps a coordinate on the map', () => {
    expect(wrap(5, 800)).toBe(5);
    expect(wrap(800, 800)).toBe(0);
    expect(wrap(-1, 800)).toBe(799);
    expect(wrap(-801, 800)).toBe(799);
  });
});

describe(visibleTiles.name, () => {
  const tiles = visibleTiles(cam, view);

  it('includes the camera tile and its neighbours', () => {
    expect(tiles).toContainEqual({ x: 100, y: 200 });
    expect(tiles).toContainEqual({ x: 101, y: 200 });
  });

  it('leaves out tiles well off screen', () => {
    expect(tiles).not.toContainEqual({ x: 130, y: 200 });
  });

  it('is in drawing order, back to front', () => {
    const depths = tiles.map((t) => t.x + t.y);
    expect(depths).toEqual([...depths].sort((a, b) => a - b));
  });

  it('runs on past the map edge rather than jumping', () => {
    expect(visibleTiles({ x: 0, y: 0, zoom: 1 }, view)).toContainEqual({ x: -1, y: 0 });
  });

  it('shows fewer tiles zoomed in', () => {
    expect(visibleTiles({ ...cam, zoom: 2 }, view).length).toBeLessThan(tiles.length);
  });
});

describe(chunksFor.name, () => {
  it('loads the square each tile falls in, once', () => {
    expect(
      chunksFor(
        [
          { x: 0, y: 0 },
          { x: 5, y: 7 },
        ],
        800,
      ),
    ).toEqual([{ x1: 0, y1: 0, x2: CHUNK - 1, y2: CHUNK - 1 }]);
  });

  it('loads neighbouring squares across a chunk edge', () => {
    expect(
      chunksFor(
        [
          { x: CHUNK - 1, y: 0 },
          { x: CHUNK, y: 0 },
        ],
        800,
      ),
    ).toHaveLength(2);
  });

  it('wraps tiles past the map edge to the squares at the other side', () => {
    expect(chunksFor([{ x: -1, y: 0 }], 800)).toEqual([{ x1: 798, y1: 0, x2: 818, y2: 20 }]);
  });
});

describe(decodeTiles.name, () => {
  it('reads two hex digits per tile, type then level, row by row', () => {
    const tiles = decodeTiles({ x1: 10, y1: 20, x2: 11, y2: 21, mapStr: '1a0b72c3' }, 800);
    expect(tiles.get(20 * 800 + 10)).toEqual({ type: 1, level: 10 });
    expect(tiles.get(20 * 800 + 11)).toEqual({ type: 0, level: 11 });
    expect(tiles.get(21 * 800 + 10)).toEqual({ type: 7, level: 2 });
    expect(tiles.get(21 * 800 + 11)).toEqual({ type: 12, level: 3 });
  });

  it('reads a historic city’s level back from its halved digit', () => {
    const tiles = decodeTiles({ x1: 0, y1: 0, x2: 1, y2: 0, mapStr: 'd9d6' }, 800);
    expect(tiles.get(0)).toEqual({ type: 13, level: 18 });
    expect(tiles.get(1)).toEqual({ type: 13, level: 12 });
  });

  it('wraps a square that runs past the map edge', () => {
    const tiles = decodeTiles({ x1: 799, y1: 0, x2: 800, y2: 0, mapStr: '1121' }, 800);
    expect(tiles.get(799)).toEqual({ type: 1, level: 1 });
    expect(tiles.get(0)).toEqual({ type: 2, level: 1 });
  });
});

describe(startZoom.name, () => {
  it('opens two steps out from the largest zoom that still shows six tiles across', () => {
    expect(startZoom(1500, 1)).toBe(1);
    expect(startZoom(1200, 2)).toBe(2);
    expect(startZoom(2000, 2)).toBe(2.5);
  });

  it('never goes past the smallest zoom', () => {
    expect(startZoom(900, 2)).toBe(1);
    expect(startZoom(750, 1)).toBe(1);
  });

  it('opens at the smallest zoom on a narrow view', () => {
    expect(startZoom(300, 2)).toBe(1);
  });
});
