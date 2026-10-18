import { describe, expect, it } from 'vitest';

import { CHUNK } from '@/components/map-panel/world-map/constants';
import type { Camera, View } from '@/components/map-panel/world-map/types';
import {
  chunksFor,
  decodeTiles,
  dragged,
  nextZoom,
  panStep,
  pickTile,
  startZoom,
  tileAt,
  tileOrigin,
  visibleTiles,
  wrap,
  zoomsFor,
} from '@/components/map-panel/world-map/utils';

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

describe(tileOrigin.name, () => {
  it('puts the camera tile in the middle of the view', () => {
    expect(tileOrigin(100, 200, cam, view)).toEqual({ x: 320, y: 160 });
  });

  it('moves half a tile right and down per column, half a tile left and down per row', () => {
    expect(tileOrigin(101, 200, cam, view)).toEqual({ x: 352, y: 176 });
    expect(tileOrigin(100, 201, cam, view)).toEqual({ x: 288, y: 176 });
  });

  it('works in device pixels, scaled by the zoom and the device pixel ratio', () => {
    expect(tileOrigin(101, 200, { ...cam, zoom: 2 }, { ...view, dpr: 2 })).toEqual({ x: 640 + 128, y: 320 + 64 });
  });

  it('lands every tile on a whole pixel when the camera is between tiles', () => {
    const p = tileOrigin(103, 205, { x: 100.37, y: 200.81, zoom: 1.5 }, { ...view, dpr: 2 });
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
  });
});

describe(tileAt.name, () => {
  it('turns a screen point back into the tile it came from', () => {
    const p = tileOrigin(103, 197, cam, view);
    expect(tileAt(p.x, p.y, cam, view)).toEqual({ x: 103, y: 197 });
  });

  it('gives the camera tile at the middle of the view', () => {
    expect(tileAt(320, 160, cam, view)).toEqual({ x: 100, y: 200 });
  });
});

describe(dragged.name, () => {
  it('moves the map with the pointer: what was under it stays under it', () => {
    const before = tileAt(400, 100, cam, view);
    const moved = dragged(cam, 50, -30);
    const after = tileAt(450, 70, moved, view);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('keeps the zoom', () => {
    expect(dragged({ ...cam, zoom: 2 }, 10, 10).zoom).toBe(2);
  });
});

describe(panStep.name, () => {
  it('moves straight up the screen by going back along both axes', () => {
    expect(panStep('up', 4)).toEqual({ dx: -4, dy: -4 });
    expect(panStep('down', 4)).toEqual({ dx: 4, dy: 4 });
  });

  it('moves across the screen along one axis and back along the other', () => {
    expect(panStep('left', 4)).toEqual({ dx: -4, dy: 4 });
    expect(panStep('right', 4)).toEqual({ dx: 4, dy: -4 });
  });

  it('does what it says on screen', () => {
    const { dx, dy } = panStep('right', 4);
    const p = tileOrigin(100 + dx, 200 + dy, cam, view);
    expect(p.y).toBe(160);
    expect(p.x).toBeGreaterThan(320);
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

  it('wraps a square that runs past the map edge', () => {
    const tiles = decodeTiles({ x1: 799, y1: 0, x2: 800, y2: 0, mapStr: '1121' }, 800);
    expect(tiles.get(799)).toEqual({ type: 1, level: 1 });
    expect(tiles.get(0)).toEqual({ type: 2, level: 1 });
  });
});

describe(zoomsFor.name, () => {
  it('keeps only whole-number zooms on an ordinary screen', () => {
    expect(zoomsFor(1)).toEqual([1, 2, 3, 4]);
  });

  it('adds the half steps on a screen with two device pixels to the CSS pixel', () => {
    expect(zoomsFor(2)).toEqual([1, 1.5, 2, 2.5, 3, 4]);
  });

  it('keeps only the zooms that are whole on an odd ratio, and falls back to 1 when none are', () => {
    expect(zoomsFor(1.25)).toEqual([4]);
    expect(zoomsFor(1.1)).toEqual([1]);
  });
});

describe(startZoom.name, () => {
  it('opens at the largest zoom that still shows six tiles across', () => {
    expect(startZoom(1500, 1)).toBe(3);
    expect(startZoom(1200, 2)).toBe(3);
    expect(startZoom(900, 2)).toBe(2);
    expect(startZoom(750, 1)).toBe(1);
  });

  it('opens at the smallest zoom on a narrow view', () => {
    expect(startZoom(300, 2)).toBe(1);
  });
});

describe(nextZoom.name, () => {
  it('steps in and out through the zooms this screen allows', () => {
    expect(nextZoom(2, 1, 2)).toBe(2.5);
    expect(nextZoom(2, -1, 2)).toBe(1.5);
    expect(nextZoom(2, 1, 1)).toBe(3);
  });

  it('stays at the ends', () => {
    expect(nextZoom(4, 1, 1)).toBe(4);
    expect(nextZoom(1, -1, 1)).toBe(1);
  });

  it('snaps a zoom this screen cannot show to the next one in that direction', () => {
    expect(nextZoom(1.5, 1, 1)).toBe(2);
    expect(nextZoom(1.5, -1, 1)).toBe(1);
  });
});

describe(pickTile.name, () => {
  const clear = () => false;
  const solid = () => true;

  it('finds the tile whose diamond holds the point', () => {
    const p = tileOrigin(102, 199, cam, view);
    expect(pickTile(p.x, p.y, [], cam, view, clear)).toEqual({ x: 102, y: 199 });
  });

  it('prefers a sprite whose pixels are under the point, front-most first', () => {
    // a point just above tile (100, 200)'s diamond: the sprite of the tile behind reaches it, and so does this one's
    const p = tileOrigin(100, 200, cam, view);
    const drawn = [
      { x: 99, y: 199, src: 'back' },
      { x: 100, y: 200, src: 'front' },
    ];
    expect(pickTile(p.x, p.y - 20, drawn, cam, view, solid)).toEqual({ x: 100, y: 200 });
    expect(pickTile(p.x, p.y - 20, drawn, cam, view, (src) => src === 'back')).toEqual({ x: 99, y: 199 });
  });

  it('ignores a tile drawn without a sprite, and goes by the diamond under the point', () => {
    const p = tileOrigin(100, 200, cam, view);
    expect(pickTile(p.x, p.y - 20, [{ x: 100, y: 200 }], cam, view, solid)).toEqual({ x: 99, y: 199 });
  });
});
