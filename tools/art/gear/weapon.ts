// The weapon (tools/art/gear.ts): a sword lying on the diagonal, pommel at the bottom left, from a wooden practice sword
// (0) to a crimson blade with silver edges and a horned guard (10).

import { SpotKind } from '@marchlands/core';

import type { Colour, PixelCanvas, Pt } from '../pixel.ts';
import { disc } from '../shapes.ts';
import { along, bent, canvas, shaded, SIZE, STEEL, sweep, tier, WOOD } from './common.ts';

interface Sword {
  /** from the pommel to the tip, along the diagonal */
  length: number;
  grip: number;
  /** the blade's half-width at the guard */
  width: number;
  blade: readonly Colour[];
  /** a line down the middle (a fuller), or a glow along the edges */
  fuller?: Colour;
  edges?: Colour;
  /** a sabre's curve, and a flamberge's waves */
  bend?: number;
  wave?: number;
  guard: { half: number; colours: readonly Colour[]; up?: number; horns?: boolean };
  grips: readonly Colour[];
  pommel: readonly Colour[];
  /** the gear level whose colour its gems take */
  gem?: number;
  /** runes along the blade, in the gem's colour */
  runes?: boolean;
  /** its edges, fuller or runes are drawn glowing: the icon makes the blade pulse */
  glows?: boolean;
}

const SWORD_GOLD = ['gold', 'gold', 'goldDark'] as const;
const GRIP = ['leather', 'leatherDark'] as const;

/** The sword at each gear level, plain to fantastic. */
const SWORDS: Sword[] = [
  // 0: a wooden practice sword
  {
    length: 24,
    grip: 6,
    width: 2,
    blade: WOOD,
    guard: { half: 3.5, colours: ['plankTop', 'trunk'] },
    grips: ['leather', 'leatherDark'],
    pommel: ['plankTop', 'trunk'],
  },
  // 1: a plain steel broadsword
  { length: 26, grip: 6, width: 2.2, blade: STEEL, guard: { half: 4, colours: ['metal', 'steelDark'] }, grips: GRIP, pommel: ['metal', 'metal', 'steelDark'] },
  // 2: a slender sabre with a brass guard
  {
    length: 27,
    grip: 6,
    width: 1.4,
    blade: STEEL,
    bend: 1.6,
    guard: { half: 3, colours: ['gold', 'goldDark'], up: 1 },
    grips: ['hair', 'leatherDark'],
    pommel: SWORD_GOLD,
  },
  // 3: a longsword with a fuller and a blue stone in its pommel
  {
    length: 28,
    grip: 7,
    width: 2,
    blade: STEEL,
    fuller: 'steelDark',
    guard: { half: 4, colours: ['gold', 'goldDark'] },
    grips: GRIP,
    pommel: SWORD_GOLD,
    gem: 3,
  },
  // 4: a bastard sword, its guard swept up, a teal stone in the guard
  {
    length: 28,
    grip: 7,
    width: 2.2,
    blade: STEEL,
    fuller: 'gear4Dark',
    guard: { half: 4.5, colours: SWORD_GOLD, up: 1.5 },
    grips: ['blueDark', 'blueEdge'],
    pommel: SWORD_GOLD,
    gem: 4,
  },
  // 5: a broad blade with indigo runes
  {
    length: 29,
    grip: 7,
    width: 2.6,
    blade: STEEL,
    runes: true,
    guard: { half: 5, colours: SWORD_GOLD, up: 1.5 },
    grips: ['bannerDark', 'roofEdge'],
    pommel: SWORD_GOLD,
    gem: 5,
  },
  // 6: a flamberge, its waving edge in plum
  {
    length: 29,
    grip: 7,
    width: 2.2,
    blade: STEEL,
    wave: 0.5,
    edges: 'gear6Hi',
    glows: true,
    guard: { half: 5, colours: SWORD_GOLD, up: 2 },
    grips: ['gear6Dark', 'gear0'],
    pommel: SWORD_GOLD,
    gem: 6,
  },
  // 7: a runeblade, its edges glowing magenta
  {
    length: 30,
    grip: 7,
    width: 2.6,
    blade: STEEL,
    edges: 'gear7Hi',
    runes: true,
    glows: true,
    guard: { half: 5, colours: SWORD_GOLD, up: 2, horns: true },
    grips: ['gear7Dark', 'gear0'],
    pommel: SWORD_GOLD,
    gem: 7,
  },
  // 8: a greatsword, a fire-orange fuller
  {
    length: 30,
    grip: 8,
    width: 3,
    blade: STEEL,
    fuller: 'gear8Hi',
    edges: 'steelHi',
    glows: true,
    guard: { half: 5.5, colours: SWORD_GOLD, up: 2.5, horns: true },
    grips: ['gear8Dark', 'gear0'],
    pommel: SWORD_GOLD,
    gem: 8,
  },
  // 9: a gilded greatsword
  {
    length: 31,
    grip: 8,
    width: 3,
    blade: ['gold', 'steelHi', 'goldDark'],
    fuller: 'gear9Hi',
    guard: { half: 6, colours: SWORD_GOLD, up: 2.5, horns: true },
    grips: ['gear9Dark', 'gear0'],
    pommel: SWORD_GOLD,
    gem: 9,
  },
  // 10: a crimson blade with silver edges and teeth, a horned guard and a glowing stone
  {
    length: 31,
    grip: 8,
    width: 3.2,
    blade: ['gear10Hi', 'gear10', 'gear10Dark'],
    edges: 'steelHi',
    fuller: 'gear10Dark',
    guard: { half: 6, colours: ['steelHi', 'steelDark'], up: 3, horns: true },
    grips: ['gear10Dark', 'gear0'],
    pommel: ['steelHi', 'steel', 'steelDark'],
    gem: 10,
  },
];

/** The weapon at a gear level. */
export function weapon(level: number): PixelCanvas {
  const s = SWORDS[level];
  const c = canvas('weapon', level);
  // the pommel sits at the bottom left, so the sword fills the diagonal
  const start: Pt = [SIZE / 2 - s.length / 2 / Math.SQRT2 + 0.5, SIZE / 2 + s.length / 2 / Math.SQRT2 - 0.5];
  const guardAt = along(start, s.grip);
  const tip = along(start, s.length);
  // the blade, tapering to its point over the last few pixels
  const blade = bent(guardAt, tip, s.bend ?? 0);
  const taper = (t: number) => Math.min(1, (1 - t) / 0.3);
  const waveAt = (t: number) => (s.wave ? s.wave * Math.sin(t * Math.PI * 9) : 0);
  sweep(
    c,
    blade,
    (t) => s.width * taper(t) + waveAt(t),
    (t, side) => {
      if (s.edges && Math.abs(side) > 0.5) return s.edges;
      if (s.fuller && Math.abs(side) < 0.2 && t > 0.08 && t < 0.72) return s.fuller;
      if (s.runes && s.gem != null && Math.abs(side) < 0.25 && t > 0.1 && t < 0.7 && Math.floor(t * 18) % 3 === 0) return tier(s.gem)[0];
      return shaded(s.blade)(t, side);
    },
  );
  // the grip, wrapped in two shades
  sweep(
    c,
    bent(start, guardAt),
    () => 1.6,
    (t) => (Math.floor(t * 6) % 2 ? s.grips[1] : s.grips[0]),
  );
  // the guard across the blade, its arms swept up towards the tip
  const up = s.guard.up ?? 0;
  const g = s.guard.half;
  sweep(
    c,
    (t) => along(guardAt, Math.abs(t - 0.5) * 2 * up, (t - 0.5) * 2 * g),
    () => 1.6,
    (_t, side) => (side < 0 ? s.guard.colours[0] : s.guard.colours[s.guard.colours.length - 1]),
  );
  // the pommel, and the stones
  const [px, py] = along(start, -0.6);
  disc(c, px, py, 2, s.pommel[0], s.pommel[s.pommel.length - 1]);
  if (s.gem != null) {
    const [hi, mid] = tier(s.gem);
    c.set(px, py, mid);
    c.spot(SpotKind.GEM, [Math.floor(px), Math.floor(py)], 1);
    if (s.gem >= 4) {
      c.set(guardAt[0], guardAt[1], mid);
      c.set(guardAt[0] - 1, guardAt[1], hi);
      c.spot(SpotKind.GEM, [Math.floor(guardAt[0] - 1), Math.floor(guardAt[1])], 1);
    }
  }
  // a glowing blade: from the guard up the diagonal, `n` long and `m` its half-width
  if (s.glows) c.spot(SpotKind.BLADE, guardAt, s.length - s.grip, s.width);
  c.outline();
  // the guard's horns after the outline, so they stay thin: two pixels wide, curling towards the tip
  if (s.guard.horns)
    for (const dir of [-1, 1]) {
      const base = along(guardAt, up, dir * (g + 1));
      const tipOf = along(base, 4, dir * 1);
      c.line(base, tipOf, s.guard.colours[0]);
      c.line(along(base, 0, -dir), along(tipOf, -1, -dir), s.guard.colours[s.guard.colours.length - 1]);
    }
  return c;
}
