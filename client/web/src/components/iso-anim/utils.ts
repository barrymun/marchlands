import { BuildingType, stateOf } from '@marchlands/core';

import {
  AFTERMATH_FIRES,
  AFTERMATH_MS,
  BLAST_EVERY_S,
  BLAST_FRAMES,
  BUILD_FRAMES,
  C,
  CLOTHES,
  DUST_FRAMES,
  MOVING_SPOTS,
  ROUTE_STEPS,
  SAIL_FRAMES,
  SIDE_COLOURS,
  SMOKE_FRAMES,
  SMOKE_PUFFS,
  SPARKLE_FRAMES,
  SPARKLE_MS,
  SPOTS,
  WALK_SPEED,
  WHEEL_FRAMES,
} from '@/components/iso-anim/constants';
import type { Animated, Frame, GridSpot, Marching, Rgb, Side, Spot, Streets, TownState } from '@/components/iso-anim/types';
import type { Overlay, Particle, PixelArt, Sky, Weather } from '@/components/iso-viewport/types';
import { spriteBox } from '@/components/iso-viewport/utils';
import { pairs } from '@/lib/arrays';

/** A stable 32-bit hash of a string (FNV-1a), to seed an animation from what it belongs to. */
export function hash(s: string): number {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** A seeded random number generator (mulberry32): the same seed gives the same numbers, in [0, 1). */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sets a pixel of a frame being made: rounded to the pixel, ignored outside the frame, `a` its opacity (0-255). */
type Put = (x: number, y: number, c: Rgb, a?: number) => void;

/** Frames made so far, by id: each is made once. */
const made = new Map<string, PixelArt>();

/**
 * A frame made in code: `w` × `h` pixels drawn by `draw`, kept by `id` so it is made only once. With `outline`, every
 * drawn pixel next to an empty one turns the outline colour, as the sprites are finished (tools/art/pixel.ts).
 */
export function pixelArt(id: string, w: number, h: number, draw: (put: Put) => void, outline = false): PixelArt {
  const hit = made.get(id);
  if (hit) return hit;
  const data = new Uint8ClampedArray(w * h * 4);
  draw((x, y, [r, g, b], a = 255) => {
    const [px, py] = [Math.round(x), Math.round(y)];
    if (px < 0 || py < 0 || px >= w || py >= h) return;
    const i = (py * w + px) * 4;
    data.set([r, g, b, a], i);
  });
  if (outline) {
    const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (data[(y * w + x) * 4 + 3] ?? 0) > 0;
    const edge: number[] = [];
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) if (filled(x, y) && [-1, 1].some((d) => !filled(x + d, y) || !filled(x, y + d))) edge.push((y * w + x) * 4);
    for (const i of edge) data.set([...C.outline, data[i + 3] ?? 255], i);
  }
  const art = { id, w, h, data };
  made.set(id, art);
  return art;
}

/**
 * A plume of smoke rising from a chimney: puffs that grow, drift and fade as they climb, frame `i` of SMOKE_FRAMES.
 * `variant` sways it differently for each chimney. Anchored at the bottom, where the chimney's own wisp starts.
 */
export function smokeFrame(i: number, variant: number): Frame {
  const v = variant % 4;
  const art = pixelArt(`smoke:${i}:${v}`, 10, 18, (put) => {
    for (let j = 0; j < SMOKE_PUFFS; j++) {
      const p = (i / SMOKE_FRAMES + j / SMOKE_PUFFS) % 1;
      const y = 15 - p * 14;
      const x = 3 + Math.sin(p * 3 + v) * 1.2 + p * 2.5;
      const a = Math.round(235 * (1 - p * 0.85));
      // a puff: a pixel as it leaves the chimney, then a 2×2 cloud with a darker underside, then a wider one
      const size = p < 0.15 ? 1 : p < 0.55 ? 2 : 3;
      for (let dy = 0; dy < size; dy++)
        for (let dx = 0; dx < size; dx++) if (size < 3 || dx !== dy || dx === 1) put(x + dx, y - dy, dy === 0 && size > 1 ? C.smokeDark : C.smoke, a);
    }
  });
  return { art, ax: 3, ay: 17 };
}

/** Flames `h` pixels high flickering: frame `i` (any number, each a different flicker). Anchored at their base. */
export function fireFrame(i: number, h: number): Frame {
  const n = Math.max(2, Math.round(h));
  const half = Math.ceil(n / 2) + 1;
  const w = half * 2 + 1;
  const art = pixelArt(`fire:${i % 6}:${n}`, w, n + 3, (put) => {
    const rand = seeded(hash(`fire${i % 6}:${n}`));
    const top = n + Math.round(rand() * 2) - 1;
    for (let k = 0; k <= top; k++) {
      const spread = Math.max(0, Math.floor((top - k) / 2.2 + (rand() - 0.5)));
      for (let dx = -spread; dx <= spread; dx++) put(half + dx, n + 2 - k, Math.abs(dx) < spread || k > top - 2 ? C.fireHi : C.fire);
    }
    if (rand() > 0.4) put(half + Math.round((rand() - 0.5) * 3), n + 1 - top - 2, C.fire, 200);
  });
  return { art, ax: half, ay: n + 2, light: true };
}

/**
 * Windmill sails `len` long, turned a quarter over SAIL_FRAMES frames (frame 0 as the still sprite draws them): wooden
 * spars with canvas beside their outer two thirds, finished with an outline. Anchored at the hub.
 */
export function sailsFrame(i: number, len: number): Frame {
  const c = len + 4;
  const art = pixelArt(
    `sails:${i % SAIL_FRAMES}:${len}`,
    c * 2 + 1,
    c * 2 + 1,
    (put) => {
      const turn = ((i % SAIL_FRAMES) / SAIL_FRAMES) * (Math.PI / 2);
      for (let b = 0; b < 4; b++) {
        const a = Math.PI / 4 + turn + (b * Math.PI) / 2;
        const [dx, dy] = [Math.cos(a), Math.sin(a) * 0.8];
        // the canvas trails the spar, on the side away from the way the sails turn
        const [px, py] = [-Math.sin(a), Math.cos(a) * 0.8];
        for (let s = 1; s <= len; s++) {
          if (s > len / 3) for (const off of [1, 2]) put(c + dx * s + px * off, c + dy * s + py * off, C.canvas);
          put(c + dx * s, c + dy * s, C.wood);
        }
      }
      put(c, c, C.logDark);
    },
    true,
  );
  return { art, ax: c, ay: c };
}

/**
 * A water wheel of `r` turned an eighth (its spokes repeat) over WHEEL_FRAMES frames: a dark rim, eight spokes and
 * light paddles, on a south-east face (squashed across as the still sprite draws it). Anchored at the hub.
 */
export function wheelFrame(i: number, r: number): Frame {
  const cx = Math.ceil((r + 1) * 0.6) + 1;
  const cy = Math.ceil(r + 1) + 1;
  const art = pixelArt(`wheel:${i % WHEEL_FRAMES}:${r}`, cx * 2 + 1, cy * 2 + 1, (put) => {
    for (let a = 0; a < 360; a += 3) {
      const rad = (a * Math.PI) / 180;
      for (const rr of [r, r - 1]) put(cx + Math.cos(rad) * rr * 0.6, cy + Math.sin(rad) * rr, C.logDark);
    }
    const turn = ((i % WHEEL_FRAMES) / WHEEL_FRAMES) * 45;
    for (let a = 0; a < 360; a += 45) {
      const rad = ((a + turn) * Math.PI) / 180;
      for (let s = 0; s <= r - 1; s++) put(cx + Math.cos(rad) * s * 0.6, cy + Math.sin(rad) * s, C.wood);
      put(cx + Math.cos(rad) * (r + 1) * 0.6, cy + Math.sin(rad) * (r + 1), C.logEnd);
    }
    put(cx, cy, C.logEnd);
  });
  return { art, ax: cx, ay: cy };
}

/** A banner's tip flicking out in the wind, frame `i` of 4 (one still). Anchored at the cloth's top left. */
export function bannerFrame(i: number): Frame {
  const f = i % 4;
  const art = pixelArt(`banner:${f}`, 5, 3, (put) => {
    if (f === 1) put(3, 0, C.banner);
    if (f === 2) {
      put(3, 0, C.banner);
      put(4, 1, C.bannerDark);
    }
    if (f === 3) put(3, 1, C.bannerDark);
  });
  return { art, ax: 0, ay: 0 };
}

/** A furnace window glowing, `h` pixels high, frame `i` of 6 brighter and dimmer. Anchored at its top. */
export function glowFrame(i: number, h: number): Frame {
  const f = i % 6;
  const a = [70, 120, 170, 140, 100, 60][f];
  const art = pixelArt(`glow:${f}:${h}`, 1, Math.max(1, h), (put) => {
    for (let y = 0; y < h; y++) put(0, y, C.fireHi, a);
  });
  return { art, ax: 0, ay: 0, light: true };
}

/** A horse flicking its tail, frame `i` of 6 (the first two flicks). Anchored at the horse's spot (its front feet). */
export function horseTailFrame(i: number): Frame {
  const f = i % 6;
  const art = pixelArt(`tail:${f}`, 1, 3, (put) => {
    if (f === 0) put(0, 1, C.horseDark);
    if (f === 1) {
      put(0, 0, C.horseDark);
      put(0, 1, C.horseDark);
    }
  });
  return { art, ax: -3, ay: 3 };
}

/**
 * A sheep, as the farm's sprite draws it (a white fleece, a dark head at the front, two legs), frame `i` of 8: grazing
 * with its head down most of the time, now and then looking up or stepping. Facing left (as drawn) or right. Anchored
 * at its spot (the front of its legs).
 */
export function sheepFrame(i: number, left: boolean): Frame {
  const f = i % 8;
  const m = left ? 1 : -1;
  const art = pixelArt(`sheep:${f}:${left ? 'l' : 'r'}`, 5, 4, (put) => {
    const x = 2;
    put(x, 1, C.wool);
    put(x + m, 1, C.woolShade);
    // the head: down to the grass while grazing, up on the last two frames
    put(x - m, f >= 6 ? 0 : 2, C.outline);
    if (f >= 6) put(x - m, 1, C.outline);
    // the legs, apart on the odd frames (stepping)
    put(x, 2, C.logDark);
    put(x + m * (f % 2 ? 2 : 1), 2, C.logDark);
  });
  return { art, ax: 2, ay: 2 };
}

/** Dust drifting off a quarry's rock face, frame `i` of DUST_FRAMES. Anchored at the rock's top. */
export function dustFrame(i: number, variant: number): Frame {
  const v = variant % 3;
  const art = pixelArt(`dust:${i % DUST_FRAMES}:${v}`, 16, 12, (put) => {
    for (let j = 0; j < 5; j++) {
      const p = ((i % DUST_FRAMES) / DUST_FRAMES + j / 5) % 1;
      const x = 3 + j * 2 + v + p * 6;
      const y = 10 - p * 8 - (j % 2);
      const a = Math.round(210 * (1 - p));
      // a mote, and a second beside it once it has risen a little: dust spreading as it drifts
      put(x, y, j % 2 ? C.dustDark : C.dustDeep, a);
      if (p > 0.25) put(x + 1, y, C.dustDark, a);
    }
  });
  return { art, ax: 6, ay: 10 };
}

/**
 * A blast at a quarry, frame `i` of BLAST_FRAMES: a flash, rubble thrown out and falling, and a dust cloud that swells
 * and fades. Anchored at the rock's top.
 */
export function blastFrame(i: number): Frame {
  const f = Math.min(i, BLAST_FRAMES - 1);
  const [w, h, cx, cy] = [22, 20, 11, 14];
  const art = pixelArt(`blast:${f}`, w, h, (put) => {
    if (f <= 1) {
      const r = f + 1;
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 1) put(cx + x, cy + y, f === 0 ? C.white : C.fireHi);
    }
    // the dust cloud: grows to a radius of 6 and fades from the middle of the blast on
    if (f >= 1) {
      const r = Math.min(6, 2 + f);
      const a = Math.round(200 * (1 - Math.max(0, f - 4) / (BLAST_FRAMES - 4)));
      for (let y = -r; y <= r; y++)
        for (let x = -r; x <= r; x++) if (x * x + 2 * y * y <= r * r && (x + y + f) % 3 !== 0) put(cx + x, cy - 2 + y, (x + y) % 2 ? C.dust : C.dustDark, a);
    }
    // rubble: eight stones thrown out and falling back
    if (f >= 1 && f <= 7) {
      const rand = seeded(7);
      for (let s = 0; s < 8; s++) {
        const [vx, vy] = [(rand() - 0.5) * 3, -1.5 - rand() * 1.5];
        const t = f;
        put(cx + vx * t, cy + vy * t + 0.25 * t * t, s % 2 ? C.granite : C.graniteDark);
      }
    }
  });
  return { art, ax: cx, ay: cy };
}

/** A tiny person, 3 pixels wide and 6 high: dark hair, a face, clothes of `cloth`, legs apart or together (`stride`). */
function person(put: Put, x: number, y: number, cloth: Rgb, stride: boolean, mirror = false) {
  const m = mirror ? -1 : 1;
  put(x, y, C.hair);
  put(x, y + 1, C.skin);
  for (const dy of [2, 3]) for (const dx of [-1, 0, 1]) put(x + dx * m, y + dy, cloth);
  if (stride) {
    put(x - 1, y + 4, C.outline);
    put(x + 1, y + 5, C.outline);
  } else {
    put(x, y + 4, C.outline);
    put(x, y + 5, C.outline);
  }
}

/**
 * Scaffolding round a building going up, frame `i` of BUILD_FRAMES, for a tile `span` across: poles at the front three
 * corners, planks along the two front faces, two builders swinging hammers, and dust now and then. Anchored at the
 * tile's middle.
 */
export function constructionFrame(i: number, span: number): Frame {
  const f = i % BUILD_FRAMES;
  const s = Math.max(1, span);
  const [hw, hd, h] = [15 * s, 7 * s, 22 * s];
  const [w, ht] = [hw * 2 + 7, h + hd + 6];
  const [cx, cy] = [hw + 3, h + 2];
  const art = pixelArt(`build:${f}:${s}`, w, ht, (put) => {
    const left = [cx - hw, cy] as const;
    const front = [cx, cy + hd] as const;
    const right = [cx + hw, cy] as const;
    for (const [x, y] of [left, front, right]) for (let k = 0; k <= h; k++) put(x, y - k, C.wood);
    for (const level of [0.3, 0.62, 0.95]) {
      const z = Math.round(h * level);
      for (const [[x0, y0], [x1, y1]] of [
        [left, front],
        [front, right],
      ] as const) {
        const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) put(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n - z, C.plank);
      }
    }
    // two builders on the planks, hammering in turn
    const z1 = Math.round(h * 0.62);
    const z2 = Math.round(h * 0.3);
    const b1 = [Math.round(cx - hw / 2), Math.round(cy + hd / 2 - z1 - 6)] as const;
    const b2 = [Math.round(cx + hw / 2), Math.round(cy + hd / 2 - z2 - 6)] as const;
    person(put, b1[0], b1[1], CLOTHES[1], false);
    person(put, b2[0], b2[1], CLOTHES[3], false, true);
    const up1 = f % 4 < 2;
    put(b1[0] + 2, b1[1] + (up1 ? 1 : 3), C.metal);
    put(b2[0] - 2, b2[1] + (up1 ? 3 : 1), C.metal);
    // dust at the foot of the front pole now and then
    if (f >= 5) for (let k = 0; k < f - 3; k++) put(front[0] - 2 + k * 2, front[1] - 1 - (k % 2), C.dust, 160 - (f - 5) * 40);
  });
  return { art, ax: cx, ay: cy };
}

/** A sparkle over a building that has just finished a level, frame `i` of SPARKLE_FRAMES. Anchored at the tile's middle. */
export function sparkleFrame(i: number, span: number): Frame {
  const f = Math.min(i, SPARKLE_FRAMES - 1);
  const s = Math.max(1, span);
  const [w, h] = [36 * s, 44 * s];
  const [cx, cy] = [w / 2, h - 6];
  const art = pixelArt(`sparkle:${f}:${s}`, w, h, (put) => {
    const rand = seeded(11 + s);
    for (let k = 0; k < 14 * s; k++) {
      const [x0, y0] = [(rand() - 0.5) * w * 0.8, -rand() * h * 0.5];
      const rise = f * (1.5 + rand());
      const a = Math.round(255 * (1 - f / SPARKLE_FRAMES));
      const c = k % 3 === 0 ? C.white : C.gold;
      put(cx + x0, cy + y0 - rise, c, a);
      if (k % 4 === 0 && f < 6) {
        put(cx + x0 - 1, cy + y0 - rise, c, a);
        put(cx + x0 + 1, cy + y0 - rise, c, a);
        put(cx + x0, cy + y0 - rise - 1, c, a);
        put(cx + x0, cy + y0 - rise + 1, c, a);
      }
    }
  });
  return { art, ax: cx, ay: cy };
}

/** A walker, frame `i` (stepping), in clothes `cloth` (an index into CLOTHES), facing left or right. Anchored at its feet. */
export function walkerFrame(i: number, cloth: number, left: boolean): Frame {
  const c = cloth % CLOTHES.length;
  const step = i % 2 === 1;
  const art = pixelArt(`walker:${step ? 1 : 0}:${c}:${left ? 'l' : 'r'}`, 3, 6, (put) => person(put, 1, 0, CLOTHES[c] ?? CLOTHES[0], step, left));
  return { art, ax: 1, ay: 5 };
}

/** A file of three recruits drilling with spears, stepping in turn, frame `i` of 4. Anchored at the first one's feet. */
export function drillFrame(i: number): Frame {
  const f = i % 4;
  const art = pixelArt(`drill:${f}`, 14, 12, (put) => {
    for (let k = 0; k < 3; k++) {
      const [x, y] = [2 + k * 4, 2 + k * 2];
      person(put, x, y, C.bannerDark, (f + k) % 2 === 0);
      // the spear, raised on the first beat of each pair
      const up = f % 2 === 0 ? 1 : 0;
      for (let dy = -2 - up; dy <= 3; dy++) put(x + 2, y + dy, C.wood);
      put(x + 2, y - 3 - up, C.metal);
    }
  });
  return { art, ax: 2, ay: 7 };
}

/** A rider on a horse, legs stepping, frame `i`, facing left or right on screen. Anchored at the horse's feet. */
export function riderFrame(i: number, left: boolean): Frame {
  const step = i % 2 === 1;
  const m = left ? -1 : 1;
  const art = pixelArt(`rider:${step ? 1 : 0}:${left ? 'l' : 'r'}`, 9, 9, (put) => {
    const [cx, base] = [4, 8];
    for (let dx = -2; dx <= 2; dx++) put(cx + dx * m, base - 3, C.horse);
    put(cx + 3 * m, base - 4, C.horse);
    put(cx + 3 * m, base - 3, C.horseDark);
    for (const dx of step ? [-2, 1] : [-1, 2]) {
      put(cx + dx * m, base - 2, C.horseDark);
      put(cx + dx * m, base - 1, C.horseDark);
    }
    put(cx, base - 7, C.hair);
    put(cx, base - 6, C.skin);
    put(cx, base - 5, C.banner);
    put(cx - m, base - 4, C.banner);
  });
  return { art, ax: 4, ay: 8 };
}

/** Two people carrying a stretcher between them, stepping, frame `i`, facing left or right. Anchored between their feet. */
export function stretcherFrame(i: number, left: boolean): Frame {
  const step = i % 2 === 1;
  const art = pixelArt(`stretcher:${step ? 1 : 0}:${left ? 'l' : 'r'}`, 11, 6, (put) => {
    person(put, 1, 0, C.canvas, step, left);
    person(put, 9, 0, C.canvas, !step, left);
    for (let x = 2; x <= 8; x++) put(x, 3, x === 2 || x === 8 ? C.wood : C.wool);
    put(5, 2, C.skin);
  });
  return { art, ax: 5, ay: 5 };
}

/** Sparks off an anvil as the hammer falls, frame `i` of 8 (sparks on the first three). Anchored on the anvil. */
export function sparksFrame(i: number): Frame {
  const f = i % 8;
  const art = pixelArt(`sparks:${f}`, 11, 9, (put) => {
    if (f > 2) return;
    const rand = seeded(31 + f);
    for (let k = 0; k < 5 - f; k++) put(5 + (rand() - 0.5) * (4 + f * 4), 7 - f * 2 - rand() * 3, k % 2 ? C.fireHi : C.gold, 255 - f * 60);
  });
  return { art, ax: 5, ay: 8, light: true };
}

/** Sawdust flying from a saw at a pile of logs, frame `i` of 6. Anchored on the logs. */
export function sawdustFrame(i: number): Frame {
  const f = i % 6;
  const art = pixelArt(`sawdust:${f}`, 9, 8, (put) => {
    const rand = seeded(53 + f);
    for (let k = 0; k < 4; k++) put(4 + (rand() - 0.5) * 6, 6 - rand() * 5, k % 2 ? C.logEnd : C.plank, 200);
  });
  return { art, ax: 4, ay: 7 };
}

/** A twinkle at the top of a dome (research under way), frame `i` of 4. Anchored at the dome's top. */
export function twinkleFrame(i: number): Frame {
  const f = i % 4;
  const art = pixelArt(`twinkle:${f}`, 5, 5, (put) => {
    put(2, 2, C.white);
    if (f % 2 === 0)
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        put(2 + dx, 2 + dy, C.gold);
    if (f === 0)
      for (const [dx, dy] of [
        [-2, 0],
        [2, 0],
        [0, -2],
        [0, 2],
      ] as const)
        put(2 + dx, 2 + dy, C.gold, 140);
  });
  return { art, ax: 2, ay: 4, light: true };
}

/** A window lit at night, `h` pixels high, flickering a little over frame `i` of 4. Anchored at its top. */
export function windowLightFrame(i: number, h: number): Frame {
  const f = i % 4;
  const art = pixelArt(`lamp:${f}:${h}`, 1, Math.max(1, h), (put) => {
    for (let y = 0; y < h; y++) put(0, y, C.lamp, [230, 215, 240, 222][f]);
  });
  return { art, ax: 0, ay: 0, light: true };
}

/** Whether it is night by the player's clock (dark enough for lit windows). */
export function isNight(date = new Date()): boolean {
  return darknessAt(date.getHours() + date.getMinutes() / 60) > 0.4;
}

/** How dark it is at `hours` (0-24, local time): deep night from 21:00 to 05:00, dusk and dawn between, 0 by day. */
export function darknessAt(hours: number): number {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 21 || h < 5) return 1;
  if (h >= 18) return (h - 18) / 3;
  if (h < 8) return 1 - (h - 5) / 3;
  return 0;
}

/**
 * The weather over a state (`zoneId`) at `date`: drawn with seeded randomness from the day's four-hour block and the
 * state, so it holds for a few hours and everyone in the state sees the same sky. Mostly clear; rain (snow in winter,
 * December to February) about one block in six; now and then a storm.
 */
export function weatherAt(date: Date, zoneId: number): Weather | null {
  const block = Math.floor(date.getUTCHours() / 4);
  const r = (hash(`${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${block}-${zoneId}`) % 1000) / 1000;
  const winter = [11, 0, 1].includes(date.getUTCMonth());
  if (r < 0.05) return 'storm';
  if (r < 0.22) return winter ? 'snow' : 'rain';
  return null;
}

/**
 * The raindrops or snowflakes over a `w` × `h` view (CSS pixels) at time `t`: rain falls fast on a slant (a storm
 * heavier and faster), snow drifts down swaying. Each is seeded, so they fall the same way every visit.
 */
export function particlesAt(weather: Weather | null, t: number, w: number, h: number): Particle[] {
  if (!weather || w <= 0 || h <= 0) return [];
  const per = weather === 'storm' ? 2500 : weather === 'rain' ? 5000 : 6000;
  const n = Math.min(600, Math.round((w * h) / per));
  const s = t / 1000;
  return Array.from({ length: n }, (_, i) => {
    const rand = seeded(i + 1);
    const [x0, y0, v] = [rand() * w, rand() * h, 0.8 + rand() * 0.4];
    if (weather === 'snow') {
      const y = (((y0 + s * 40 * v) % h) + h) % h;
      return { x: (((x0 + Math.sin(s * 1.5 + i) * 6) % w) + w) % w, y, len: 0 };
    }
    const speed = (weather === 'storm' ? 700 : 520) * v;
    return { x: (((x0 - (s * speed) / 2) % w) + w) % w, y: (((y0 + s * speed) % h) + h) % h, len: weather === 'storm' ? 8 : 6 };
  });
}

/** Lightning in a storm at time `t`: a flash and a flicker every 11 seconds (each state at its own moment), else 0. */
export function flashAt(t: number, seed: number): number {
  const p = (t / 1000 + (seed % 11)) % 11;
  if (p < 0.08) return 1;
  if (p < 0.25) return 0.35;
  if (p > 0.4 && p < 0.46) return 0.6;
  return 0;
}

/**
 * The sky over a scene in state `zoneId` at `date` (the player's clock) and animation time `t`, for a `w` × `h`
 * view: night by the hour, darker under rain and darker still in a storm, its drops or flakes, and lightning.
 */
export function skyAt(zoneId: number, t: number, w: number, h: number, date = new Date()): Sky {
  const weather = weatherAt(date, zoneId);
  const overcast = weather === 'storm' ? 0.35 : weather ? 0.15 : 0;
  return {
    darkness: Math.min(1, darknessAt(date.getHours() + date.getMinutes() / 60) * 0.85 + overcast),
    weather,
    particles: particlesAt(weather, t, w, h),
    flash: weather === 'storm' ? flashAt(t, zoneId) : 0,
  };
}

/**
 * Glints on a lake `r` world units across, frame `i` of 6: a few bright pixels catching the light here and there.
 * Anchored at the lake's middle.
 */
export function glintFrame(i: number, r: number): Frame {
  const f = i % 6;
  const [rx, ry] = [Math.max(2, Math.round(r * 0.75)), Math.max(1, Math.round(r * 0.38))];
  const art = pixelArt(`glint:${f}:${rx}`, rx * 2 + 1, ry * 2 + 1, (put) => {
    const rand = seeded(97 + f * 13 + rx);
    for (let k = 0; k < 3; k++) {
      const [a, d] = [rand() * Math.PI * 2, Math.sqrt(rand())];
      const [x, y] = [rx + Math.cos(a) * d * (rx - 1), ry + Math.sin(a) * d * (ry - 0.5)];
      put(x, y, C.white, 220);
      if (k === 0) put(x + 1, y, C.white, 140);
    }
  });
  return { art, ax: rx, ay: ry };
}

/** An army on the march: three soldiers stepping behind a banner of their side's colour, frame `i`, facing left or right. Anchored at their feet. */
export function marchFrame(i: number, side: Side, left: boolean): Frame {
  const step = i % 2 === 1;
  const flag = SIDE_COLOURS[side];
  // the soldiers in the middle, the banner's pole at the front and its flag flying out beyond it
  const art = pixelArt(`march:${step ? 1 : 0}:${side}:${left ? 'l' : 'r'}`, 18, 10, (put) => {
    for (let k = 0; k < 3; k++) person(put, 5 + k * 4, 4 - (k % 2), C.outline, (k + (step ? 1 : 0)) % 2 === 0, left);
    const pole = left ? 3 : 14;
    for (let y = 0; y <= 6; y++) put(pole, y, C.wood);
    for (let y = 0; y < 3; y++) for (let x = 1; x <= 3; x++) put(pole + (left ? -x : x), y, flag);
  });
  return { art, ax: 9, ay: 9 };
}

/** The frame of a looping animation at time `t` (ms): `fps` frames a second over `frames`, started at a seeded `phase`. */
export function frameAt(t: number, fps: number, frames: number, phase: number): number {
  return (Math.floor((t / 1000) * fps) + phase) % frames;
}

/** The frame of a quarry blast at time `t`, or -1 between blasts: one every BLAST_EVERY_S seconds, at a seeded moment. */
export function blastAt(t: number, phase: number): number {
  const s = (t / 1000 + (phase % BLAST_EVERY_S)) % BLAST_EVERY_S;
  const f = Math.floor(s * 8);
  return f < BLAST_FRAMES ? f : -1;
}

/** The ambient animation a spot shows, if any, at time `t`: a frame (or two, a quarry's dust and blast) and its alpha. */
function ambient(spot: Spot, t: number, seed: number): Frame[] {
  switch (spot.k) {
    case 'smoke':
      return [smokeFrame(frameAt(t, 6, SMOKE_FRAMES, seed), seed)];
    case 'fire':
      return [fireFrame(frameAt(t, 8, 6, seed), spot.n ?? 4)];
    case 'sails':
      return [sailsFrame(frameAt(t, 5, SAIL_FRAMES, 0), spot.n ?? 6)];
    case 'wheel':
      return [wheelFrame(frameAt(t, 6, WHEEL_FRAMES, 0), spot.n ?? 3)];
    case 'banner':
      return [bannerFrame(frameAt(t, 3, 4, seed))];
    case 'glow':
      return [glowFrame(frameAt(t, 3, 6, seed), spot.n ?? 3)];
    case 'horse':
      return [horseTailFrame(frameAt(t, 4, 6, seed))];
    case 'sheep':
      return [sheepFrame(frameAt(t, 2, 8, seed), Math.cos((t / 1000) * 0.15 + seed) >= 0)];
    case 'water':
      return [glintFrame(frameAt(t, 3, 6, seed), spot.n ?? 6)];
    case 'rock': {
      const blast = blastAt(t, seed);
      return blast >= 0 ? [dustFrame(frameAt(t, 6, DUST_FRAMES, seed), seed), blastFrame(blast)] : [dustFrame(frameAt(t, 6, DUST_FRAMES, seed), seed)];
    }
    default:
      return [];
  }
}

/** A building's construction at time `t`: scaffolding and builders over its tile. */
export function constructionOverlays(owner: Omit<Animated, 'file'>, t: number): Overlay[] {
  const span = Math.round((owner.size ?? 64) / 64);
  const f = constructionFrame(frameAt(t, 6, BUILD_FRAMES, hash(owner.key)), span);
  return [{ key: `${owner.key}:build`, col: owner.col, row: owner.row, art: f.art, x: -f.ax, y: -f.ay }];
}

/** The sparkle over a building that finished a level at `doneAt` (ms, the page's clock), while it lasts. */
export function sparkleOverlays(owner: Omit<Animated, 'file'>, t: number, doneAt: number | undefined): Overlay[] {
  if (doneAt == null || t < doneAt || t - doneAt > SPARKLE_MS) return [];
  const span = Math.round((owner.size ?? 64) / 64);
  const f = sparkleFrame(Math.floor(((t - doneAt) / SPARKLE_MS) * SPARKLE_FRAMES), span);
  return [{ key: `${owner.key}:sparkle`, col: owner.col, row: owner.row, art: f.art, x: -f.ax, y: -f.ay }];
}

/**
 * The lines where people walk across a row of slots: midway between neighbouring slots (the grass between them), and
 * one beyond each end at the same spacing. Fewer than two slots have none.
 */
export function streetLines(values: readonly number[]): number[] {
  const v = [...new Set(values.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  const gaps = pairs(v);
  const [first] = gaps;
  const last = gaps.at(-1);
  if (!first || !last) return [];
  return [first[0] - (first[1] - first[0]) / 2, ...gaps.map(([a, b]) => (a + b) / 2), last[1] + (last[1] - last[0]) / 2];
}

/**
 * The streets of a grid of slots: where its lines of grass cross, and which crossings join. A big slot (the 2×2 Town
 * Hall, `span` > 1) blocks the streets that would run through it.
 */
export function streetsOf(slots: readonly { col: number; row: number; span?: number }[]): Streets {
  const small = slots.filter((s) => (s.span ?? 1) === 1);
  const big = slots.filter((s) => (s.span ?? 1) > 1);
  const cols = streetLines(small.map((s) => s.col));
  const rows = streetLines(small.map((s) => s.row));
  const blocked = (col: number, row: number) => big.some((b) => Math.abs(col - b.col) < (b.span ?? 1) / 2 && Math.abs(row - b.row) < (b.span ?? 1) / 2);
  const nodes = cols.flatMap((col) => rows.map((row) => ({ col, row })));
  const at = (i: number, j: number) => i * rows.length + j;
  const links = nodes.map((n, k) => {
    if (blocked(n.col, n.row)) return [];
    const [i, j] = [Math.floor(k / rows.length), k % rows.length];
    return (
      [
        [i - 1, j],
        [i + 1, j],
        [i, j - 1],
        [i, j + 1],
      ] as const
    )
      .filter(([a, b]) => a >= 0 && b >= 0 && a < cols.length && b < rows.length)
      .map(([a, b]) => at(a, b))
      .filter((m) => {
        const o = nodes[m];
        return !!o && !blocked(o.col, o.row) && !blocked((n.col + o.col) / 2, (n.row + o.row) / 2);
      });
  });
  return { nodes, links };
}

/** A walker's route: ROUTE_STEPS crossings, from a seeded start, turning at random and never straight back if it can help it. */
export function walkerRoute(streets: Streets, seed: number): number[] {
  const rand = seeded(seed);
  const usable = streets.links.flatMap((l, i) => (l.length ? [i] : []));
  if (!usable.length) return [];
  const start = usable[Math.floor(rand() * usable.length)];
  if (start === undefined) return [];
  const route = [start];
  let [prev, cur]: [number | undefined, number] = [undefined, start];
  for (let k = 0; k < ROUTE_STEPS; k++) {
    // a crossing's links are mutual, so every crossing on the route has a way on
    const links = streets.links[cur] ?? [];
    const ways = links.filter((n) => n !== prev);
    const options = ways.length ? ways : links;
    const next = options[Math.floor(rand() * options.length)];
    if (next === undefined) break;
    route.push(next);
    [prev, cur] = [cur, next];
  }
  return route;
}

/**
 * Where a walker is at time `t` (ms) on its route, there and back again at WALK_SPEED, started `phase` seconds in:
 * its grid point, and whether it faces left on screen (walking up a row or down a column).
 */
export function walkerAt(streets: Streets, route: readonly number[], t: number, phase: number): (GridSpot & { left: boolean }) | null {
  const [home] = route;
  if (home === undefined || route.length < 2) return null;
  // there and back: the route's crossings, then back along them to where it started
  const seq = [...route, ...route.slice(1, -1).reverse(), home].flatMap((i) => streets.nodes[i] ?? []);
  const legs = pairs(seq).map(([a, b]) => ({ a, b, length: Math.abs(b.col - a.col) + Math.abs(b.row - a.row) }));
  const total = legs.reduce((s, leg) => s + leg.length, 0);
  const [start] = seq;
  if (!start) return null;
  if (!total) return { ...start, left: false };
  let d = ((((t / 1000 + phase) * WALK_SPEED) % total) + total) % total;
  for (const [i, { a, b, length }] of legs.entries()) {
    if (d <= length || i === legs.length - 1) {
      const k = length ? Math.min(1, d / length) : 0;
      return { col: a.col + (b.col - a.col) * k, row: a.row + (b.row - a.row) * k, left: b.col - b.row < a.col - a.row };
    }
    d -= length;
  }
  return null;
}

/** `count` people walking a grid's streets at time `t`, each on a seeded route in seeded clothes. */
export function walkerOverlays(streets: Streets, count: number, t: number, key: string): Overlay[] {
  return Array.from({ length: count }, (_, n) => {
    const seed = hash(`${key}:walker${n}`);
    const at = walkerAt(streets, walkerRoute(streets, seed), t, seed % 97);
    if (!at) return [];
    const f = walkerFrame(frameAt(t, 6, 2, n), seed, at.left);
    return [{ key: `${key}:w${n}`, col: at.col, row: at.row, art: f.art, x: -f.ax, y: -f.ay }];
  }).flat();
}

/** Where a sprite stands on its tile when it has no spot for something: the middle of its ground. */
function middleOf(owner: Pick<Animated, 'size'>): Spot {
  const size = owner.size ?? 64;
  return { k: 'middle', x: size / 2, y: (size * 3) / 4 - 2 };
}

/**
 * Something walking back and forth beside a spot, along the ground (two pixels across for one down), `reach` pixels
 * each way: where it is at time `t`, and whether it faces left.
 */
export function pacing(t: number, reach: number, seed: number): { dx: number; dy: number; left: boolean } {
  const a = (t / 1000) * 0.6 + (seed % 628) / 100;
  const dx = Math.round(Math.sin(a) * reach);
  return { dx, dy: Math.round(dx / 2), left: Math.cos(a) < 0 };
}

/**
 * Everything a building shows at time `t`: its ambient animations (`ambientOverlays`), and what it is doing (`state`):
 * a beacon blazing while an enemy army comes, recruits drilling at a barracks that is training, sparks at the forge
 * while fortifications are made, the academy aglow while research runs, a rider at the stable while cavalry trains,
 * a stretcher carried to the relief station while troops lie injured, troops forming up at the rally spot while an army
 * is out, and sawdust at the workshop while siege engines are built.
 */
export function buildingOverlays(owner: Animated, typeId: number, pos: number | undefined, state: TownState, t: number, night = false): Overlay[] {
  const spots = SPOTS[owner.file] ?? [];
  const alarm = typeId === BuildingType.BEACON_TOWER && state.enemy;
  const out = ambientOverlays(owner, t, alarm ? spots.filter((s) => s.k !== 'fire') : spots);
  const seed = hash(owner.key);
  const of = (k: string) => spots.filter((s) => s.k === k);
  const first = (k: string) => of(k)[0] ?? middleOf(owner);
  const put = (s: Spot, f: Frame, name: string, dx = 0, dy = 0) => out.push(placeFrame(owner, { ...s, x: s.x + dx, y: s.y + dy }, f, `${owner.key}:${name}`));
  // at night the windows are lit
  if (night) of('window').forEach((s, i) => put(s, windowLightFrame(frameAt(t, 2, 4, seed + i), s.n ?? 2), `lamp${i}`));
  switch (typeId) {
    case BuildingType.BEACON_TOWER:
      if (alarm)
        of('fire').forEach((s, i) => {
          put(s, fireFrame(frameAt(t, 10, 6, seed + i), (s.n ?? 4) * 2.4), `blaze${i}`);
          put(s, smokeFrame(frameAt(t, 8, SMOKE_FRAMES, seed + i), seed), `blazeSmoke${i}`, 0, -(s.n ?? 4) * 2);
        });
      break;
    case BuildingType.BARRACKS:
      if (pos != null && state.training.includes(pos)) put(first('dummy'), drillFrame(frameAt(t, 4, 4, seed)), 'drill', -8, 5);
      break;
    case BuildingType.FORGE:
      if (state.forts) of('anvil').forEach((s, i) => put(s, sparksFrame(frameAt(t, 8, 8, seed + i * 3)), `sparks${i}`));
      break;
    case BuildingType.ACADEMY:
      if (state.research) {
        of('window').forEach((s, i) => put(s, glowFrame(frameAt(t, 3, 6, seed + i), s.n ?? 2), `study${i}`));
        of('dome').forEach((s, i) => put(s, twinkleFrame(frameAt(t, 4, 4, seed + i)), `twinkle${i}`));
      }
      break;
    case BuildingType.STABLE:
      if (state.cavalry) {
        const p = pacing(t, 9, seed);
        put(first('horse'), riderFrame(frameAt(t, 6, 2, seed), p.left), 'rider', p.dx - 4, p.dy + 6);
      }
      break;
    case BuildingType.RELIEF_STATION:
      if (state.injured) {
        const p = pacing(t, 8, seed);
        put(first('tent'), stretcherFrame(frameAt(t, 5, 2, seed), p.left), 'stretcher', p.dx, p.dy + 6);
      }
      break;
    case BuildingType.RALLY_SPOT:
      if (state.armyOut) put(first('tent'), drillFrame(frameAt(t, 4, 4, seed)), 'muster', -10, 6);
      break;
    case BuildingType.WORKSHOP:
      if (state.siege) put(first('logs'), sawdustFrame(frameAt(t, 8, 6, seed)), 'sawdust');
      break;
  }
  return out;
}

/**
 * A town after an attack at `attackedAt` (ms, real time; `now` the same clock): smoke and small fires over a few of its
 * buildings (seeded by the attack, so the same ones burn on every visit), fewer as it goes, out after AFTERMATH_MS.
 */
export function aftermathOverlays(owners: readonly Animated[], attackedAt: number | null, t: number, now = Date.now()): Overlay[] {
  if (attackedAt == null || now < attackedAt || now - attackedAt > AFTERMATH_MS || !owners.length) return [];
  const left = 1 - (now - attackedAt) / AFTERMATH_MS;
  const burning = Math.max(1, Math.ceil(AFTERMATH_FIRES * left));
  const rand = seeded(Math.floor(attackedAt / 1000));
  const picked = owners
    .map((o) => ({ o, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .slice(0, burning)
    .map((p) => p.o);
  return picked.flatMap((owner, i) => {
    const seed = hash(`${owner.key}:fire`);
    const mid = middleOf(owner);
    const at = { ...mid, y: mid.y - 10 };
    return [
      placeFrame(owner, at, fireFrame(frameAt(t, 9, 6, seed), 3), `${owner.key}:burn${i}`),
      placeFrame(owner, { ...at, y: at.y - 4 }, smokeFrame(frameAt(t, 7, SMOKE_FRAMES, seed), seed), `${owner.key}:burnSmoke${i}`),
    ];
  });
}

/** `v` moved by whole turns of `size` to lie within half a turn of `near`: the copy of a point on a wrapping map nearest it. */
export function nearest(v: number, near: number, size: number): number {
  return v + Math.round((near - v) / size) * size;
}

/**
 * Where an army is at `now` (ms, real time) on a map `size` tiles across that wraps: along the shorter way from where it
 * set out to where it goes (back the other way when coming back), by its timings; at its target while it stays. Given as
 * the copy nearest `near` (the camera), and whether it faces left on screen.
 */
export function armyAt(a: Marching, size: number, now: number, near: GridSpot): (GridSpot & { left: boolean }) | null {
  const at = (id: number) => ({ col: id % size, row: Math.floor(id / size) });
  const [from, to] = a.direction === 2 ? [at(a.targetFieldId), at(a.startFieldId)] : [at(a.startFieldId), at(a.targetFieldId)];
  const span = a.reachTime - a.startTime;
  const p = a.direction === 3 ? 1 : span > 0 ? Math.min(1, Math.max(0, (now - a.startTime) / span)) : 1;
  const dc = nearest(to.col, from.col, size) - from.col;
  const dr = nearest(to.row, from.row, size) - from.row;
  const [col, row] = [from.col + dc * p, from.row + dr * p];
  return { col: nearest(col, near.col, size), row: nearest(row, near.row, size), left: dc - dr < 0 };
}

/** The state (zone) a map point lies in, on a map `size` tiles across that wraps. */
export function zoneOf(p: GridSpot, size: number): number {
  const wrapped = (v: number) => ((Math.round(v) % size) + size) % size;
  return stateOf(wrapped(p.row) * size + wrapped(p.col), size);
}

/** A worker on each of the places given (the player's valleys), pacing about its middle at time `t`. */
export function workerOverlays(places: readonly (GridSpot & { key: string })[], t: number): Overlay[] {
  return places.map((p) => {
    const seed = hash(p.key);
    const w = pacing(t, 6, seed);
    const f = walkerFrame(frameAt(t, 6, 2, seed), seed, w.left);
    return { key: `${p.key}:worker`, col: p.col, row: p.row, art: f.art, x: w.dx - f.ax, y: w.dy + 4 - f.ay };
  });
}

/** The armies the player can see, marching on the map at time `t` (`now` the real clock), placed nearest the camera. */
export function armyOverlays(armies: readonly { army: Marching; side: Side }[], size: number, near: GridSpot, t: number, now = Date.now()): Overlay[] {
  return armies.flatMap(({ army, side }) => {
    const p = armyAt(army, size, now, near);
    if (!p) return [];
    const f = marchFrame(army.direction === 3 ? 0 : frameAt(t, 6, 2, army.armyId), side, p.left);
    return [{ key: `army${army.armyId}`, col: p.col, row: p.row, art: f.art, x: -f.ax, y: -f.ay }];
  });
}

/** Whether a sprite has parts drawn turning over its bare twin (sails, a wheel). */
export function hasMovingParts(file: string): boolean {
  return (SPOTS[file] ?? []).some((s) => MOVING_SPOTS.has(s.k));
}

/** A frame laid on a sprite: the overlay that puts frame `f`'s anchor on spot `s` of a sprite standing on its tile. */
export function placeFrame(owner: Animated, s: Spot, f: Frame, key: string, alpha?: number): Overlay {
  const box = spriteBox(owner.size);
  const o: Overlay = { key, col: owner.col, row: owner.row, art: f.art, x: box.left + s.x - f.ax, y: box.top + s.y - f.ay };
  if (alpha != null) o.alpha = alpha;
  if (f.light) o.light = true;
  return o;
}

/**
 * A sprite's ambient animations at time `t` (ms): smoke from its chimneys, flames, turning sails and wheels, banners,
 * glowing furnaces, horses' tails, a quarry's dust and blasts, each at its spot (`spots`, from spots.json) and each
 * started at a phase seeded by the sprite and the spot, so no two move in step.
 */
export function ambientOverlays(owner: Animated, t: number, spots: readonly Spot[] = SPOTS[owner.file] ?? []): Overlay[] {
  return spots.flatMap((s, i) => {
    const seed = hash(`${owner.key}:${i}`);
    // a sheep wanders a pixel or two about where it was drawn
    const at = s.k === 'sheep' ? { ...s, x: s.x + Math.round(Math.sin((t / 1000) * 0.15 + seed) * 2) } : s;
    return ambient(s, t, seed).map((f, j) => placeFrame(owner, at, f, `${owner.key}:a${i}:${j}`));
  });
}
