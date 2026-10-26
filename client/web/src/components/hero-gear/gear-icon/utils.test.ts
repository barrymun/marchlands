import { describe, expect, it } from 'vitest';

import { GEAR_PIECE_IDS } from '@marchlands/core';

import {
  BLADE_ALPHA,
  BURST_FLASH,
  BURST_FRAMES,
  BURST_SPARKS,
  FRAME_MS,
  GEAR_LIGHT,
  GEAR_SPOTS,
  GLINT_ARMS,
  GLINT_EVERY_MS,
  GOLD,
  MOVE_EVERY_MS,
  MOVE_MS,
  PULSE_MS,
  STAR_FRAMES,
  SWEEP_EVERY_MS,
  SWEEP_MS,
  WHITE,
} from '@/components/hero-gear/gear-icon/constants';
import type { GearPixel } from '@/components/hero-gear/gear-icon/types';
import {
  bladePixels,
  burstPixels,
  cycleAt,
  gearFrame,
  glintPixels,
  haloPixels,
  hasMotion,
  movedPiece,
  moveOffset,
  movePixels,
  moveShare,
  pieceMove,
  piecePhase,
  pixelData,
  pulseAt,
  starPixels,
  stoneMiddle,
  sweepPixels,
} from '@/components/hero-gear/gear-icon/utils';
import { GLOW_RGB } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/constants';
import { glowAlpha } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';

const at = (px: readonly GearPixel[], x: number, y: number) => px.find((p) => p.x === x && p.y === y);
const spot = (file: string, k: string) => GEAR_SPOTS[`gear/${file}`]?.find((s) => s.k === k);

describe(piecePhase.name, () => {
  it('spreads the 14 pieces evenly over a cycle, the first at its start', () => {
    const phases = GEAR_PIECE_IDS.map(piecePhase);
    expect(phases[0]).toBe(0);
    expect(new Set(phases).size).toBe(GEAR_PIECE_IDS.length);
    expect(Math.max(...phases)).toBeLessThan(1);
  });

  it('starts a piece it does not know at the start', () => {
    expect(piecePhase('cloak')).toBe(0);
  });
});

describe(cycleAt.name, () => {
  it('counts from the start of each cycle, moved on by the phase', () => {
    expect(cycleAt(0, 1000, 0)).toBe(0);
    expect(cycleAt(2500, 1000, 0)).toBe(500);
    expect(cycleAt(0, 1000, 0.25)).toBe(250);
    expect(cycleAt(900, 1000, 0.25)).toBeCloseTo(150);
  });

  it('stays in the cycle for a time before the clock started', () => {
    expect(cycleAt(-250, 1000, 0)).toBeCloseTo(750);
  });
});

describe(pulseAt.name, () => {
  it('rises from half to full a quarter of the way through, and back over PULSE_MS', () => {
    expect(pulseAt(0, 0)).toBeCloseTo(0.5);
    expect(pulseAt(PULSE_MS / 4, 0)).toBeCloseTo(1);
    expect(pulseAt((PULSE_MS * 3) / 4, 0)).toBeCloseTo(0);
    expect(pulseAt(PULSE_MS, 0)).toBeCloseTo(0.5);
  });

  it('is moved on by its phase', () => {
    expect(pulseAt(0, 0.25)).toBeCloseTo(1);
  });
});

describe(glintPixels.name, () => {
  it('draws a white point with arms as long as the frame has them', () => {
    GLINT_ARMS.forEach(([arms, a], f) => {
      const px = glintPixels(10, 10, f);
      expect(px).toHaveLength(1 + arms * 4);
      expect(at(px, 10, 10)).toEqual({ x: 10, y: 10, c: WHITE, a });
    });
  });

  it('makes the outer pixel of a long arm fainter', () => {
    const px = glintPixels(10, 10, 1);
    expect(at(px, 11, 10)?.a).toBe(255);
    expect(at(px, 12, 10)?.a).toBe(128);
  });

  it('draws nothing between flares', () => {
    expect(glintPixels(10, 10, GLINT_ARMS.length)).toEqual([]);
  });
});

describe(haloPixels.name, () => {
  it('is brightest at the middle and fades to nothing at its reach', () => {
    const px = haloPixels(10, 10, 3, WHITE, 200);
    const middle = at(px, 9, 9);
    const edge = at(px, 12, 9);
    expect(middle && edge && middle.a > edge.a).toBe(true);
    expect(at(px, 13, 9)).toBeUndefined();
    expect(px.every((p) => p.a > 0 && p.a < 200)).toBe(true);
  });

  it('draws nothing with no light', () => {
    expect(haloPixels(10, 10, 3, WHITE, 0)).toEqual([]);
  });
});

describe(stoneMiddle.name, () => {
  it('finds the middle of a stone from its glint', () => {
    expect(stoneMiddle({ k: 'gem', x: 6, y: 25, n: 1 })).toEqual({ x: 6.5, y: 25.5, r: 1 });
    expect(stoneMiddle({ k: 'gem', x: 14, y: 21, n: 3.5 })).toEqual({ x: 16.5, y: 23.5, r: 3.5 });
  });

  it('takes a point of light as its own middle', () => {
    expect(stoneMiddle({ k: 'shine', x: 15, y: 11 })).toEqual({ x: 15.5, y: 11.5, r: 0.5 });
  });
});

describe(bladePixels.name, () => {
  const blade = { k: 'blade', x: 10, y: 22, n: 10, m: 1 };

  it('lights the blade from the guard up the diagonal, as long and as wide as it is', () => {
    const px = bladePixels(blade, WHITE, 90);
    expect(at(px, 10, 21)).toEqual({ x: 10, y: 21, c: WHITE, a: 90 });
    expect(at(px, 16, 15)).toBeDefined();
    expect(at(px, 18, 13)).toBeUndefined();
  });

  it('lights nothing below the guard, nor beside the blade', () => {
    const px = bladePixels(blade, WHITE, 90);
    expect(at(px, 8, 23)).toBeUndefined();
    expect(at(px, 15, 21)).toBeUndefined();
  });
});

describe(sweepPixels.name, () => {
  it('lights a diagonal line, brightest in its middle', () => {
    const px = sweepPixels(0);
    expect(at(px, 5, 5)?.a).toBe(150);
    expect(at(px, 6, 5)?.a).toBe(70);
    expect(at(px, 7, 5)).toBeUndefined();
  });

  it('lights nothing off the sprite', () => {
    expect(sweepPixels(-40)).toEqual([]);
  });
});

describe(starPixels.name, () => {
  const star = { k: 'star', x: 6, y: 7, n: 2 };

  it('makes a star’s arms a pixel longer, tipped in level 10’s light', () => {
    const px = starPixels(star, 0);
    expect(at(px, 8, 7)?.c).toEqual(WHITE);
    expect(at(px, 9, 7)?.c).toEqual(GEAR_LIGHT[10]);
    expect(at(px, 7, 8)).toBeUndefined();
  });

  it('adds points between the arms at the height of the flare', () => {
    expect(at(starPixels(star, 1), 7, 8)?.a).toBe(140);
  });

  it('draws nothing outside its frames', () => {
    expect(starPixels(star, STAR_FRAMES)).toEqual([]);
    expect(starPixels(star, -1)).toEqual([]);
  });
});

describe(hasMotion.name, () => {
  it('keeps every piece still below level 3 but those with a movement of their own', () => {
    const moving = GEAR_PIECE_IDS.filter((p) => [0, 1, 2].some((l) => hasMotion(p, l)));
    expect(moving.sort()).toEqual(['back', 'charm', 'mount', 'necklace']);
  });

  it('moves a piece with stones from level 3, and every piece from 9', () => {
    expect(hasMotion('weapon', 3)).toBe(true);
    expect(hasMotion('legs', 3)).toBe(false);
    expect(GEAR_PIECE_IDS.every((p) => hasMotion(p, 9) && hasMotion(p, 10))).toBe(true);
  });
});

describe(gearFrame.name, () => {
  const all = (f: ReturnType<typeof gearFrame>) => [...f.behind, ...f.piece, ...f.over];

  it('is still below level 3', () => {
    for (const p of GEAR_PIECE_IDS) for (let t = 0; t < GLINT_EVERY_MS; t += 250) expect(all(gearFrame(p, 2, t))).toEqual([]);
  });

  it('flares a stone at its own moment, and not between', () => {
    const gem = spot('weapon-3.png', 'gem');
    expect(gem).toBeDefined();
    expect(at(gearFrame('weapon', 3, 0).over, gem?.x ?? -1, gem?.y ?? -1)).toBeDefined();
    expect(gearFrame('weapon', 3, GLINT_ARMS.length * FRAME_MS + 1).over).toEqual([]);
  });

  it('flares each piece at a different moment', () => {
    const flaring = GEAR_PIECE_IDS.filter((p) => gearFrame(p, 3, 0).over.length > 0);
    expect(flaring).toEqual(['weapon']);
  });

  it('makes the stones glow from level 6, not before', () => {
    const between = GLINT_EVERY_MS / 2;
    expect(gearFrame('necklace', 5, between).over).toEqual([]);
    expect(gearFrame('necklace', 6, between).over.length).toBeGreaterThan(0);
  });

  it('makes a glowing blade pulse on the piece at levels 6 to 8 only', () => {
    const t = PULSE_MS / 4;
    for (const level of [6, 7, 8]) {
      const px = gearFrame('weapon', level, t).piece;
      expect(px.length).toBeGreaterThan(0);
      expect(px.every((p) => p.a === BLADE_ALPHA && p.c === GEAR_LIGHT[level])).toBe(true);
    }
    expect(gearFrame('weapon', 5, t).piece).toEqual([]);
  });

  it('crosses gilded and crimson metal with a glint now and then, from level 9', () => {
    const t = SWEEP_MS / 2;
    expect(gearFrame('weapon', 9, t).piece.some((p) => p.c === WHITE)).toBe(true);
    expect(gearFrame('weapon', 10, t).piece.some((p) => p.c === WHITE)).toBe(true);
    expect(gearFrame('weapon', 10, SWEEP_MS + 1).piece).toEqual([]);
    expect(gearFrame('chest', 8, t).piece).toEqual([]);
    expect(SWEEP_EVERY_MS).toBeGreaterThan(SWEEP_MS);
  });

  it('glows at level 10 in the figure’s light and time', () => {
    const t = 500;
    const px = gearFrame('mount', 10, t).over.filter((p) => p.c === GLOW_RGB);
    expect(px.length).toBeGreaterThan(0);
    expect(Math.max(...px.map((p) => p.a))).toBeLessThanOrEqual(Math.round(255 * glowAlpha(t)));
  });

  it('flares level 10’s backdrop stars behind the piece', () => {
    const behind = Array.from({ length: 40 }, (_, i) => gearFrame('weapon', 10, i * 100).behind.length);
    expect(Math.max(...behind)).toBeGreaterThan(0);
    for (let t = 0; t < 4000; t += 100) expect(gearFrame('weapon', 9, t).behind).toEqual([]);
  });

  it('plays a burst at any level, in gold below level 3 and the level’s light above', () => {
    const low = gearFrame('ring', 0, 1000, 1000);
    expect(low.piece.length).toBeGreaterThan(0);
    expect(low.over.some((p) => p.c === GOLD)).toBe(true);
    expect(gearFrame('ring', 7, 1000, 1000).over.some((p) => p.c === GEAR_LIGHT[7])).toBe(true);
    expect(all(gearFrame('ring', 0, 1000 + BURST_FRAMES * FRAME_MS, 1000))).toEqual([]);
  });

  it('moves only in the palette’s light, the level’s colours and the figure’s glow', () => {
    const allowed = [WHITE, GOLD, GLOW_RGB, ...Object.values(GEAR_LIGHT)].map((c) => c.join());
    for (const p of GEAR_PIECE_IDS)
      for (let level = 3; level <= 10; level++)
        for (let t = 0; t < 8000; t += 333) for (const px of all(gearFrame(p, level, t))) expect(allowed).toContain(px.c.join());
  });
});

describe(burstPixels.name, () => {
  it('flashes the whole piece white for its first frames, fading', () => {
    BURST_FLASH.forEach((a, f) => {
      const { piece } = burstPixels(f * FRAME_MS, GOLD, 0);
      expect(piece).toHaveLength(32 * 32);
      expect(piece.every((p) => p.c === WHITE && p.a === a)).toBe(true);
    });
    expect(burstPixels(BURST_FLASH.length * FRAME_MS, GOLD, 0).piece).toEqual([]);
  });

  it('sends sparks out from the middle in white and the light, fading as they go', () => {
    const near = burstPixels(0, GOLD, 0).over;
    const far = burstPixels(8 * FRAME_MS, GOLD, 0).over;
    const reach = (px: readonly GearPixel[]) => Math.max(...px.map((p) => Math.hypot(p.x - 15.5, p.y - 15.5)));
    expect(reach(far)).toBeGreaterThan(reach(near));
    expect(far).toHaveLength(BURST_SPARKS);
    expect(Math.max(...far.map((p) => p.a))).toBeLessThan(Math.max(...near.map((p) => p.a)));
    expect(new Set(near.map((p) => p.c))).toEqual(new Set([WHITE, GOLD]));
  });

  it('turns its sparks by the phase', () => {
    expect(burstPixels(4 * FRAME_MS, GOLD, 0).over).not.toEqual(burstPixels(4 * FRAME_MS, GOLD, 0.03).over);
  });

  it('draws nothing before it starts or once it is over', () => {
    expect(burstPixels(-1, GOLD, 0)).toEqual({ piece: [], over: [] });
    expect(burstPixels(BURST_FRAMES * FRAME_MS, GOLD, 0)).toEqual({ piece: [], over: [] });
  });
});

describe(pieceMove.name, () => {
  it('gives the five moving pieces their movement at every level they have one', () => {
    for (let level = 0; level <= 10; level++) {
      expect(pieceMove('back', level)?.k).toBe(level === 10 ? 'flap' : 'stir');
      expect(pieceMove('mount', level)?.k).toBe('nod');
      expect(pieceMove('necklace', level)?.k).toBe('swing');
      expect(pieceMove('charm', level)?.k).toBe('swing');
      expect(pieceMove('head', level)?.k).toBe(level >= 4 ? 'sway' : undefined);
    }
  });

  it('keeps the other pieces still', () => {
    for (const p of ['weapon', 'shield', 'ring', 'shoulder', 'chest', 'gauntlets', 'belt', 'legs', 'feet'])
      for (let level = 0; level <= 10; level++) expect(pieceMove(p, level)).toBeNull();
  });
});

describe(moveShare.name, () => {
  it('runs from 0 to 1 over MOVE_MS once in MOVE_EVERY_MS, half a cycle from the glints', () => {
    const start = MOVE_EVERY_MS / 2;
    expect(moveShare(start, 0)).toBe(0);
    expect(moveShare(start + MOVE_MS / 2, 0)).toBeCloseTo(0.5);
    expect(moveShare(start + MOVE_MS, 0)).toBeNull();
    expect(moveShare(0, 0)).toBeNull();
  });
});

describe(moveOffset.name, () => {
  const peak = (k: string, s: number, x: number, y: number, spot = { k, x: 16, y: 8, n: 20 }) => moveOffset(spot, s, x, y);

  it('stirs a cape across below its collar, the hem furthest, the collar not at all', () => {
    expect(peak('stir', 0.3, 16, 8)).toEqual([0, 0]);
    expect(peak('stir', 0.3, 16, 2)).toEqual([0, 0]);
    const most = (y: number) => Math.max(...Array.from({ length: 50 }, (_, i) => Math.abs(peak('stir', i / 50, 16, y)[0])));
    expect(most(28)).toBe(2);
    expect(most(10)).toBeLessThan(most(28));
  });

  it('sways a plume across above its base', () => {
    expect(peak('sway', 0.3, 16, 9)).toEqual([0, 0]);
    expect([0.1, 0.2, 0.3, 0.6, 0.7, 0.8].some((s) => peak('sway', s, 16, 0)[0] !== 0)).toBe(true);
  });

  it('swings a pendant one way then the other, the chain held at the top', () => {
    expect(peak('swing', 0.25, 16, 28)).toEqual([1, 0]);
    expect(peak('swing', 0.75, 16, 28)).toEqual([-1, 0]);
    expect(peak('swing', 0.25, 16, 4)).toEqual([0, 0]);
  });

  it('lifts wings from their root, the tips most', () => {
    expect(peak('flap', 0.5, 16, 5)).toEqual([0, 0]);
    const wings = { k: 'flap', x: 16, y: 10, n: 14 };
    expect(peak('flap', 0.5, 30, 5, wings)).toEqual([0, -2]);
    expect(peak('flap', 0.5, 2, 5, wings)).toEqual([0, -2]);
    expect(peak('flap', 0.5, 23, 5, wings)).toEqual([0, -1]);
  });

  it('nods a head at the muzzle, the neck still', () => {
    expect(peak('nod', 0.5, 4, 20)).toEqual([0, -1]);
    expect(peak('nod', 0.5, 20, 20)).toEqual([0, 0]);
  });

  it('holds still at the start and end of a movement', () => {
    for (const k of ['stir', 'sway', 'swing', 'flap', 'nod']) {
      expect(peak(k, 0, 4, 28)).toEqual([0, 0]);
      expect(peak(k, 1, 4, 28)).toEqual([0, 0]);
    }
  });
});

describe(movePixels.name, () => {
  /** A sprite with one pixel set at (x, y), `v` in each channel. */
  const one = (x: number, y: number, v = 200) => {
    const d = new Uint8ClampedArray(32 * 32 * 4);
    d.fill(v, (y * 32 + x) * 4, (y * 32 + x) * 4 + 4);
    return d;
  };
  const where = (d: Uint8ClampedArray) => {
    for (let i = 3; i < d.length; i += 4) if (d[i]) return [((i - 3) / 4) % 32, Math.floor((i - 3) / 4 / 32)];
    return null;
  };

  it('moves a pixel as its offset says', () => {
    const swing = { k: 'swing', x: 16, y: 4, n: 24 };
    expect(where(movePixels(one(16, 28), swing, 0.25))).toEqual([17, 28]);
    expect(where(movePixels(one(16, 28), swing, 0))).toEqual([16, 28]);
  });

  it('drops a pixel moved off the sprite', () => {
    expect(where(movePixels(one(31, 28), { k: 'swing', x: 16, y: 4, n: 24 }, 0.25))).toBeNull();
  });
});

describe(movedPiece.name, () => {
  it('lays the moved part over its bare twin', () => {
    const bare = new Uint8ClampedArray(32 * 32 * 4).fill(10);
    const part = new Uint8ClampedArray(32 * 32 * 4);
    part.set([1, 2, 3, 255], (2 * 32 + 16) * 4);
    const out = movedPiece(bare, part, { k: 'sway', x: 16, y: 9, n: 8 }, 0);
    expect([...out.slice((2 * 32 + 16) * 4, (2 * 32 + 16) * 4 + 4)]).toEqual([1, 2, 3, 255]);
    expect([...out.slice(0, 4)]).toEqual([10, 10, 10, 10]);
  });

  it('moves the whole piece when it has no twin', () => {
    const part = new Uint8ClampedArray(32 * 32 * 4).fill(7);
    expect(movedPiece(null, part, { k: 'nod', x: 20, y: 13, n: 16 }, 0)).toEqual(movePixels(part, { k: 'nod', x: 20, y: 13, n: 16 }, 0));
  });
});

describe(pixelData.name, () => {
  it('writes each pixel’s colour and opacity at its place', () => {
    const data = pixelData([{ x: 1, y: 0, c: [10, 20, 30], a: 40 }]);
    expect([...data.slice(4, 8)]).toEqual([10, 20, 30, 40]);
    expect(data.length).toBe(32 * 32 * 4);
  });

  it('leaves out pixels off the sprite, and lets a later pixel win', () => {
    const data = pixelData([
      { x: -1, y: 0, c: WHITE, a: 255 },
      { x: 0, y: 0, c: [1, 1, 1], a: 1 },
      { x: 0, y: 0, c: [2, 2, 2], a: 2 },
    ]);
    expect([...data.slice(0, 4)]).toEqual([2, 2, 2, 2]);
    expect(data.reduce((s, v) => s + v, 0)).toBe(8);
  });
});
