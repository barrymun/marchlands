import { GEAR_PIECE_IDS, SpotKind } from '@marchlands/core';

import {
  BLADE_ALPHA,
  BURST_FLASH,
  BURST_FRAMES,
  BURST_SPARKS,
  FRAME_MS,
  GEAR_LIGHT,
  GEAR_SIZE,
  GEAR_SPOTS,
  GLINT_ARMS,
  GLINT_EVERY_MS,
  GLINT_FROM,
  GOLD,
  HALO_FROM,
  MOVE_EVERY_MS,
  MOVE_KINDS,
  MOVE_MS,
  MOVE_PX,
  PULSE_MS,
  STAR_EVERY_MS,
  STAR_FRAMES,
  SWEEP_EVERY_MS,
  SWEEP_FROM,
  SWEEP_MS,
  WHITE,
} from '@/components/hero-gear/gear-icon/constants';
import type { GearFrame, GearPixel } from '@/components/hero-gear/gear-icon/types';
import { GLOW_RGB } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/constants';
import { glowAlpha } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import type { Rgb, Spot } from '@/components/iso-anim/types';
import { gearArtFile, gearBackdropFile } from '@/lib/game-art';

/** Where a piece's effects start in their cycles, as a share of one: the 14 pieces spread evenly, so they never flash in step. */
export function piecePhase(piece: string): number {
  const i = (GEAR_PIECE_IDS as readonly string[]).indexOf(piece);
  return i < 0 ? 0 : i / GEAR_PIECE_IDS.length;
}

/** How far into its cycle (ms) an effect repeating every `every` ms is at `t`, started `phase` (a share of one) ahead. */
export function cycleAt(t: number, every: number, phase: number): number {
  return ((((t / every + phase) % 1) + 1) % 1) * every;
}

/** A slow pulse, 0 to 1 and back over PULSE_MS, started `phase` (a share of one) ahead. */
export function pulseAt(t: number, phase: number): number {
  return 0.5 + 0.5 * Math.sin(2 * Math.PI * (t / PULSE_MS + phase));
}

/** A stone flaring into a small star at (x, y), frame `f` of GLINT_ARMS: a white point with arms, the outer pixel of a long arm fainter. */
export function glintPixels(x: number, y: number, f: number): GearPixel[] {
  const step = GLINT_ARMS[f];
  if (!step) return [];
  const [arms, a] = step;
  const px: GearPixel[] = [{ x, y, c: WHITE, a }];
  for (let i = 1; i <= arms; i++)
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const)
      px.push({ x: x + dx * i, y: y + dy * i, c: WHITE, a: i > 1 ? Math.round(a / 2) : a });
  return px;
}

/** Light round a point (cx, cy) out to `reach` pixels in colour `c`: `a` at the middle, fading to nothing at the edge. */
export function haloPixels(cx: number, cy: number, reach: number, c: Rgb, a: number): GearPixel[] {
  const px: GearPixel[] = [];
  for (let y = Math.floor(cy - reach); y <= Math.ceil(cy + reach); y++)
    for (let x = Math.floor(cx - reach); x <= Math.ceil(cx + reach); x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      const alpha = Math.round(a * (1 - d / reach));
      if (d < reach && alpha > 0) px.push({ x, y, c, a: alpha });
    }
  return px;
}

/** Where a stone's light comes from: the middle of the stone whose glint is at spot `s` (`n` its radius; a point of light is its own middle). */
export function stoneMiddle(s: Spot): { x: number; y: number; r: number } {
  if (s.k === SpotKind.SHINE) return { x: s.x + 0.5, y: s.y + 0.5, r: 0.5 };
  const r = s.n ?? 1;
  // a stone of radius 1 is two by two, its glint the top left; a larger one has its glint half its radius up and left
  const g = r <= 1 ? 0.5 : Math.round(r / 2) + 0.5;
  return { x: s.x + g, y: s.y + g, r };
}

/** A glowing blade's light: from the guard at spot `s` up the diagonal, `n` long and `m` its half-width, in colour `c` at `a`. */
export function bladePixels(s: Spot, c: Rgb, a: number): GearPixel[] {
  const px: GearPixel[] = [];
  const [len, half] = [s.n ?? 0, (s.m ?? 1) + 0.5];
  for (let y = 0; y < GEAR_SIZE; y++)
    for (let x = 0; x < GEAR_SIZE; x++) {
      const [dx, dy] = [x + 0.5 - s.x, y + 0.5 - s.y];
      // the sword lies from the bottom left to the top right
      const along = (dx - dy) / Math.SQRT2;
      const across = Math.abs(dx + dy) / Math.SQRT2;
      if (along >= 0 && along <= len && across <= half) px.push({ x, y, c, a });
    }
  return px;
}

/** A glint crossing a piece from the bottom left to the top right, its middle on the line x - y = `p`: a bright line with fainter sides. */
export function sweepPixels(p: number): GearPixel[] {
  const px: GearPixel[] = [];
  for (let y = 0; y < GEAR_SIZE; y++)
    for (let x = 0; x < GEAR_SIZE; x++) {
      const d = Math.abs(x - y - p);
      if (d <= 1.5) px.push({ x, y, c: WHITE, a: d < 0.75 ? 150 : 70 });
    }
  return px;
}

/** A backdrop star of `r` (spot `s`) flaring, frame `f` of STAR_FRAMES: its arms a pixel longer, tipped in level 10's light, with points between them at the height of it. */
export function starPixels(s: Spot, f: number): GearPixel[] {
  if (f < 0 || f >= STAR_FRAMES) return [];
  const r = (s.n ?? 1) + 1;
  const peak = f === 1 || f === 2;
  const px: GearPixel[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    for (let i = 1; i < r; i++) px.push({ x: s.x + dx * i, y: s.y + dy * i, c: WHITE, a: 255 });
    px.push({ x: s.x + dx * r, y: s.y + dy * r, c: GEAR_LIGHT[10] ?? WHITE, a: peak ? 255 : 150 });
  }
  if (peak)
    for (const [dx, dy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const)
      px.push({ x: s.x + dx, y: s.y + dy, c: WHITE, a: 140 });
  return px;
}

/**
 * A burst `ms` after it started (a star added, a level gained): the piece flashes white for the first few frames, and
 * sparks in white and `light` fly out from its middle and fade over BURST_FRAMES; nothing once it's over, or before it
 * starts. The sparks go out at even angles, turned by `phase` so neighbouring pieces' differ.
 */
export function burstPixels(ms: number, light: Rgb, phase: number): Pick<GearFrame, 'piece' | 'over'> {
  const f = Math.floor(ms / FRAME_MS);
  if (ms < 0 || f >= BURST_FRAMES) return { piece: [], over: [] };
  const piece: GearPixel[] = [];
  const flash = BURST_FLASH[f];
  if (flash) for (let y = 0; y < GEAR_SIZE; y++) for (let x = 0; x < GEAR_SIZE; x++) piece.push({ x, y, c: WHITE, a: flash });
  const over: GearPixel[] = [];
  const a = Math.round(255 * (1 - f / BURST_FRAMES));
  for (let k = 0; k < BURST_SPARKS; k++) {
    const angle = 2 * Math.PI * (k / BURST_SPARKS + phase);
    const r = 3 + f * (1.1 + (k % 3) * 0.35);
    const [x, y] = [Math.round(GEAR_SIZE / 2 - 0.5 + Math.cos(angle) * r), Math.round(GEAR_SIZE / 2 - 0.5 + Math.sin(angle) * r)];
    const c = k % 2 ? light : WHITE;
    over.push({ x, y, c, a });
    // every third spark a small star while it's young
    if (k % 3 === 0 && f < 5)
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const)
        over.push({ x: x + dx, y: y + dy, c, a: Math.round(a / 2) });
  }
  return { piece, over };
}

/** The spots of a gear sprite (`gear/<file>`), none when it has none. */
function spotsOf(file: string): readonly Spot[] {
  return GEAR_SPOTS[`gear/${file}`] ?? [];
}

/** A piece's own movement at a gear level (docs/features/gear-animations.md): the spot at its pivot, whose kind says how it moves; null for a piece that holds still. */
export function pieceMove(piece: string, level: number): Spot | null {
  return spotsOf(gearArtFile(piece, level)).find((s) => MOVE_KINDS.has(s.k)) ?? null;
}

/** How far through its own movement a piece is at `t`, 0 to 1, or null between movements: one in MOVE_EVERY_MS, half a cycle from its glints. */
export function moveShare(t: number, phase: number): number | null {
  const at = cycleAt(t, MOVE_EVERY_MS, phase + 0.5);
  return at < MOVE_MS ? at / MOVE_MS : null;
}

/** A whole number of pixels, never -0. */
const px = (v: number) => Math.round(v) || 0;

/** How far from the pivot a pixel is along the movement, 0 at the pivot to 1 at its reach (`n`). */
const reach = (d: number, n: number | undefined) => Math.min(1, Math.max(0, d / (n ?? 1)));

/**
 * Where the pixel at (x, y) is drawn from at `s` (0 to 1) through a piece's movement (`move`, its pivot spot): a whole
 * row shifted across for a cape stirring below its collar, a plume swaying above its base and a pendant swinging below
 * its chain; a whole column lifted for wings flapping out from their root and a head nodding at its muzzle. Returns the
 * shift, so the pixel comes from (x - dx, y - dy). A swinging pendant moves whole below where it hangs, so it never kinks.
 */
export function moveOffset(move: Spot, s: number, x: number, y: number): [dx: number, dy: number] {
  const a = MOVE_PX[move.k] ?? 1;
  const rise = Math.sin(Math.PI * s);
  switch (move.k) {
    case SpotKind.STIR: {
      if (y <= move.y) return [0, 0];
      const f = reach(y - move.y, move.n);
      // a wave down the cloth, the hem behind the top
      return [px(a * f * rise * Math.sin(2 * Math.PI * 2 * s - f * 2.5)), 0];
    }
    case SpotKind.SWAY: {
      if (y >= move.y) return [0, 0];
      const f = reach(move.y - y, move.n);
      return [px(a * f * rise * Math.sin(2 * Math.PI * 2 * s - f * 2)), 0];
    }
    case SpotKind.SWING:
      // a pendant is rigid: everything below where it hangs moves together, the chain or hook taking up the step
      return y <= move.y ? [0, 0] : [px(a * Math.sin(2 * Math.PI * s)), 0];
    case SpotKind.FLAP:
      return [0, px(-a * reach(Math.abs(x - move.x), move.n) * rise)];
    case SpotKind.NOD:
      return x >= move.x ? [0, 0] : [0, px(-a * reach(move.x - x, move.n) * rise)];
    default:
      return [0, 0];
  }
}

/** A sprite's pixels (32×32 RGBA) at `s` through its movement: each pixel taken from where `moveOffset` says; nothing from off the sprite. */
export function movePixels(src: Uint8ClampedArray, move: Spot, s: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(GEAR_SIZE * GEAR_SIZE * 4);
  for (let y = 0; y < GEAR_SIZE; y++)
    for (let x = 0; x < GEAR_SIZE; x++) {
      const [dx, dy] = moveOffset(move, s, x, y);
      const [sx, sy] = [x - dx, y - dy];
      if (sx < 0 || sy < 0 || sx >= GEAR_SIZE || sy >= GEAR_SIZE) continue;
      const i = (sy * GEAR_SIZE + sx) * 4;
      out.set(src.subarray(i, i + 4), (y * GEAR_SIZE + x) * 4);
    }
  return out;
}

/** A moving piece at `s` through its movement: its `part` moved, over its `bare` twin when only the part moves (the plume), or alone when it moves whole. */
export function movedPiece(bare: Uint8ClampedArray | null, part: Uint8ClampedArray, move: Spot, s: number): Uint8ClampedArray<ArrayBuffer> {
  const moved = movePixels(part, move, s);
  if (!bare) return moved;
  const out = new Uint8ClampedArray(bare);
  for (let i = 0; i < out.length; i += 4) if ((moved[i + 3] ?? 0) > 0) out.set(moved.subarray(i, i + 4), i);
  return out;
}

/** Whether a piece's icon at a gear level moves at all (docs/features/gear-animations.md): a piece with a movement of its own at every level; otherwise nothing below level 3, nor a piece with nothing to light. */
export function hasMotion(piece: string, level: number): boolean {
  if (pieceMove(piece, level)) return true;
  if (level < GLINT_FROM) return false;
  return level >= SWEEP_FROM || spotsOf(gearArtFile(piece, level)).length > 0 || spotsOf(gearBackdropFile(level)).length > 0;
}

/**
 * A gear icon's movement at `t` (ms, the page's animation clock), by level as the art grows: from 3 its stones flare
 * now and then; from 6 they glow, as do glowing blades, pulsing slowly in the level's colour; from 9 a glint crosses the
 * metal now and then; at 10 the stones glow in the figure's light and time (`glowAlpha`) and the backdrop's stars
 * flare. Each piece starts its effects at its own moment (`piecePhase`), each stone and star a little apart. With
 * `burst` (when one started, on the same clock) a burst plays over it all (`burstPixels`), at any level.
 */
export function gearFrame(piece: string, level: number, t: number, burst?: number): GearFrame {
  const frame: GearFrame = { behind: [], piece: [], over: [] };
  const phase = piecePhase(piece);
  const light = GEAR_LIGHT[Math.min(level, 10)] ?? GOLD;
  // a burst plays at any level, over the rest
  const withBurst = (f: GearFrame): GearFrame => {
    if (burst == null) return f;
    const b = burstPixels(t - burst, light, phase);
    return { behind: f.behind, piece: [...f.piece, ...b.piece], over: [...f.over, ...b.over] };
  };
  if (level < GLINT_FROM) return withBurst(frame);
  const top = level >= 10;
  const glow = top ? Math.round(255 * glowAlpha(t)) : Math.round(255 * (0.15 + 0.3 * pulseAt(t, phase)));
  // each stone's glint a little apart from the last, counted among the glints alone
  let glint = 0;
  spotsOf(gearArtFile(piece, level)).forEach((s) => {
    if (s.k === SpotKind.BLADE) {
      const a = Math.round(BLADE_ALPHA * pulseAt(t, phase));
      if (a > 0) frame.piece.push(...bladePixels(s, light, a));
      return;
    }
    if (s.k !== SpotKind.GEM && s.k !== SpotKind.SHINE) return;
    if (level >= HALO_FROM) {
      const m = stoneMiddle(s);
      frame.over.push(...haloPixels(m.x, m.y, m.r + 1.5, top ? GLOW_RGB : light, glow));
    }
    const f = Math.floor(cycleAt(t, GLINT_EVERY_MS, phase + glint++ * 0.37) / FRAME_MS);
    frame.over.push(...glintPixels(s.x, s.y, f));
  });
  if (level >= SWEEP_FROM) {
    const s = cycleAt(t, SWEEP_EVERY_MS, phase);
    if (s < SWEEP_MS) frame.piece.push(...sweepPixels(-GEAR_SIZE - 2 + ((GEAR_SIZE + 2) * 2 * s) / SWEEP_MS));
  }
  spotsOf(gearBackdropFile(level)).forEach((s, i) => {
    if (s.k === SpotKind.STAR) frame.behind.push(...starPixels(s, Math.floor(cycleAt(t, STAR_EVERY_MS, phase + i * 0.29) / FRAME_MS)));
  });
  return withBurst(frame);
}

/** A layer's pixels as a 32×32 image's RGBA bytes; a pixel off the sprite is left out, and a later one over the same pixel wins. */
export function pixelData(px: readonly GearPixel[]): Uint8ClampedArray<ArrayBuffer> {
  const data = new Uint8ClampedArray(GEAR_SIZE * GEAR_SIZE * 4);
  for (const { x, y, c, a } of px) if (x >= 0 && y >= 0 && x < GEAR_SIZE && y < GEAR_SIZE) data.set([...c, a], (y * GEAR_SIZE + x) * 4);
  return data;
}
