import { describe, expect, it, vi } from 'vitest';

import { Sex } from '@marchlands/core';

import {
  BREATH_MS,
  FIGURE_ART,
  FIGURE_SIZE,
  FigureMotion,
  GLOW_MS,
  SWAY_MS,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/constants';
import {
  breathLift,
  drawFigure,
  figureBody,
  figureLayers,
  glowAlpha,
  swayShift,
  wornLevel,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import { FIGURE_HAIR_COLOURS, FIGURE_HAIR_STYLES, FIGURE_SKIN_TONES } from '@/lib/game-art';

describe(figureBody.name, () => {
  it('gives the same hero the same body every time', () => {
    expect(figureBody(42, Sex.FEMALE)).toEqual(figureBody(42, Sex.FEMALE));
  });

  it("picks a man's or a woman's hairstyle by sex, and every tone, style and colour across heroes", () => {
    const men = Array.from({ length: 200 }, (_, id) => figureBody(id, Sex.MALE));
    const women = Array.from({ length: 200 }, (_, id) => figureBody(id, Sex.FEMALE));
    expect(new Set(men.map((b) => b.style))).toEqual(new Set(FIGURE_HAIR_STYLES[Sex.MALE]));
    expect(new Set(women.map((b) => b.style))).toEqual(new Set(FIGURE_HAIR_STYLES[Sex.FEMALE]));
    expect(new Set(men.map((b) => b.tone))).toEqual(new Set(FIGURE_SKIN_TONES));
    expect(new Set(women.map((b) => b.hair))).toEqual(new Set(FIGURE_HAIR_COLOURS));
  });

  it('keeps the sex it was given', () => {
    expect(figureBody(7, Sex.MALE).sex).toBe(Sex.MALE);
  });
});

describe(wornLevel.name, () => {
  it("wears what the hero's level can use, up to the research", () => {
    expect(wornLevel(25, 10)).toBe(2);
    expect(wornLevel(100, 10)).toBe(10);
  });

  it('wears no more than the player has researched, and level 0 below hero level 10', () => {
    expect(wornLevel(80, 3)).toBe(3);
    expect(wornLevel(9, 10)).toBe(0);
    expect(wornLevel(50, 0)).toBe(0);
  });
});

describe(figureLayers.name, () => {
  const body = figureBody(3, Sex.FEMALE);

  it('stacks the cape, legs, skin, upper body, hair and helm, back to front', () => {
    expect(figureLayers(body, 4).map((l) => l.file)).toEqual([
      'cape-4.png',
      'legs-f-4.png',
      `skin-f-${body.tone}.png`,
      'upper-f-4.png',
      `hair-${body.style}-${body.hair}.png`,
      'helm-4.png',
    ]);
  });

  it('stirs the cape, keeps the legs still, breathes the rest, and lights the upper body', () => {
    expect(figureLayers(body, 10).map((l) => [l.motion, l.glows])).toEqual([
      [FigureMotion.SWAY, false],
      [FigureMotion.STILL, false],
      [FigureMotion.BREATH, false],
      [FigureMotion.BREATH, true],
      [FigureMotion.BREATH, false],
      [FigureMotion.BREATH, false],
    ]);
  });

  it('names only layers that are drawn, for every level, sex and body', () => {
    for (const sex of [Sex.MALE, Sex.FEMALE])
      for (let id = 0; id < 40; id++)
        for (let level = 0; level <= 10; level++) for (const l of figureLayers(figureBody(id, sex), level)) expect(FIGURE_ART[l.file], l.file).toBeTruthy();
  });
});

describe(breathLift.name, () => {
  it('lifts the body a pixel for part of each breath, and rests it otherwise', () => {
    expect(breathLift(0)).toBe(0);
    expect(breathLift(BREATH_MS * 0.5)).toBe(-1);
    expect(breathLift(BREATH_MS * 0.9)).toBe(0);
    expect(breathLift(BREATH_MS * 1.5)).toBe(-1);
  });

  it('handles times before zero', () => {
    expect(breathLift(-BREATH_MS * 0.5)).toBe(-1);
  });
});

describe(swayShift.name, () => {
  const spot = { y: 34, n: 42 };

  it('leaves the rows above the spot where they are', () => {
    for (let ms = 0; ms < SWAY_MS; ms += 100) expect(swayShift(20, spot, ms)).toBe(0);
  });

  it('moves the hem at most a pixel or so either way, more than the rows near the top', () => {
    const hem = Array.from({ length: 28 }, (_, i) => swayShift(76, spot, (i * SWAY_MS) / 28));
    const top = Array.from({ length: 28 }, (_, i) => swayShift(36, spot, (i * SWAY_MS) / 28));
    expect(Math.max(...hem)).toBe(1);
    expect(Math.min(...hem)).toBe(-1);
    expect(top.every((d) => d === 0)).toBe(true);
  });
});

describe(glowAlpha.name, () => {
  it('pulses between a quarter and six tenths', () => {
    const all = Array.from({ length: 40 }, (_, i) => glowAlpha((i * GLOW_MS) / 40));
    expect(Math.min(...all)).toBeCloseTo(0.25, 2);
    expect(Math.max(...all)).toBeCloseTo(0.6, 2);
  });
});

describe(drawFigure.name, () => {
  const fakeCtx = () => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
  });
  const img = {} as CanvasImageSource;
  const layers = (level: number) => figureLayers(figureBody(1, Sex.MALE), level).map((layer) => ({ layer, img }));

  it('draws every layer once, still, when there is no time (reduced motion)', () => {
    const ctx = fakeCtx();
    drawFigure(ctx, layers(10), null);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, FIGURE_SIZE, FIGURE_SIZE);
    expect(ctx.drawImage.mock.calls).toEqual(Array.from({ length: 6 }, () => [img, 0, 0]));
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it('draws the cape row by row below its spot, and lifts the breathing layers mid-breath', () => {
    const ctx = fakeCtx();
    drawFigure(ctx, layers(3), BREATH_MS * 0.5);
    // the cape: the rows above the spot at once, then one call a row
    const capeCalls = ctx.drawImage.mock.calls.filter((c) => c.length === 9);
    expect(capeCalls.length).toBe(1 + FIGURE_SIZE - 34);
    const lifted = ctx.drawImage.mock.calls.filter((c) => c.length === 3);
    expect(lifted).toEqual([
      [img, 0, 0],
      [img, 0, -1],
      [img, 0, -1],
      [img, 0, -1],
      [img, 0, -1],
    ]);
    // no stones glow below level 10
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("lights round level 10's stones, adding to what is drawn", () => {
    const ctx = fakeCtx();
    drawFigure(ctx, layers(10), 0);
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
    expect(ctx.globalCompositeOperation).toBe('lighter');
  });
});
