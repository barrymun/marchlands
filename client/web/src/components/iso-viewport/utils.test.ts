import { describe, expect, it } from 'vitest';
import type { Camera, Outline, Piece, View } from '@/components/iso-viewport/types';
import {
  clampToScene,
  clampZoom,
  dragged,
  fitZoom,
  isOutline,
  isOverlay,
  layOutlines,
  nextZoom,
  type OutlineContext,
  outlineHalves,
  type OutlineLayer,
  outlinePoints,
  panStep,
  sceneBox,
  sceneCentre,
  spriteAt,
  spriteBox,
  tileAt,
  tileOrigin,
  viewPoint,
  wheelZoom,
  zoomAround,
  zoomsFor,
} from '@/components/iso-viewport/utils';

const view: View = { w: 640, h: 320, dpr: 1 };
const cam: Camera = { x: 100, y: 200, zoom: 1 };

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

  it('lands every tile on a whole device pixel, the camera between tiles and the tile at a fractional place', () => {
    const p = tileOrigin(103.3, 205.75, { x: 100.37, y: 200.81, zoom: 1.5 }, { ...view, dpr: 2 });
    expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
  });
});

describe(viewPoint.name, () => {
  it('gives the tile middle in CSS pixels', () => {
    expect(viewPoint(101, 200, { ...cam, zoom: 2 }, { ...view, dpr: 2 })).toEqual({ x: 384, y: 192 });
  });
});

describe(tileAt.name, () => {
  it('turns a point of the view back into the tile it came from', () => {
    const p = tileOrigin(103, 197, cam, view);
    expect(tileAt(p, cam, view)).toEqual({ x: 103, y: 197 });
  });

  it('gives the camera tile at the middle of the view', () => {
    expect(tileAt({ x: 320, y: 160 }, cam, view)).toEqual({ x: 100, y: 200 });
  });
});

describe(dragged.name, () => {
  it('moves the view with the pointer: what was under it stays under it', () => {
    const before = tileAt({ x: 400, y: 100 }, cam, view);
    const after = tileAt({ x: 450, y: 70 }, dragged(cam, 50, -30), view);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('keeps the zoom', () => {
    expect(dragged({ ...cam, zoom: 2 }, 10, 10).zoom).toBe(2);
  });
});

describe(panStep.name, () => {
  it('moves straight up the screen by going back along both axes, across by one axis and back along the other', () => {
    expect(panStep('up', 4)).toEqual({ dx: -4, dy: -4 });
    expect(panStep('down', 4)).toEqual({ dx: 4, dy: 4 });
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

describe(spriteBox.name, () => {
  it('anchors a 64-pixel sprite at (32, 46) and the 128-pixel Town Hall at (64, 94)', () => {
    expect(spriteBox()).toEqual({ left: -32, top: -46, width: 64, height: 64 });
    expect(spriteBox(128)).toEqual({ left: -64, top: -94, width: 128, height: 128 });
  });
});

describe(zoomsFor.name, () => {
  it('keeps only whole-number zooms on an ordinary screen, and adds the half steps on a screen of two', () => {
    expect(zoomsFor(1)).toEqual([1, 2, 3, 4]);
    expect(zoomsFor(2)).toEqual([1, 1.5, 2, 2.5, 3, 4]);
  });

  it('keeps only the zooms that are whole on an odd ratio, and falls back to 1 when none are', () => {
    expect(zoomsFor(1.25)).toEqual([4]);
    expect(zoomsFor(1.1)).toEqual([1]);
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

  it('steps from an in-between zoom (after a smooth zoom) to the next sharp one', () => {
    expect(nextZoom(1.7, 1, 2)).toBe(2);
    expect(nextZoom(1.7, -1, 2)).toBe(1.5);
  });
});

describe(clampZoom.name, () => {
  it('leaves a zoom inside the range as it is, in-between zooms included', () => {
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2.37)).toBe(2.37);
    expect(clampZoom(4)).toBe(4);
  });

  it('keeps a zoom to the first and last zoom levels', () => {
    expect(clampZoom(0.4)).toBe(1);
    expect(clampZoom(9)).toBe(4);
  });
});

describe(wheelZoom.name, () => {
  const wheel = (deltaY: number, deltaMode = 0, ctrlKey = false) => ({ deltaY, deltaMode, ctrlKey });

  it('zooms in for a scroll up and out for a scroll down, in proportion to how far it scrolled', () => {
    expect(wheelZoom(2, wheel(-100), 800)).toBeCloseTo(2 * Math.exp(0.2));
    expect(wheelZoom(2, wheel(100), 800)).toBeCloseTo(2 * Math.exp(-0.2));
    expect(wheelZoom(2, wheel(-4), 800)).toBeCloseTo(2 * Math.exp(0.008));
  });

  it('comes back to where it started after scrolling the same amount each way', () => {
    expect(wheelZoom(wheelZoom(2, wheel(-60), 800), wheel(60), 800)).toBeCloseTo(2);
  });

  it('zooms faster for a trackpad pinch (Ctrl held)', () => {
    expect(wheelZoom(2, wheel(-10, 0, true), 800)).toBeCloseTo(2 * Math.exp(0.1));
  });

  it('counts a wheel in lines or pages in pixels', () => {
    expect(wheelZoom(2, wheel(-3, 1), 800)).toBeCloseTo(2 * Math.exp(0.096));
    expect(wheelZoom(2, wheel(-0.25, 2), 800)).toBeCloseTo(2 * Math.exp(0.4));
  });

  it('stays inside the zoom levels', () => {
    expect(wheelZoom(1.1, wheel(1000), 800)).toBe(1);
    expect(wheelZoom(3.9, wheel(-1000), 800)).toBe(4);
  });
});

describe(zoomAround.name, () => {
  it('keeps the tile under the pointer where it is', () => {
    const p = { x: 500, y: 90 };
    const before = tileAt(p, cam, view);
    const zoomed = zoomAround(cam, 2, p, view);
    expect(zoomed.zoom).toBe(2);
    const after = tileAt(p, zoomed, view);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('zooms on the middle of the view without moving the camera', () => {
    expect(zoomAround(cam, 3, { x: 320, y: 160 }, view)).toEqual({ ...cam, zoom: 3 });
  });
});

describe(sceneBox.name, () => {
  it('fits one 64×64 sprite, its anchor at (32, 46), and makes room for a bigger one', () => {
    expect(sceneBox([{ col: 0, row: 0 }])).toEqual({ originX: 32, originY: 46, width: 64, height: 64 });
    expect(sceneBox([{ col: 0, row: 0, size: 128 }])).toEqual({ originX: 64, originY: 94, width: 128, height: 128 });
  });

  it('spans a diamond of tiles: 32 pixels across per column and row, 16 down', () => {
    const cells = [];
    for (let col = 0; col < 6; col++) for (let row = 0; row < 6; row++) cells.push({ col, row });
    const b = sceneBox(cells);
    expect(b.width).toBe(12 * 32);
    expect(b.height).toBe(10 * 16 + 64);
  });
});

describe(sceneCentre.name, () => {
  it('finds the tile at the middle of a square diamond', () => {
    const cells = [];
    for (let col = 0; col < 5; col++) for (let row = 0; row < 5; row++) cells.push({ col, row });
    const c = sceneCentre(sceneBox(cells));
    // the box is centred on the diamond across, and a little higher (sprites reach up from their tiles)
    expect(c.x - c.y).toBeCloseTo(0);
    expect(c.x).toBeLessThan(2);
  });
});

describe(fitZoom.name, () => {
  const box = { originX: 0, originY: 0, width: 600, height: 400 };

  it('takes the largest zoom at which the scene fits the view', () => {
    expect(fitZoom(box, { w: 1300, h: 900, dpr: 1 })).toBe(2);
    expect(fitZoom(box, { w: 1000, h: 650, dpr: 2 })).toBe(1.5);
  });

  it('falls back to the smallest zoom when the scene does not fit at all', () => {
    expect(fitZoom(box, { w: 300, h: 200, dpr: 1 })).toBe(1);
  });
});

describe(clampToScene.name, () => {
  // a 200×100 scene whose tile (0, 0) is in its top left corner (origin 0, 0)
  const box = { originX: 0, originY: 0, width: 200, height: 100 };
  const v: View = { w: 400, h: 300, dpr: 1 };
  const left = (c: Camera) => tileOrigin(0, 0, c, v).x;
  const top = (c: Camera) => tileOrigin(0, 0, c, v).y;

  it('leaves a camera that shows enough of the scene alone', () => {
    const c = { x: 0, y: 0, zoom: 1 };
    expect(clampToScene(c, box, v)).toEqual(c);
  });

  it('pulls the scene back so at least half of it shows across and down', () => {
    // dragged far right and down: the scene would be off the view
    const far = dragged({ x: 0, y: 0, zoom: 1 }, 1000, 1000);
    const c = clampToScene(far, box, v);
    expect(left(c)).toBeCloseTo(400 - 100);
    expect(top(c)).toBeCloseTo(300 - 50);
    const back = clampToScene(dragged({ x: 0, y: 0, zoom: 1 }, -1000, -1000), box, v);
    expect(left(back)).toBeCloseTo(100 - 200);
    expect(top(back)).toBeCloseTo(50 - 100);
  });

  it('keeps a scene bigger than the view covering the whole view at its tightest', () => {
    const big = { originX: 0, originY: 0, width: 1000, height: 800 };
    const c = clampToScene(dragged({ x: 0, y: 0, zoom: 1 }, 5000, 0), big, v);
    expect(left(c)).toBeCloseTo(0);
  });
});

describe(spriteAt.name, () => {
  const drawn = [
    { key: 'back', col: 99, row: 199, src: 'back' },
    { key: 'front', col: 100, row: 200, src: 'front' },
  ];

  it('picks the front-most sprite with a pixel under the point', () => {
    const p = viewPoint(100, 200, cam, view);
    expect(spriteAt({ x: p.x, y: p.y - 20 }, drawn, cam, view, () => true)?.key).toBe('front');
    expect(spriteAt({ x: p.x, y: p.y - 20 }, drawn, cam, view, (src) => src === 'back')?.key).toBe('back');
  });

  it('answers nothing over clear pixels or away from every sprite', () => {
    const p = viewPoint(100, 200, cam, view);
    expect(spriteAt(p, drawn, cam, view, () => false)).toBeUndefined();
    expect(spriteAt({ x: 0, y: 0 }, drawn, cam, view, () => true)).toBeUndefined();
  });
});

const outline: Outline = { key: 'o', col: 100, row: 200, half: 'back', className: 'stroke-primary', width: 2 };

describe(isOutline.name, () => {
  it('tells half an outline from a sprite and an overlay', () => {
    expect(isOutline(outline)).toBe(true);
    expect(isOutline({ key: 's', col: 0, row: 0, src: 'a.png' })).toBe(false);
    expect(isOutline({ key: 'v', col: 0, row: 0, x: 0, y: 0, art: { id: 'a', w: 1, h: 1, data: new Uint8ClampedArray(4) } })).toBe(false);
  });
});

describe(isOverlay.name, () => {
  it('tells an overlay from a sprite and half an outline', () => {
    expect(isOverlay({ key: 'v', col: 0, row: 0, x: 0, y: 0, art: { id: 'a', w: 1, h: 1, data: new Uint8ClampedArray(4) } })).toBe(true);
    expect(isOverlay({ key: 's', col: 0, row: 0, src: 'a.png' })).toBe(false);
    expect(isOverlay(outline)).toBe(false);
  });
});

describe(outlineHalves.name, () => {
  it('splits an outline into its back and front halves, keyed apart, the rest kept', () => {
    const [back, front] = outlineHalves({ key: 'o', col: 3, row: 4, className: 'stroke-sky-400', width: 2.5, dash: [5, 3] });
    expect(back).toEqual({ key: 'ob', col: 3, row: 4, className: 'stroke-sky-400', width: 2.5, dash: [5, 3], half: 'back' });
    expect(front).toEqual({ key: 'of', col: 3, row: 4, className: 'stroke-sky-400', width: 2.5, dash: [5, 3], half: 'front' });
  });
});

describe(outlinePoints.name, () => {
  it('runs the back half from the left corner over the top to the right corner', () => {
    expect(outlinePoints(outline, cam, view)).toEqual([
      { x: 288, y: 160 },
      { x: 320, y: 144 },
      { x: 352, y: 160 },
    ]);
  });

  it('runs the front half from the right corner under the bottom to the left corner', () => {
    expect(outlinePoints({ ...outline, half: 'front' }, cam, view)).toEqual([
      { x: 352, y: 160 },
      { x: 320, y: 176 },
      { x: 288, y: 160 },
    ]);
  });

  it('follows the tile, the zoom and the device pixel ratio', () => {
    const [left, top, right] = outlinePoints({ ...outline, col: 101 }, { ...cam, zoom: 2 }, { ...view, dpr: 2 });
    expect([left, top, right]).toEqual([
      { x: 768 - 128, y: 384 },
      { x: 768, y: 384 - 64 },
      { x: 768 + 128, y: 384 },
    ]);
  });
});

/** A stand-in 2D context that notes what is drawn on it. */
function fakeContext() {
  const calls: string[] = [];
  const ctx: OutlineContext = {
    globalCompositeOperation: 'source-over',
    filter: 'none',
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    imageSmoothingEnabled: true,
    setLineDash: (dash) => calls.push(`dash ${[...dash].join(',')}`),
    beginPath: () => calls.push('begin'),
    moveTo: (x, y) => calls.push(`move ${x},${y}`),
    lineTo: (x, y) => calls.push(`line ${x},${y}`),
    stroke: () =>
      calls.push(`stroke ${typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : 'pattern'} ${ctx.lineWidth} ${ctx.lineCap} ${ctx.globalCompositeOperation}`),
  };
  return { ctx, calls };
}

/**
 * A stand-in scene canvas of a size, and the layer canvas: laying a layer of no size throws, as the browser's
 * drawImage does ("The image argument is a canvas element with a width or height of 0").
 */
function fakeCanvases(width: number, height: number) {
  const lay = fakeContext();
  const layer: OutlineLayer<OutlineContext> = { width: 300, height: 150, getContext: () => lay.ctx };
  const laid: OutlineLayer<OutlineContext>[] = [];
  const target = {
    canvas: { width, height },
    drawImage(image: OutlineLayer<OutlineContext>) {
      if (image.width === 0 || image.height === 0) throw new Error('InvalidStateError: a canvas element with a width or height of 0');
      laid.push(image);
    },
  };
  return { target, layer, lay, laid };
}

const sprite: Piece = { key: 's', col: 100, row: 200, src: 'castle.png' };
const back = outline;
const front: Outline = { ...outline, key: 'of', half: 'front' };

describe(layOutlines.name, () => {
  it.each([
    [0, 0],
    [0, 320],
    [640, 0],
  ])('draws nothing on a view of no size (%i by %i) rather than throwing', (w, h) => {
    const { target, layer, lay, laid } = fakeCanvases(w, h);
    const erased: Piece[] = [];
    expect(() =>
      layOutlines(
        target,
        layer,
        [back, sprite, front],
        cam,
        view,
        () => 'red',
        (_, p) => erased.push(p),
      ),
    ).not.toThrow();
    expect(
      layOutlines(
        target,
        layer,
        [back, sprite, front],
        cam,
        view,
        () => 'red',
        (_, p) => erased.push(p),
      ),
    ).toBe(false);
    expect(laid).toEqual([]);
    expect(lay.calls).toEqual([]);
    expect(erased).toEqual([]);
  });

  it('draws nothing without outlines', () => {
    const { target, layer, lay, laid } = fakeCanvases(640, 320);
    expect(
      layOutlines(
        target,
        layer,
        [sprite],
        cam,
        view,
        () => 'red',
        () => undefined,
      ),
    ).toBe(false);
    expect(laid).toEqual([]);
    expect(lay.calls).toEqual([]);
  });

  it('sizes the layer to the scene and lays it over it once', () => {
    const { target, layer, laid } = fakeCanvases(640, 320);
    expect(
      layOutlines(
        target,
        layer,
        [back, sprite, front],
        cam,
        view,
        () => 'red',
        () => undefined,
      ),
    ).toBe(true);
    expect([layer.width, layer.height]).toEqual([640, 320]);
    expect(laid).toEqual([layer]);
  });

  it('strokes each half through its corners in its colour, width and dashes, in device pixels', () => {
    const { target, layer, lay } = fakeCanvases(1280, 640);
    const dashed: Outline = { ...front, className: 'stroke-sky-400', width: 2.5, dash: [5, 3] };
    layOutlines(
      target,
      layer,
      [back, dashed],
      cam,
      { ...view, dpr: 2 },
      (c) => (c === 'stroke-sky-400' ? 'blue' : 'red'),
      () => undefined,
    );
    expect(lay.calls).toEqual([
      'dash ',
      'begin',
      'move 576,320',
      'line 640,288',
      'line 704,320',
      'stroke red 4 round source-over',
      'dash 10,6',
      'begin',
      'move 704,320',
      'line 640,352',
      'line 576,320',
      'stroke blue 5 butt source-over',
    ]);
  });

  it('asks for each colour once', () => {
    const { target, layer } = fakeCanvases(640, 320);
    const asked: string[] = [];
    layOutlines(
      target,
      layer,
      [back, front, { ...back, col: 101 }],
      cam,
      view,
      (c) => (asked.push(c), 'red'),
      () => undefined,
    );
    expect(asked).toEqual(['stroke-primary']);
  });

  it('erases with the pieces after an outline, never those before the first', () => {
    const { target, layer, lay } = fakeCanvases(640, 320);
    const behind: Piece = { ...sprite, key: 'behind' };
    const inFront: Piece = { ...sprite, key: 'front' };
    const erased: [string, string][] = [];
    layOutlines(
      target,
      layer,
      [behind, back, sprite, front, inFront],
      cam,
      view,
      () => 'red',
      (l, p) => erased.push([p.key, l.globalCompositeOperation]),
    );
    expect(erased).toEqual([
      ['s', 'destination-out'],
      ['front', 'destination-out'],
    ]);
    // and an outline after an erasing piece is drawn normally again
    expect(lay.calls.filter((c) => c.startsWith('stroke'))).toEqual(['stroke red 2 round source-over', 'stroke red 2 round source-over']);
  });
});
