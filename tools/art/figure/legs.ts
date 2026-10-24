// The hero figure's legs layer (tools/art/figure.ts): the legs gear and the boots at a level, a woman's with her own
// cut (wider at the hips, slimmer below), on the skeleton's hips, knees and ankles. Plain white trousers and blue and
// white boots trimmed in gold (0), cloth in the level's colour with knee plates trimmed in gold and plate boots with a
// stone at the ankle from 3, thigh plates from 6, knee spikes from 7, and crimson armour trimmed in silver at 10, as
// the legs and feet icons (tools/art/gear/legs.ts, feet.ts).

import { Sex } from '@marchlands/core';

import { BLUE, CLOTH, fill, GOLD, lit, look, setStone, type Shades, spike, STEEL } from '../gear/common.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { ANKLE_FAR, ANKLE_NEAR, HIP_FAR, HIP_NEAR, KNEE_FAR, KNEE_NEAR, layer, limb, part, SOLE_FAR, SOLE_NEAR } from './skeleton.ts';

/** The cloth of the legs, and the metal of their plates and the boots. */
function materials(level: number): { cloth: Shades; plate: Shades; trim: Shades | null } {
  const L = look(level);
  if (level === 0) return { cloth: CLOTH, plate: BLUE, trim: GOLD };
  if (level === 1) return { cloth: ['flower', 'bannerHi', 'barnL'], plate: STEEL, trim: null };
  if (level === 2) return { cloth: ['hood', 'hoodDark', 'gear0'], plate: STEEL, trim: null };
  return { cloth: level >= 10 ? L.metal : L.accent, plate: L.metal, trim: L.trim };
}

/** A boot from the ankle down to `sole`, its toe pointing right. */
function boot(c: PixelCanvas, [ax]: Pt, top: number, sole: number, level: number) {
  const { plate, trim } = materials(level);
  const shaft: Pt[] = [
    [ax - 3.5, top],
    [ax + 3, top],
    [ax + 3, sole - 2],
    [ax - 3.5, sole - 2],
  ];
  const foot: Pt[] = [
    [ax - 3.5, sole - 3],
    [ax + 3, sole - 4],
    [ax + 8, sole - 1],
    [ax + 8, sole + 1],
    [ax - 3.5, sole + 1],
  ];
  if (level === 0) {
    // blue and white, a gold cuff
    fill(c, shaft, BLUE);
    fill(c, foot, ['wool', 'wool', 'linenDark']);
  } else {
    fill(c, shaft, plate);
    fill(c, foot, plate);
  }
  if (trim)
    for (let x = Math.floor(ax - 3.5); x <= ax + 3; x++) {
      c.set(x, top, trim[0]);
      c.set(x, top + 1, trim[1]);
    }
  if (level >= 3) setStone(c, ax + 1, top + 4, 0.9, trim ?? GOLD, look(level).accent);
}

export function figureLegs(sex: Sex, level: number): PixelCanvas {
  const L = look(level);
  const { cloth, plate, trim } = materials(level);
  const female = sex === Sex.FEMALE;
  const thigh = female ? 9 : 9.5;
  const calf = female ? 5.5 : 6.5;
  const leg = (name: string, hip: Pt, knee: Pt, ankle: Pt, sole: number, w: number) => [
    part(`${name}-leg`, (c) => {
      limb(c, [hip, knee, ankle], w, calf, cloth);
      if (level >= 6)
        // a plate on the thigh
        limb(
          c,
          [
            [hip[0], hip[1] + 4],
            [knee[0], knee[1] - 4],
          ],
          w - 1,
          w - 2,
          level >= 10 ? STEEL : plate,
        );
      if (level >= 3) {
        // the knee plate
        oval(c, knee[0] + 0.5, knee[1], 3.4, 2.8, lit(knee[0], knee[1], 3, trim ?? GOLD));
        oval(c, knee[0] + 0.5, knee[1], 2, 1.6, lit(knee[0], knee[1], 2, level >= 9 ? (trim ?? GOLD) : STEEL));
      }
      if (level === 2)
        for (let i = -2; i <= 2; i++) {
          c.set(knee[0] + i, knee[1] + 6 + i, 'steelHi');
          c.set(knee[0] + i, knee[1] + 6 - i, 'steelHi');
        }
    }),
    part(`${name}-boot`, (c) => boot(c, ankle, ankle[1] - 5, sole, level)),
  ];
  const hips = part('hips', (c) => {
    // from under the belt to the top of the legs, a woman's wider
    const w = female ? 1 : 0;
    fill(
      c,
      [
        [42.5 - w, 43],
        [57.5 + w, 43],
        [58.5 + w, 51],
        [56, 55],
        [43, 55],
        [41.5 - w, 51],
      ],
      cloth,
    );
    if (level === 1)
      for (let x = 43; x <= 57; x++) {
        c.set(x, 47, 'leatherDark');
        c.set(x, 48, 'leather');
      }
  });
  const parts = [...leg('far', HIP_FAR, KNEE_FAR, ANKLE_FAR, SOLE_FAR, thigh - 1), hips, ...leg('near', HIP_NEAR, KNEE_NEAR, ANKLE_NEAR, SOLE_NEAR, thigh)];
  const out = layer(`legs-${sex}-${level}`, parts);
  if (L.spikes)
    for (const k of [KNEE_FAR, KNEE_NEAR]) {
      spike(out, [k[0] + 2, k[1] - 1], [k[0] + 5, k[1] - 4], trim ?? GOLD);
    }
  return out;
}
