// The hero figure's arms (tools/art/figure/upper.ts): sleeves (a padded coat, or mail from 3), the gauntlets on the
// forearms and the pauldrons on the shoulders, as the gauntlets and shoulder icons (tools/art/gear/gauntlets.ts,
// shoulder.ts). Gauntlets: a blue bracer under a gold crown cuff (0), a silver gauntlet over the hand (1), a dark
// engraved bracer (2), then from 3 a gauntlet trimmed in gold with a stone in the level's colour, spikes from 7 and a
// horn at the elbow from 8. Pauldrons: blue steel trimmed in gold over white cloth (0), grey plates (1), steel with a
// ridge (2), then plates edged in gold with a stone, cloth in the level's colour hanging below from 5, spikes from 6
// and a horn from 8; gilded at 9 and crimson at 10.

import { Colour } from '../../../client/web/src/lib/palette.ts';
import { BLUE, CLOTH, DARK_STEEL, GOLD, horn, IRON, lit, look, type Shades, spike, STEEL } from '../gear/common.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { ELBOW_FAR, ELBOW_NEAR, HAND_FAR, HAND_NEAR, layer, limb, part, SHOULDER_FAR, SHOULDER_NEAR, stone } from './skeleton.ts';

const MAIL: Shades = [Colour.MAIL_HI, Colour.MAIL, Colour.STEEL_DARK];

const sleeve = (level: number): Shades => (level <= 2 ? CLOTH : MAIL);

/** The gauntlets' metal and the cuff's trim at a level. */
function gauntlet(level: number): { metal: Shades; cuff: Shades | null; hand: boolean } {
  const L = look(level);
  if (level === 0) return { metal: BLUE, cuff: GOLD, hand: false };
  if (level === 1) return { metal: STEEL, cuff: null, hand: true };
  if (level === 2) return { metal: DARK_STEEL, cuff: null, hand: false };
  return { metal: L.metal, cuff: L.trim, hand: true };
}

/** The far arm, mostly behind the shield. */
export function farArm(level: number): PixelCanvas {
  return part('far-arm', (c) => {
    limb(c, [SHOULDER_FAR, ELBOW_FAR], 6, 5, sleeve(level));
    limb(c, [ELBOW_FAR, HAND_FAR], 5, 4.5, gauntlet(level).metal);
  });
}

/** The near arm down to the fist, its forearm in the gauntlet; a gauntleted hand from 1 (bar 2). */
export function nearArm(level: number): PixelCanvas {
  const L = look(level);
  const { metal, cuff, hand } = gauntlet(level);
  const wrist: Pt = [HAND_NEAR[0], HAND_NEAR[1] - 3];
  const c = part('near-arm', (c) => {
    limb(c, [SHOULDER_NEAR, ELBOW_NEAR], 7, 5.5, sleeve(level));
    limb(c, [ELBOW_NEAR, wrist], 6, 5.5, metal);
    if (L.horns) horn(c, [ELBOW_NEAR[0] - 1, ELBOW_NEAR[1] + 1], [ELBOW_NEAR[0] - 6, ELBOW_NEAR[1] - 2], 4, cuff ?? GOLD);
    if (hand) oval(c, HAND_NEAR[0], HAND_NEAR[1], 2.9, 2.7, lit(HAND_NEAR[0], HAND_NEAR[1], 2.5, metal));
    // the cuff round the wrist: a crown at 0, trim from 3
    if (cuff)
      for (let x = wrist[0] - 3; x <= wrist[0] + 3; x++) {
        c.set(x, wrist[1] - 1, cuff[0]);
        c.set(x, wrist[1], cuff[1]);
      }
    if (level === 0) for (const x of [wrist[0] - 2, wrist[0], wrist[0] + 2]) c.set(x, wrist[1] - 2, Colour.FIRE_HI);
    if (level === 2) for (let y = ELBOW_NEAR[1] + 2; y < wrist[1] - 1; y += 2) c.set(ELBOW_NEAR[0] + 1, y, Colour.HOOD_DARK);
    if (level >= 3) stone(c, ELBOW_NEAR[0] + 1.5, ELBOW_NEAR[1] + 5, 0.8 + level * 0.04, cuff ?? GOLD, L.accent);
  });
  if (hand) for (const y of [HAND_NEAR[1] - 1, HAND_NEAR[1] + 1]) c.set(HAND_NEAR[0] + 1, y, metal[2]);
  if (L.spikes) spike(c, [ELBOW_NEAR[0] - 2, ELBOW_NEAR[1] + 5], [ELBOW_NEAR[0] - 6, ELBOW_NEAR[1] + 4], cuff ?? GOLD);
  return c;
}

/** The pauldrons: the near one over the top of the near arm, the far one smaller beyond the neck. */
export function shoulders(level: number): PixelCanvas {
  const L = look(level);
  const metal: Shades = level === 0 ? BLUE : level === 1 ? IRON : level === 2 ? STEEL : L.metal;
  const edge: Shades = level === 0 ? GOLD : level >= 3 ? L.trim : [Colour.STEEL_DARK, Colour.STEEL_DARK, Colour.HOOD_DARK];
  const cloth: Shades | null = level === 0 ? CLOTH : level >= 5 ? L.accent : null;
  const pauldron = (name: string, [sx, sy]: Pt, rx: number, ry: number) =>
    part(name, (c) => {
      // cloth hanging below
      if (cloth)
        for (let y = Math.round(sy + ry); y <= sy + ry + 4; y++)
          for (let x = Math.round(sx - rx + 1); x <= sx + rx - 1; x++) c.set(x, y, (x + Math.floor(y / 2)) % 3 === 0 ? cloth[2] : x < sx ? cloth[0] : cloth[1]);
      // a lower plate, then the dome over it, each edged
      oval(c, sx, sy + ry * 0.75, rx * 0.95, ry * 0.6, lit(sx, sy, rx, metal));
      for (let x = Math.ceil(sx - rx * 0.95); x < sx + rx * 0.95; x++)
        c.set(x, Math.round(sy + ry * 0.75 + ry * 0.6 * Math.sqrt(Math.max(0, 1 - ((x - sx) / rx) ** 2))) - 1, edge[1]);
      oval(c, sx, sy, rx, ry, lit(sx - 1, sy - 1, rx, metal));
      for (let x = Math.ceil(sx - rx); x < sx + rx; x++) c.set(x, Math.round(sy + ry * Math.sqrt(Math.max(0, 1 - ((x - sx) / rx) ** 2))) - 1, edge[1]);
      if (level === 2) for (let x = Math.ceil(sx - rx + 2); x < sx + rx - 1; x++) c.set(x, Math.round(sy - 1), Colour.STEEL_DARK);
    });
  const far = pauldron('far-pauldron', [SHOULDER_FAR[0] + 1.5, SHOULDER_FAR[1] - 1], 4, 3.2);
  const hornPart = part('pauldron-horn', (c) => {
    if (L.horns) horn(c, [SHOULDER_NEAR[0] - 2, SHOULDER_NEAR[1] - 2], [SHOULDER_NEAR[0] - 8, SHOULDER_NEAR[1] - 8], 4.5, L.trim);
  });
  const out = layer('shoulders', [far, hornPart, pauldron('near-pauldron', [SHOULDER_NEAR[0] - 1, SHOULDER_NEAR[1]], 5.5, 4.2)]);
  if (level >= 3) stone(out, SHOULDER_NEAR[0] - 1.5, SHOULDER_NEAR[1] - 0.5, 0.8 + level * 0.05, L.trim, L.accent);
  if (level >= 6) {
    spike(out, [SHOULDER_NEAR[0] - 5, SHOULDER_NEAR[1] - 1], [SHOULDER_NEAR[0] - 9, SHOULDER_NEAR[1] - 3], L.trim);
    spike(out, [SHOULDER_FAR[0] + 4, SHOULDER_FAR[1] - 2], [SHOULDER_FAR[0] + 7, SHOULDER_FAR[1] - 5], L.trim);
  }
  return out;
}
