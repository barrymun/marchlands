// Hero gear (docs/features/hero-gear-art.md): a 32×32 sprite per piece and gear level, 0 (no Hero Enhancement yet) to
// 10, plain and real at the bottom (a wooden sword) and fantastic at the top (a crimson blade with silver edges and
// horns); a backdrop per level in that level's colour (the GEAR_N base colours, reserved for the gear), which the
// client stacks under the piece; and the stars shown beside it: red in use, orange waiting, grey not yet bought.
// Pieces lie diagonally, hilt or base at the bottom left, lit from the top left like the troops.

import { GEAR_PIECE_IDS, GearPieceId, SpotKind } from '@marchlands/core';

import { back } from './gear/back.ts';
import { belt } from './gear/belt.ts';
import { charm } from './gear/charm.ts';
import { chest } from './gear/chest.ts';
import { tier } from './gear/common.ts';
import { feet } from './gear/feet.ts';
import { gauntlets } from './gear/gauntlets.ts';
import { head } from './gear/head.ts';
import { legs } from './gear/legs.ts';
import { mount } from './gear/mount.ts';
import { necklace } from './gear/necklace.ts';
import { ring } from './gear/ring.ts';
import { shield } from './gear/shield.ts';
import { shoulder } from './gear/shoulder.ts';
import { weapon } from './gear/weapon.ts';
import { PixelCanvas, type Spot } from './pixel.ts';
import { disc } from './shapes.ts';
import { GearStarKind, type GearTwinPart } from '../../client/web/src/lib/game-art.ts';
import { Colour } from '../../client/web/src/lib/palette.ts';

const SIZE = 32;
const STAR = 9;

/** The names of GEAR_STAR_KINDS (lib/game-art.ts lists them without any). */

/** The backdrop at a gear level: its colour glowing from the middle to dark edges; level 10 sparkles. */
function backdrop(level: number): PixelCanvas {
  const [hi, mid, dark] = tier(level);
  const c = new PixelCanvas(SIZE, `backdrop-${level}`);
  const m = (SIZE - 1) / 2;
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      // a soft round glow, the dark edges dithered into the middle
      const d = Math.hypot(x - m, y - m) / m + ((x + y) % 2 === 0 ? 0.05 : -0.05);
      c.set(x, y, d < 0.42 ? hi : d < 0.95 ? mid : dark);
    }
  // a dark frame
  for (let i = 0; i < SIZE; i++)
    for (const [x, y] of [
      [i, 0],
      [i, SIZE - 1],
      [0, i],
      [SIZE - 1, i],
    ] as const)
      c.set(x, y, Colour.GEAR_0_DARK);
  if (level === 10)
    for (const [x, y, r] of [
      [6, 7, 2],
      [25, 5, 1],
      [26, 22, 2],
      [8, 25, 1],
      [17, 3, 1],
    ] as const) {
      c.spot(SpotKind.STAR, [x, y], r);
      c.set(x, y, Colour.SPARKLE);
      for (let i = 1; i <= r; i++)
        for (const [dx, dy] of [
          [i, 0],
          [-i, 0],
          [0, i],
          [0, -i],
        ] as const)
          c.set(x + dx, y + dy, i === r ? Colour.GEAR_10_HI : Colour.SPARKLE);
    }
  return c;
}

/** A gear star, 9×9: a red five-pointed star in use, an orange disc waiting, a grey star not yet bought. */
function star(kind: GearStarKind): PixelCanvas {
  const c = new PixelCanvas(STAR, `star-${kind}`);
  if (kind === GearStarKind.WAITING) {
    disc(c, 4, 4, 3.6, Colour.WAIT, Colour.WAIT_DARK);
    for (const [x, y] of [
      [3, 2],
      [2, 3],
      [3, 3],
      [4, 2],
    ] as const)
      c.set(x, y, Colour.WAIT_HI);
    for (let y = 0; y < STAR; y++)
      for (let x = 0; x < STAR; x++) if (c.get(x, y) !== Colour.CLEAR && Math.hypot(x - 4, y - 4) > 3.2) c.set(x, y, Colour.WAIT_DARK);
    return c;
  }
  const rows = ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.', '.#.....#.'];
  const [hi, mid, dark]: Colour[] =
    kind === GearStarKind.USED ? [Colour.STAR_HI, Colour.STAR, Colour.STAR_DARK] : [Colour.GEAR_1_DARK, Colour.GEAR_1_DARK, Colour.GEAR_0_HI];
  const on = (x: number, y: number) => rows[y]?.[x] === '#';
  for (let y = 0; y < STAR; y++)
    for (let x = 0; x < STAR; x++) {
      if (!on(x, y)) continue;
      // lit at the top left, its lower and right edges dark
      const edge = !on(x + 1, y) || !on(x, y + 1);
      c.set(x, y, edge ? dark : x + y < 8 ? hi : mid);
    }
  return c;
}

/**
 * A piece's drawing, keeping only the glints (`gem` and `shine` spots) still showing once it is finished: a stone
 * drawn over, or turned to outline, has nothing left to flare.
 */
const showing =
  (draw: (level: number) => PixelCanvas) =>
  (level: number): PixelCanvas => {
    const c = draw(level);
    const covered = (colour: Colour) => colour === Colour.CLEAR || colour === Colour.OUTLINE;
    const hidden = (s: Spot) => (s.k === SpotKind.GEM || s.k === SpotKind.SHINE) && covered(c.get(s.x, s.y));
    for (let i = c.spots.length - 1; i >= 0; i--) if (hidden(c.spots[i])) c.spots.splice(i, 1);
    return c;
  };

/** Every gear piece, by piece id (GEAR_PIECES in shared/core gear.ts): a drawing for each gear level. */
const DRAWINGS: Record<GearPieceId, (level: number) => PixelCanvas> = {
  weapon,
  shield,
  mount,
  necklace,
  charm,
  ring,
  head,
  shoulder,
  chest,
  back,
  gauntlets,
  belt,
  legs,
  feet,
};
export const GEAR_DRAWINGS = GEAR_PIECE_IDS.map((piece) => ({ piece, drawing: showing(DRAWINGS[piece]) }));

/** The pieces with a part that moves alone, drawn whole, `bare` or as the part: their twins (lib/game-art.ts, gearTwinFile). */
export const GEAR_TWINS: { piece: GearPieceId; twin: (level: number, part: GearTwinPart) => PixelCanvas }[] = [{ piece: GearPieceId.HEAD, twin: head }];

export const GEAR_BACKDROP = backdrop;
export const GEAR_STAR = star;
