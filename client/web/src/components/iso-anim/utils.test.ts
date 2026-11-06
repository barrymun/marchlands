import { describe, expect, it } from 'vitest';

import { BuildingType, SpotKind } from '@marchlands/core';

import {
  AFTERMATH_MS,
  BLAST_EVERY_S,
  BLAST_FRAMES,
  BUILD_FRAMES,
  C,
  QUIET_TOWN,
  ROUTE_STEPS,
  SAIL_FRAMES,
  SIDE_COLOURS,
  SMOKE_FRAMES,
  SPARKLE_MS,
  SPOTS,
  WALK_SPEED,
  WHEEL_FRAMES,
} from '@/components/iso-anim/constants';
import {
  aftermathOverlays,
  ambientOverlays,
  armyAt,
  armyOverlays,
  bannerFrame,
  blastAt,
  blastFrame,
  buildingOverlays,
  constructionFrame,
  constructionOverlays,
  darknessAt,
  drillFrame,
  dustFrame,
  fireFrame,
  flashAt,
  frameAt,
  glintFrame,
  glowFrame,
  hash,
  hasMovingParts,
  horseTailFrame,
  isNight,
  marchFrame,
  nearest,
  pacing,
  particlesAt,
  pixelArt,
  placeFrame,
  riderFrame,
  sailsFrame,
  sawdustFrame,
  seeded,
  sheepFrame,
  skyAt,
  smokeFrame,
  sparkleFrame,
  sparkleOverlays,
  sparksFrame,
  streetLines,
  streetsOf,
  stretcherFrame,
  twinkleFrame,
  walkerAt,
  walkerFrame,
  walkerOverlays,
  walkerRoute,
  weatherAt,
  wheelFrame,
  windowLightFrame,
  workerOverlays,
  zoneOf,
} from '@/components/iso-anim/utils';
import { Weather } from '@/components/iso-viewport/constants';
import type { PixelArt } from '@/components/iso-viewport/types';
import { ArmySide } from '@/lib/game-art';

/** How many pixels of a frame are drawn. */
const drawn = (a: PixelArt) => a.data.filter((_, i) => i % 4 === 3 && a.data[i]! > 0).length;
/** The colour of a frame's pixel, or null when it's empty. */
const at = (a: PixelArt, x: number, y: number) => {
  const i = (y * a.w + x) * 4;
  return a.data[i + 3] ? [a.data[i], a.data[i + 1], a.data[i + 2]] : null;
};

describe(hash.name, () => {
  it('is stable and tells strings apart', () => {
    expect(hash('forge')).toBe(hash('forge'));
    expect(hash('forge')).not.toBe(hash('farm'));
    expect(hash('')).toBe(2166136261);
  });
});

describe(seeded.name, () => {
  it('gives the same numbers for the same seed, all in [0, 1)', () => {
    const [a, b] = [seeded(42), seeded(42)];
    const xs = Array.from({ length: 50 }, () => a());
    expect(Array.from({ length: 50 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seeded(43)()).not.toBe(xs[0]);
  });
});

describe(pixelArt.name, () => {
  it('draws pixels, rounded, and ignores those outside the frame', () => {
    const a = pixelArt('test:put', 3, 2, (put) => {
      put(0.4, 0, C.fire);
      put(2, 1.4, C.smoke, 100);
      put(5, 0, C.fire);
      put(-1, 1, C.fire);
    });
    expect([a.w, a.h]).toEqual([3, 2]);
    expect(at(a, 0, 0)).toEqual([...C.fire]);
    expect(a.data[(1 * 3 + 2) * 4 + 3]).toBe(100);
    expect(drawn(a)).toBe(2);
  });

  it('makes a frame once and keeps it by id', () => {
    let calls = 0;
    const a = pixelArt('test:once', 1, 1, () => calls++);
    const b = pixelArt('test:once', 1, 1, () => calls++);
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });

  it('outlines the edge of what it draws, as the sprites are finished', () => {
    const a = pixelArt(
      'test:outline',
      3,
      3,
      (put) => {
        for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) put(x, y, C.canvas);
      },
      true,
    );
    // the frame's own edge counts as empty: every pixel but the middle is on the edge
    expect(at(a, 1, 1)).toEqual([...C.canvas]);
    expect(at(a, 0, 0)).toEqual([...C.outline]);
    expect(at(a, 2, 1)).toEqual([...C.outline]);
  });
});

describe(smokeFrame.name, () => {
  it('draws puffs that fade as they rise, differently for each frame and chimney', () => {
    const frames = Array.from({ length: SMOKE_FRAMES }, (_, i) => smokeFrame(i, 0).art);
    expect(frames.every((f) => drawn(f) > 0)).toBe(true);
    expect(new Set(frames.map((f) => f.id)).size).toBe(SMOKE_FRAMES);
    expect(smokeFrame(0, 1).art.id).not.toBe(smokeFrame(0, 0).art.id);
    expect(smokeFrame(0, 0)).toMatchObject({ ax: 3, ay: 17 });
  });
});

describe(fireFrame.name, () => {
  it('draws flames about as high as asked, flickering from frame to frame', () => {
    const f = fireFrame(0, 4);
    expect(drawn(f.art)).toBeGreaterThan(4);
    expect(f.art.h).toBe(7);
    expect(fireFrame(6, 4).art).toBe(f.art);
    expect(new Set([0, 1, 2, 3, 4, 5].map((i) => fireFrame(i, 4).art.id)).size).toBe(6);
  });
});

describe(sailsFrame.name, () => {
  it('draws four outlined blades round a dark hub, turning over the frames', () => {
    const f = sailsFrame(0, 8);
    expect([f.ax, f.ay]).toEqual([12, 12]);
    expect(at(f.art, f.ax, f.ay)).toEqual([...C.outline]);
    expect(drawn(f.art)).toBeGreaterThan(30);
    expect(sailsFrame(SAIL_FRAMES, 8).art).toBe(f.art);
    expect(sailsFrame(1, 8).art.id).not.toBe(f.art.id);
  });

  it('starts as the still sprite draws them: blades on the diagonals', () => {
    const f = sailsFrame(0, 8);
    // a spar runs from the hub down and to the right
    expect(at(f.art, f.ax + 4, f.ay + 3)).not.toBeNull();
    // and nothing sits straight above the hub
    expect(at(f.art, f.ax, f.ay - 6)).toBeNull();
  });
});

describe(wheelFrame.name, () => {
  it('draws a rim, spokes and paddles round a light hub, turning over the frames', () => {
    const f = wheelFrame(0, 3);
    expect(at(f.art, f.ax, f.ay)).toEqual([...C.logEnd]);
    expect(drawn(f.art)).toBeGreaterThan(10);
    expect(wheelFrame(WHEEL_FRAMES, 3).art).toBe(f.art);
    expect(wheelFrame(1, 3).art.id).not.toBe(f.art.id);
  });
});

describe(bannerFrame.name, () => {
  it('flicks the cloth out beside the banner on three frames of four', () => {
    expect(drawn(bannerFrame(0).art)).toBe(0);
    expect(drawn(bannerFrame(1).art)).toBe(1);
    expect(drawn(bannerFrame(2).art)).toBe(2);
    expect(at(bannerFrame(3).art, 3, 1)).toEqual([...C.bannerDark]);
  });
});

describe(glowFrame.name, () => {
  it('lights a window its full height, brighter and dimmer by frame', () => {
    const f = glowFrame(2, 3).art;
    expect([f.w, f.h]).toEqual([1, 3]);
    expect(drawn(f)).toBe(3);
    expect(f.data[3]).toBeGreaterThan(glowFrame(0, 3).art.data[3]!);
  });
});

describe(horseTailFrame.name, () => {
  it('flicks the tail behind the horse on the first two frames of six', () => {
    expect(drawn(horseTailFrame(0).art)).toBe(1);
    expect(drawn(horseTailFrame(1).art)).toBe(2);
    expect(drawn(horseTailFrame(3).art)).toBe(0);
    expect(horseTailFrame(0)).toMatchObject({ ax: -3, ay: 3 });
  });
});

describe(dustFrame.name, () => {
  it('draws fading dust drifting up and away', () => {
    const f = dustFrame(0, 0).art;
    expect(drawn(f)).toBeGreaterThan(0);
    expect(dustFrame(1, 0).art.id).not.toBe(f.id);
  });
});

describe(blastFrame.name, () => {
  it('flashes white, then throws rubble into a swelling cloud that fades', () => {
    const flash = blastFrame(0).art;
    expect(at(flash, 11, 14)).toEqual([...C.white]);
    expect(drawn(blastFrame(3).art)).toBeGreaterThan(drawn(flash));
    const last = blastFrame(BLAST_FRAMES - 1).art;
    const maxAlpha = (a: PixelArt) => Math.max(...a.data.filter((_, i) => i % 4 === 3));
    expect(maxAlpha(last)).toBeLessThan(maxAlpha(blastFrame(4).art));
    expect(blastFrame(99).art).toBe(last);
  });
});

describe(frameAt.name, () => {
  it('steps through the frames at the rate asked, from the phase, and loops', () => {
    expect(frameAt(0, 6, 10, 0)).toBe(0);
    expect(frameAt(1000, 6, 10, 0)).toBe(6);
    expect(frameAt(2000, 6, 10, 0)).toBe(2);
    expect(frameAt(0, 6, 10, 3)).toBe(3);
  });
});

describe(blastAt.name, () => {
  it('blasts once a cycle for a little over a second, and is quiet otherwise', () => {
    const frames = Array.from({ length: BLAST_EVERY_S * 8 }, (_, i) => blastAt(i * 125, 0));
    expect(frames.filter((f) => f >= 0)).toEqual(Array.from({ length: BLAST_FRAMES }, (_, i) => i));
  });

  it('blasts each quarry at its own moment', () => {
    expect(blastAt(0, 0)).toBe(0);
    expect(blastAt(0, 5)).toBe(-1);
  });
});

describe(hasMovingParts.name, () => {
  it('knows the sprites drawn with a turning part', () => {
    expect(hasMovingParts('buildings/farm-4.png')).toBe(true);
    expect(hasMovingParts('buildings/sawmill-4.png')).toBe(true);
    expect(hasMovingParts('buildings/farm-1.png')).toBe(true);
    expect(hasMovingParts('buildings/cottage-1.png')).toBe(false);
    expect(hasMovingParts('buildings/nothing.png')).toBe(false);
  });
});

describe(placeFrame.name, () => {
  it("puts the frame's anchor on the spot of a sprite standing on its tile", () => {
    const owner = { key: 'b1', col: 2, row: 3, file: 'x' };
    const f = { art: pixelArt('test:place', 1, 1, () => {}), ax: 1, ay: 2 };
    // a 64-pixel sprite's top left is (-32, -46) from its tile's middle
    expect(placeFrame(owner, { x: 40, y: 10 }, f, 'k')).toMatchObject({ col: 2, row: 3, x: -32 + 40 - 1, y: -46 + 10 - 2, key: 'k' });
    expect(placeFrame({ ...owner, size: 128 }, { x: 40, y: 10 }, f, 'k')).toMatchObject({ x: -64 + 40 - 1, y: -94 + 10 - 2 });
  });
});

describe(ambientOverlays.name, () => {
  it("animates a forge's chimney smoke and furnace glow at their spots", () => {
    const owner = { key: 'b7', col: 1, row: 1, file: 'buildings/forge-2.png' };
    const kinds = (SPOTS[owner.file] ?? []).map((s) => s.k);
    const o = ambientOverlays(owner, 0);
    expect(o.length).toBe(kinds.filter((k) => k === SpotKind.SMOKE || k === SpotKind.GLOW).length);
    expect(o.some((x) => x.art.id.startsWith('smoke'))).toBe(true);
    expect(o.some((x) => x.art.id.startsWith('glow'))).toBe(true);
    expect(new Set(o.map((x) => x.key)).size).toBe(o.length);
  });

  it('turns the sails and wheels of the field buildings', () => {
    expect(ambientOverlays({ key: 'f', col: 0, row: 0, file: 'buildings/farm-4.png' }, 0).some((o) => o.art.id.startsWith('sails'))).toBe(true);
    expect(ambientOverlays({ key: 's', col: 0, row: 0, file: 'buildings/sawmill-4.png' }, 0).some((o) => o.art.id.startsWith('wheel'))).toBe(true);
  });

  it('moves with time, and has nothing for a sprite without spots', () => {
    const owner = { key: 'b7', col: 1, row: 1, file: 'buildings/forge-2.png' };
    expect(ambientOverlays(owner, 0).map((o) => o.art.id)).not.toEqual(ambientOverlays(owner, 500).map((o) => o.art.id));
    expect(ambientOverlays({ ...owner, file: 'buildings/none.png' }, 0)).toEqual([]);
  });
});

describe(constructionFrame.name, () => {
  it('draws scaffolding with builders, their hammers moving and dust on some frames', () => {
    const frames = Array.from({ length: BUILD_FRAMES }, (_, i) => constructionFrame(i, 1).art);
    expect(frames.every((f) => drawn(f) > 40)).toBe(true);
    expect(new Set(frames.map((f) => f.id)).size).toBe(BUILD_FRAMES);
    expect(constructionFrame(BUILD_FRAMES, 1).art).toBe(frames[0]);
  });

  it('is twice as big over a 2×2 tile', () => {
    const [one, two] = [constructionFrame(0, 1), constructionFrame(0, 2)];
    expect(two.art.w).toBeGreaterThan(one.art.w * 1.8);
    expect(two.ay).toBeGreaterThan(one.ay);
  });
});

describe(sparkleFrame.name, () => {
  it('scatters gold and white that rise and fade', () => {
    const [first, last] = [sparkleFrame(0, 1).art, sparkleFrame(9, 1).art];
    expect(drawn(first)).toBeGreaterThan(10);
    const maxAlpha = (a: PixelArt) => Math.max(...a.data.filter((_, i) => i % 4 === 3));
    expect(maxAlpha(last)).toBeLessThan(maxAlpha(first));
  });
});

describe(walkerFrame.name, () => {
  it('draws a person 3 by 6 pixels, stepping, in the clothes picked, facing either way', () => {
    const f = walkerFrame(0, 1, false);
    expect([f.art.w, f.art.h, f.ax, f.ay]).toEqual([3, 6, 1, 5]);
    expect(at(f.art, 1, 2)).toEqual([72, 112, 172]);
    expect(walkerFrame(1, 1, false).art.id).not.toBe(f.art.id);
    expect(walkerFrame(0, 1, true).art.id).not.toBe(f.art.id);
    expect(walkerFrame(2, 1, false).art).toBe(f.art);
  });
});

describe(constructionOverlays.name, () => {
  it("lays the scaffolding with its anchor on the tile's middle", () => {
    const [o] = constructionOverlays({ key: 'b3', col: 2, row: 1 }, 0);
    expect(o).toMatchObject({ key: 'b3:build', col: 2, row: 1 });
    const f = constructionFrame(o!.art.id === constructionFrame(0, 1).art.id ? 0 : 1, 1);
    expect([o!.x, o!.y]).toEqual([-f.ax, -f.ay]);
    expect(constructionOverlays({ key: 'th', col: 0, row: 0, size: 128 }, 0)[0]!.art.w).toBeGreaterThan(o!.art.w);
  });
});

describe(sparkleOverlays.name, () => {
  const owner = { key: 'b1', col: 0, row: 0 };
  it('sparkles for a moment after the building finished', () => {
    expect(sparkleOverlays(owner, 1000, 900)).toHaveLength(1);
    expect(sparkleOverlays(owner, 900 + SPARKLE_MS + 1, 900)).toEqual([]);
  });

  it('shows nothing for a building that has not finished, or before it did', () => {
    expect(sparkleOverlays(owner, 1000, undefined)).toEqual([]);
    expect(sparkleOverlays(owner, 1000, 2000)).toEqual([]);
  });
});

describe(streetLines.name, () => {
  it('runs a street between each pair of slots and one beyond each end', () => {
    const round = (xs: number[]) => xs.map((x) => Math.round(x * 100) / 100);
    expect(round(streetLines([1, 2.3, 3.6]))).toEqual([0.35, 1.65, 2.95, 4.25]);
    expect(round(streetLines([3.6, 1, 2.3, 1]))).toEqual([0.35, 1.65, 2.95, 4.25]);
  });

  it('has no streets for fewer than two slots', () => {
    expect(streetLines([])).toEqual([]);
    expect(streetLines([2])).toEqual([]);
  });
});

describe(streetsOf.name, () => {
  const grid = [0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => ({ col: c, row: r })));

  it('joins each crossing to its neighbours along the streets', () => {
    const s = streetsOf(grid);
    expect(s.nodes).toHaveLength(16);
    expect(s.nodes[0]).toEqual({ col: -0.5, row: -0.5 });
    expect(s.links[0]!.map((i) => s.nodes[i])).toEqual([
      { col: 0.5, row: -0.5 },
      { col: -0.5, row: 0.5 },
    ]);
    expect(s.links[5]).toHaveLength(4);
  });

  it('keeps the streets out of a big slot', () => {
    const s = streetsOf([...grid, { col: 1, row: 1, span: 2 }]);
    const inside = s.nodes.findIndex((n) => n.col === 0.5 && n.row === 0.5);
    expect(s.links[inside]).toEqual([]);
    expect(s.links.flat()).not.toContain(inside);
  });
});

describe(walkerRoute.name, () => {
  const s = streetsOf([0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => ({ col: c, row: r }))));

  it('walks ROUTE_STEPS steps from crossing to joined crossing, the same for the same seed', () => {
    const route = walkerRoute(s, 5);
    expect(route).toHaveLength(ROUTE_STEPS + 1);
    for (let i = 1; i < route.length; i++) expect(s.links[route[i - 1]!]).toContain(route[i]);
    expect(walkerRoute(s, 5)).toEqual(route);
  });

  it('has no route where there are no streets', () => {
    expect(walkerRoute({ nodes: [], links: [] }, 1)).toEqual([]);
  });
});

describe(walkerAt.name, () => {
  const s = {
    nodes: [
      { col: 0, row: 0 },
      { col: 2, row: 0 },
    ],
    links: [[1], [0]],
  };

  it('walks the route at WALK_SPEED, there and back again', () => {
    expect(walkerAt(s, [0, 1], 0, 0)).toEqual({ col: 0, row: 0, left: false });
    expect(walkerAt(s, [0, 1], 1000 / WALK_SPEED, 0)).toMatchObject({ col: 1, row: 0, left: false });
    // on the way back it faces the other way
    expect(walkerAt(s, [0, 1], 3000 / WALK_SPEED, 0)).toMatchObject({ col: 1, row: 0, left: true });
    expect(walkerAt(s, [0, 1], 4000 / WALK_SPEED, 0)).toMatchObject({ col: 0, row: 0 });
  });

  it('starts each walker further along by its phase', () => {
    expect(walkerAt(s, [0, 1], 0, 1 / WALK_SPEED)).toMatchObject({ col: 1, row: 0 });
  });

  it('has nowhere to be without a route', () => {
    expect(walkerAt(s, [0], 0, 0)).toBeNull();
  });
});

describe(walkerOverlays.name, () => {
  const s = streetsOf([0, 1, 2].flatMap((c) => [0, 1, 2].map((r) => ({ col: c, row: r }))));

  it('puts the people asked for on the streets, each with its own key', () => {
    const o = walkerOverlays(s, 5, 1234, 'town');
    expect(o).toHaveLength(5);
    expect(new Set(o.map((w) => w.key)).size).toBe(5);
    for (const w of o) expect(s.nodes.some((n) => n.col === w.col || n.row === w.row)).toBe(true);
  });

  it('puts nobody on a grid without streets', () => {
    expect(walkerOverlays({ nodes: [], links: [] }, 3, 0, 'x')).toEqual([]);
  });
});

describe(drillFrame.name, () => {
  it('draws three recruits with spears, stepping in turn', () => {
    const [f0, f1] = [drillFrame(0).art, drillFrame(1).art];
    expect(drawn(f0)).toBeGreaterThan(40);
    expect(f1.id).not.toBe(f0.id);
    expect(drillFrame(4).art).toBe(f0);
  });
});

describe(riderFrame.name, () => {
  it('draws a horse and rider, stepping, facing either way', () => {
    expect(drawn(riderFrame(0, false).art)).toBeGreaterThan(10);
    expect(riderFrame(1, false).art.id).not.toBe(riderFrame(0, false).art.id);
    expect(riderFrame(0, true).art.id).not.toBe(riderFrame(0, false).art.id);
  });
});

describe(stretcherFrame.name, () => {
  it('draws two bearers with a stretcher between them', () => {
    const f = stretcherFrame(0, false).art;
    expect(drawn(f)).toBeGreaterThan(20);
    expect(at(f, 5, 3)).toEqual([...C.wool]);
  });
});

describe(sparksFrame.name, () => {
  it('throws sparks as the hammer falls, and none between blows', () => {
    expect(drawn(sparksFrame(0).art)).toBeGreaterThan(0);
    expect(drawn(sparksFrame(5).art)).toBe(0);
  });
});

describe(sawdustFrame.name, () => {
  it('scatters sawdust, differently each frame', () => {
    expect(drawn(sawdustFrame(0).art)).toBeGreaterThan(0);
    expect(sawdustFrame(1).art.id).not.toBe(sawdustFrame(0).art.id);
  });
});

describe(twinkleFrame.name, () => {
  it('twinkles bigger and smaller over its frames', () => {
    expect(drawn(twinkleFrame(0).art)).toBeGreaterThan(drawn(twinkleFrame(1).art));
  });
});

describe(pacing.name, () => {
  it('walks back and forth within its reach, two across for one down', () => {
    for (let t = 0; t < 20_000; t += 500) {
      const p = pacing(t, 8, 3);
      expect(Math.abs(p.dx)).toBeLessThanOrEqual(8);
      expect(p.dy).toBe(Math.round(p.dx / 2));
    }
    expect(new Set(Array.from({ length: 40 }, (_, i) => pacing(i * 500, 8, 3).left)).size).toBe(2);
  });
});

describe(buildingOverlays.name, () => {
  const owner = (file: string) => ({ key: 'b1', col: 0, row: 0, file });
  const ids = (o: { art: PixelArt }[]) => o.map((x) => x.art.id.split(':')[0]);

  it('shows the ambient animations of a building doing nothing', () => {
    expect(buildingOverlays(owner('buildings/forge-2.png'), BuildingType.FORGE, 5, QUIET_TOWN, 0).map((o) => o.key)).toEqual(
      ambientOverlays(owner('buildings/forge-2.png'), 0).map((o) => o.key),
    );
  });

  it('blazes the beacon, in place of its small flame, while an enemy army comes', () => {
    const quiet = ids(buildingOverlays(owner('buildings/beacon-tower-1.png'), BuildingType.BEACON_TOWER, 9, QUIET_TOWN, 0));
    const alarm = buildingOverlays(owner('buildings/beacon-tower-1.png'), BuildingType.BEACON_TOWER, 9, { ...QUIET_TOWN, enemy: true }, 0);
    expect(quiet).toContain('fire');
    expect(ids(alarm)).toContain('smoke');
    const flame = (o: { art: PixelArt }[]) => Math.max(...o.filter((x) => x.art.id.startsWith('fire')).map((x) => x.art.h));
    expect(flame(alarm)).toBeGreaterThan(flame(buildingOverlays(owner('buildings/beacon-tower-1.png'), BuildingType.BEACON_TOWER, 9, QUIET_TOWN, 0)));
  });

  it('drills recruits only at a barracks that is training', () => {
    const b = owner('buildings/barracks-1.png');
    expect(ids(buildingOverlays(b, BuildingType.BARRACKS, 4, { ...QUIET_TOWN, training: [4] }, 0))).toContain('drill');
    expect(ids(buildingOverlays(b, BuildingType.BARRACKS, 6, { ...QUIET_TOWN, training: [4] }, 0))).not.toContain('drill');
  });

  it('lights the windows at night', () => {
    const lit = buildingOverlays(owner('buildings/cottage-1.png'), BuildingType.COTTAGE, 1, QUIET_TOWN, 0, true);
    const windows = (SPOTS['buildings/cottage-1.png'] ?? []).filter((s) => s.k === SpotKind.WINDOW).length;
    expect(windows).toBeGreaterThan(0);
    expect(lit.filter((o) => o.art.id.startsWith('lamp') && o.light)).toHaveLength(windows);
    expect(buildingOverlays(owner('buildings/cottage-1.png'), BuildingType.COTTAGE, 1, QUIET_TOWN, 0).some((o) => o.art.id.startsWith('lamp'))).toBe(false);
  });

  it('shows each building at work while the city does what it shows', () => {
    const show = (file: string, type: number, state: Partial<typeof QUIET_TOWN>) => ids(buildingOverlays(owner(file), type, 1, { ...QUIET_TOWN, ...state }, 0));
    expect(show('buildings/forge-2.png', BuildingType.FORGE, { forts: true })).toContain('sparks');
    expect(show('buildings/academy-1.png', BuildingType.ACADEMY, { research: true })).toContain('glow');
    expect(show('buildings/stable-1.png', BuildingType.STABLE, { cavalry: true })).toContain('rider');
    expect(show('buildings/relief-station-1.png', BuildingType.RELIEF_STATION, { injured: true })).toContain('stretcher');
    expect(show('buildings/rally-spot-1.png', BuildingType.RALLY_SPOT, { armyOut: true })).toContain('drill');
    expect(show('buildings/workshop-1.png', BuildingType.WORKSHOP, { siege: true })).toContain('sawdust');
    expect(show('buildings/workshop-1.png', BuildingType.WORKSHOP, {})).not.toContain('sawdust');
  });
});

describe(windowLightFrame.name, () => {
  it('lights a window its full height, and gives light', () => {
    const f = windowLightFrame(0, 3);
    expect([f.art.w, f.art.h, f.light]).toEqual([1, 3, true]);
    expect(drawn(f.art)).toBe(3);
  });
});

describe(darknessAt.name, () => {
  it('is deep night from nine to five, full day from eight to six, and fades between', () => {
    expect(darknessAt(23)).toBe(1);
    expect(darknessAt(3)).toBe(1);
    expect(darknessAt(12)).toBe(0);
    expect(darknessAt(19.5)).toBeCloseTo(0.5);
    expect(darknessAt(6.5)).toBeCloseTo(0.5);
    expect(darknessAt(-1)).toBe(1);
  });
});

describe(isNight.name, () => {
  it('is night when dark enough for lit windows', () => {
    expect(isNight(new Date(2026, 9, 20, 23, 0))).toBe(true);
    expect(isNight(new Date(2026, 9, 20, 13, 0))).toBe(false);
  });
});

describe(weatherAt.name, () => {
  it('holds for a four-hour block, and is the same for everyone in a state', () => {
    const [a, b] = [new Date(Date.UTC(2026, 9, 20, 8, 5)), new Date(Date.UTC(2026, 9, 20, 11, 55))];
    for (let z = 0; z < 16; z++) expect(weatherAt(a, z)).toBe(weatherAt(b, z));
  });

  it('is mostly clear, sometimes wet, now and then stormy, and snows only in winter', () => {
    const summer = Array.from({ length: 16 * 6 * 30 }, (_, i) =>
      weatherAt(new Date(Date.UTC(2026, 6, 1 + (i % 30), (Math.floor(i / 30) % 6) * 4)), Math.floor(i / 180)),
    );
    const share = (w: string | null) => summer.filter((x) => x === w).length / summer.length;
    expect(share(null)).toBeGreaterThan(0.65);
    expect(share(Weather.RAIN)).toBeGreaterThan(0.08);
    expect(share(Weather.STORM)).toBeGreaterThan(0.01);
    expect(share(Weather.SNOW)).toBe(0);
    const winter = Array.from({ length: 16 * 6 * 30 }, (_, i) =>
      weatherAt(new Date(Date.UTC(2026, 0, 1 + (i % 30), (Math.floor(i / 30) % 6) * 4)), Math.floor(i / 180)),
    );
    expect(winter).toContain(Weather.SNOW);
    expect(winter).not.toContain(Weather.RAIN);
  });
});

describe(particlesAt.name, () => {
  it('fills the view with drops or flakes, more in a storm, none when dry', () => {
    const rain = particlesAt(Weather.RAIN, 0, 800, 600);
    expect(rain.length).toBe(96);
    expect(particlesAt(Weather.STORM, 0, 800, 600).length).toBeGreaterThan(rain.length);
    expect(particlesAt(null, 0, 800, 600)).toEqual([]);
    expect(particlesAt(Weather.RAIN, 0, 0, 0)).toEqual([]);
    for (const p of [...rain, ...particlesAt(Weather.SNOW, 5000, 800, 600)]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThan(800);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThan(600);
    }
  });

  it('lets rain fall fast and snow drift, as time goes by', () => {
    const [r0, r1] = [particlesAt(Weather.RAIN, 0, 800, 600)[0], particlesAt(Weather.RAIN, 100, 800, 600)[0]];
    const [s0, s1] = [particlesAt(Weather.SNOW, 0, 800, 600)[0], particlesAt(Weather.SNOW, 100, 800, 600)[0]];
    const dy = (a: { y: number }, b: { y: number }) => (b.y - a.y + 600) % 600;
    expect(dy(r0!, r1!)).toBeGreaterThan(30);
    expect(dy(s0!, s1!)).toBeLessThan(10);
    expect(r0!.len).toBeGreaterThan(0);
    expect(s0!.len).toBe(0);
  });
});

describe(flashAt.name, () => {
  it('flashes and flickers once every 11 seconds, dark between', () => {
    const flashes = Array.from({ length: 1100 }, (_, i) => flashAt(i * 10, 0));
    expect(flashes[0]).toBe(1);
    expect(flashes.filter((f) => f > 0).length).toBeLessThan(40);
    expect(Math.max(...flashes.slice(100, 1000))).toBe(0);
  });
});

describe(skyAt.name, () => {
  it('darkens at night and under cloud, with rain and lightning only in their weather', () => {
    const noon = new Date(2026, 6, 1, 12, 0);
    const midnight = new Date(2026, 6, 1, 0, 0);
    for (let z = 0; z < 16; z++) {
      const day = skyAt(z, 0, 800, 600, noon);
      const night = skyAt(z, 0, 800, 600, midnight);
      expect(night.darkness).toBeGreaterThan(day.darkness);
      if (!day.weather) expect(day.darkness).toBe(0);
      if (day.weather !== Weather.STORM) expect(day.flash).toBe(0);
      expect(day.particles.length > 0).toBe(!!day.weather);
    }
  });
});

describe(aftermathOverlays.name, () => {
  const owners = Array.from({ length: 8 }, (_, i) => ({ key: `b${i}`, col: i, row: 0, file: 'x' }));

  it('burns a few buildings just after an attack, the same ones each time', () => {
    const o = aftermathOverlays(owners, 1_000_000, 0, 1_000_000 + 1000);
    expect(o.filter((x) => x.art.id.startsWith('fire'))).toHaveLength(4);
    expect(o.every((x) => x.light === true || x.art.id.startsWith('smoke'))).toBe(true);
    expect(aftermathOverlays(owners, 1_000_000, 0, 1_000_000 + 1000).map((x) => x.key)).toEqual(o.map((x) => x.key));
  });

  it('dies down as time passes, and is out after AFTERMATH_MS', () => {
    const late = aftermathOverlays(owners, 1_000_000, 0, 1_000_000 + AFTERMATH_MS * 0.9);
    expect(late.filter((x) => x.art.id.startsWith('fire'))).toHaveLength(1);
    expect(aftermathOverlays(owners, 1_000_000, 0, 1_000_000 + AFTERMATH_MS + 1)).toEqual([]);
  });

  it('shows nothing without an attack, or with no buildings', () => {
    expect(aftermathOverlays(owners, null, 0, 5)).toEqual([]);
    expect(aftermathOverlays([], 1, 0, 5)).toEqual([]);
  });
});

describe(glintFrame.name, () => {
  it('catches the light on a few pixels of the lake, differently each frame', () => {
    const f = glintFrame(0, 8);
    expect(drawn(f.art)).toBeGreaterThan(2);
    expect([f.ax, f.ay]).toEqual([6, 3]);
    expect(glintFrame(1, 8).art.id).not.toBe(f.art.id);
  });

  it('makes lakes on the map glint', () => {
    expect(ambientOverlays({ key: 't', col: 0, row: 0, file: 'tiles/lake-4.png' }, 0).some((o) => o.art.id.startsWith('glint'))).toBe(true);
  });

  it('lights the campfires of barbarian camps', () => {
    expect(ambientOverlays({ key: 't', col: 0, row: 0, file: 'tiles/npc-3.png' }, 0).some((o) => o.art.id.startsWith('fire'))).toBe(true);
  });
});

describe(marchFrame.name, () => {
  it("draws soldiers behind a banner of their side's colour, stepping, facing either way", () => {
    const own = marchFrame(0, ArmySide.OWN, false).art;
    const flags = (art: PixelArt, c: readonly number[]) =>
      Array.from({ length: art.w * art.h }, (_, i) => i).filter((i) => at(art, i % art.w, Math.floor(i / art.w))?.join() === c.join()).length;
    expect(flags(own, SIDE_COLOURS.own)).toBe(9);
    expect(flags(marchFrame(0, ArmySide.ENEMY, false).art, SIDE_COLOURS.enemy)).toBe(9);
    expect(marchFrame(1, ArmySide.OWN, false).art.id).not.toBe(own.id);
    expect(marchFrame(0, ArmySide.OWN, true).art.id).not.toBe(own.id);
  });
});

describe(nearest.name, () => {
  it('moves a point by whole turns of the map to lie nearest another', () => {
    expect(nearest(5, 790, 800)).toBe(805);
    expect(nearest(795, 3, 800)).toBe(-5);
    expect(nearest(400, 410, 800)).toBe(400);
  });
});

describe(armyAt.name, () => {
  const size = 800;
  const army = (from: [number, number], to: [number, number], direction = 1) => ({
    armyId: 1,
    startFieldId: from[1] * size + from[0],
    targetFieldId: to[1] * size + to[0],
    startTime: 1000,
    reachTime: 2000,
    direction,
  });

  it('moves an army along its route by its timings', () => {
    expect(armyAt(army([10, 10], [20, 10]), size, 1500, { col: 15, row: 10 })).toEqual({ col: 15, row: 10, left: false });
    expect(armyAt(army([10, 10], [20, 10]), size, 500, { col: 15, row: 10 })).toMatchObject({ col: 10, row: 10 });
    expect(armyAt(army([10, 10], [20, 10]), size, 9000, { col: 15, row: 10 })).toMatchObject({ col: 20, row: 10 });
  });

  it('brings a returning army back the other way, and keeps a staying army at its target', () => {
    expect(armyAt(army([10, 10], [20, 10], 2), size, 1250, { col: 15, row: 10 })).toMatchObject({ col: 17.5, row: 10, left: true });
    expect(armyAt(army([10, 10], [20, 10], 3), size, 1000, { col: 15, row: 10 })).toMatchObject({ col: 20, row: 10 });
  });

  it("takes the shorter way across the map's edge, and stands nearest the camera", () => {
    expect(armyAt(army([795, 0], [5, 0]), size, 1500, { col: 0, row: 0 })).toMatchObject({ col: 0, row: 0 });
    expect(armyAt(army([795, 0], [5, 0]), size, 1500, { col: 800, row: 0 })).toMatchObject({ col: 800, row: 0 });
  });
});

describe(armyOverlays.name, () => {
  it('draws each army marching under its side, keyed by army', () => {
    const marching = [
      { army: { armyId: 7, startFieldId: 0, targetFieldId: 10, startTime: 0, reachTime: 1000, direction: 1 }, side: ArmySide.OWN },
      { army: { armyId: 8, startFieldId: 0, targetFieldId: 10, startTime: 0, reachTime: 1000, direction: 1 }, side: ArmySide.ENEMY },
    ];
    const o = armyOverlays(marching, 800, { col: 0, row: 0 }, 0, 500);
    expect(o.map((x) => x.key)).toEqual(['army7', 'army8']);
    expect(o[0]).toMatchObject({ col: 5, row: 0 });
    expect(o[1]!.art.id).toContain('enemy');
  });
});

describe(zoneOf.name, () => {
  it('finds the state a map point lies in, wrapping round the edges', () => {
    expect(zoneOf({ col: 100, row: 100 }, 800)).toBe(0);
    expect(zoneOf({ col: 300, row: 100 }, 800)).toBe(1);
    expect(zoneOf({ col: 100, row: 300 }, 800)).toBe(4);
    expect(zoneOf({ col: -5, row: -5 }, 800)).toBe(15);
  });
});

describe(workerOverlays.name, () => {
  it('puts a worker pacing on each place given', () => {
    const o = workerOverlays(
      [
        { key: 'v1', col: 3, row: 4 },
        { key: 'v2', col: 9, row: 9 },
      ],
      1000,
    );
    expect(o.map((w) => [w.key, w.col, w.row])).toEqual([
      ['v1:worker', 3, 4],
      ['v2:worker', 9, 9],
    ]);
    expect(o[0]!.art.id.startsWith('walker')).toBe(true);
  });
});

describe(sheepFrame.name, () => {
  it('draws the sheep as the farm does: fleece, head and legs about its spot', () => {
    const f = sheepFrame(6, true);
    expect([f.ax, f.ay]).toEqual([2, 2]);
    expect(at(f.art, 2, 1)).toEqual([...C.wool]);
    expect(at(f.art, 1, 0)).toEqual([...C.outline]);
    expect(at(f.art, 2, 2)).toEqual([...C.logDark]);
  });

  it('grazes head down most of the time, steps on odd frames, and faces either way', () => {
    expect(at(sheepFrame(0, true).art, 1, 2)).toEqual([...C.outline]);
    expect(at(sheepFrame(1, true).art, 4, 2)).toEqual([...C.logDark]);
    expect(at(sheepFrame(0, false).art, 3, 2)).toEqual([...C.outline]);
  });

  it("makes the farm's sheep move", () => {
    expect(ambientOverlays({ key: 'f', col: 0, row: 0, file: 'buildings/farm-1.png' }, 0).filter((o) => o.art.id.startsWith('sheep')).length).toBe(
      (SPOTS['buildings/farm-1.png'] ?? []).filter((s) => s.k === SpotKind.SHEEP).length,
    );
  });
});
