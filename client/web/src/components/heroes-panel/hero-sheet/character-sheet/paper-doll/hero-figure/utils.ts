import { gearTier, Sex, SpotKind } from '@marchlands/core';

import {
  BREATH_MS,
  BREATH_UP,
  FIGURE_SIZE,
  FIGURE_SPOTS,
  FigureMotion,
  GLOW_MS,
  GLOW_RGB,
  SWAY_MS,
  SWAY_PX,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/constants';
import type { FigureBody, FigureContext, FigureLayer } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/types';
import type { Spot } from '@/components/iso-anim/types';
import {
  FIGURE_HAIR_COLOURS,
  FIGURE_HAIR_STYLES,
  FIGURE_SKIN_TONES,
  figureCapeFile,
  FigureHairColour,
  figureHairFile,
  figureHelmFile,
  figureLegsFile,
  figureSkinFile,
  FigureSkinTone,
  figureUpperFile,
} from '@/lib/game-art';

/** A hero id scrambled, so neighbouring ids look unalike. */
function mix(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A hero's body, picked from its id so a hero always looks the same. */
export function figureBody(id: number, sex: Sex): FigureBody {
  const h = mix(id);
  const styles = FIGURE_HAIR_STYLES[sex];
  return {
    sex,
    tone: FIGURE_SKIN_TONES[h % FIGURE_SKIN_TONES.length] ?? FigureSkinTone.FAIR,
    style: styles[(h >>> 4) % styles.length] ?? styles[0],
    hair: FIGURE_HAIR_COLOURS[(h >>> 8) % FIGURE_HAIR_COLOURS.length] ?? FigureHairColour.BROWN,
  };
}

/** The gear level a hero wears: what its level can use (gearTier), no higher than the player has researched. */
export function wornLevel(heroLevel: number, researched: number): number {
  return Math.max(0, Math.min(gearTier(heroLevel), researched));
}

/** The figure's layers, back to front: the cape, the legs, then the skin, upper body, hair and helm, which breathe. */
export function figureLayers(body: FigureBody, level: number): FigureLayer[] {
  return [
    { file: figureCapeFile(level), motion: FigureMotion.SWAY, glows: false },
    { file: figureLegsFile(body.sex, level), motion: FigureMotion.STILL, glows: false },
    { file: figureSkinFile(body.sex, body.tone), motion: FigureMotion.BREATH, glows: false },
    { file: figureUpperFile(body.sex, level), motion: FigureMotion.BREATH, glows: true },
    { file: figureHairFile(body.style, body.hair), motion: FigureMotion.BREATH, glows: false },
    { file: figureHelmFile(level), motion: FigureMotion.BREATH, glows: false },
  ];
}

/** How far the body is lifted at `ms`: a pixel up for part of each breath. */
export function breathLift(ms: number): number {
  const t = (((ms % BREATH_MS) + BREATH_MS) % BREATH_MS) / BREATH_MS;
  return t >= BREATH_UP[0] && t < BREATH_UP[1] ? -1 : 0;
}

/** How many pixels a row of the cape moves across at `ms`: none above its `sway` spot, more towards the hem, in a wave. */
export function swayShift(row: number, spot: Pick<Spot, 'y' | 'n'>, ms: number): number {
  const f = Math.min(1, Math.max(0, (row - spot.y) / (spot.n ?? 1)));
  return Math.round(SWAY_PX * f * Math.sin((2 * Math.PI * ms) / SWAY_MS - f * 2.5)) || 0;
}

/** How bright the stones glow at `ms`: from a quarter to six tenths, and back. */
export function glowAlpha(ms: number): number {
  return 0.25 + 0.35 * (0.5 + 0.5 * Math.sin((2 * Math.PI * ms) / GLOW_MS));
}

/**
 * Draw the figure at `ms` (null: still, as with reduced motion): the layers back to front, the cape's rows shifted as
 * it stirs, the breathing layers lifted, and a pulse of light round each stone of a glowing layer.
 */
export function drawFigure(ctx: FigureContext, layers: readonly { layer: FigureLayer; img: CanvasImageSource }[], ms: number | null) {
  ctx.clearRect(0, 0, FIGURE_SIZE, FIGURE_SIZE);
  const lift = ms == null ? 0 : breathLift(ms);
  for (const { layer, img } of layers) {
    const spots = FIGURE_SPOTS[`figure/${layer.file}`] ?? [];
    const sway = spots.find((s) => s.k === SpotKind.SWAY);
    if (ms != null && layer.motion === FigureMotion.SWAY && sway) {
      ctx.drawImage(img, 0, 0, FIGURE_SIZE, sway.y, 0, 0, FIGURE_SIZE, sway.y);
      for (let row = sway.y; row < FIGURE_SIZE; row++) ctx.drawImage(img, 0, row, FIGURE_SIZE, 1, swayShift(row, sway, ms), row, FIGURE_SIZE, 1);
    } else ctx.drawImage(img, 0, layer.motion === FigureMotion.BREATH ? lift : 0);
    if (ms == null || !layer.glows) continue;
    const a = glowAlpha(ms);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of spots) {
      if (s.k !== SpotKind.STONE) continue;
      const r = Math.ceil(s.n ?? 1) + 1;
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d > r) continue;
          ctx.fillStyle = `rgba(${GLOW_RGB.join(', ')}, ${(a * (1 - d / (r + 1))).toFixed(3)})`;
          ctx.fillRect(s.x + dx, s.y + dy + (layer.motion === FigureMotion.BREATH ? lift : 0), 1, 1);
        }
    }
    ctx.restore();
  }
}
