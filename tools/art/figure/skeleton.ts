// The hero figure's skeleton (tools/art/figure.ts, docs/features/hero-figure-art.md): where the head, shoulders,
// hands, hips and feet stand on the 96×96 canvas, the same for a man and a woman so every piece of gear fits both.
// Turned three-quarter towards the right of the picture and lit from the top left: the near arm (the hero's right, on
// the left of the picture) rests a sword point down, the far arm holds the shield before the body.

import { Sex, SpotKind } from '@marchlands/core';
import { setStone, shaded, type Shades, sweep } from '../gear/common.ts';
import { PixelCanvas, type Pt } from '../pixel.ts';

export const SIZE = 96;

export const figureCanvas = (name: string) => new PixelCanvas(SIZE, name);

/** The skull, an oval round its middle; the face looks right. */
export const HEAD = { cx: 50, cy: 13.5, rx: 5.5, ry: 6 };
export const SHOULDER_NEAR: Pt = [41, 25];
export const SHOULDER_FAR: Pt = [58, 25];
export const ELBOW_NEAR: Pt = [37, 37];
/** The near hand's fist, gripping the sword. */
export const HAND_NEAR: Pt = [39, 48];
export const ELBOW_FAR: Pt = [62, 36];
/** The far hand, holding the shield's grip. */
export const HAND_FAR: Pt = [59, 41];
/** The belt's top and bottom rows. */
export const BELT: readonly [number, number] = [42, 45];
export const HIP_NEAR: Pt = [45.5, 49];
export const HIP_FAR: Pt = [54, 49];
export const KNEE_NEAR: Pt = [45, 67];
export const KNEE_FAR: Pt = [54, 66];
export const ANKLE_NEAR: Pt = [45, 84];
export const ANKLE_FAR: Pt = [54, 82];
/** The soles: the far foot stands further back, so higher in the picture. */
export const SOLE_NEAR = 91;
export const SOLE_FAR = 89;

/** The torso from the shoulders to the hips, a woman's narrower at the waist. */
export function torso(sex: Sex): Pt[] {
  return sex === Sex.FEMALE
    ? [
        [41, 22],
        [58, 22],
        [61, 26],
        [58, 35],
        [56.5, 42],
        [58, 48],
        [42, 48],
        [43.5, 42],
        [41, 35],
        [39, 26],
      ]
    : [
        [41, 22],
        [58, 22],
        [61, 26],
        [59, 36],
        [58, 48],
        [42, 48],
        [41, 36],
        [39, 26],
      ];
}

/** A path through `pts`, by its length, for `sweep`. */
export function polyline(pts: Pt[]): (t: number) => Pt {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = lens.reduce((a, b) => a + b, 0);
  return (t) => {
    let d = t * total;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i] || i === lens.length - 1) {
        const f = lens[i] ? Math.min(1, d / lens[i]) : 0;
        return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f];
      }
      d -= lens[i];
    }
    return pts[pts.length - 1];
  };
}

/**
 * A limb or a band down along `pts`, `w0` pixels wide at its start to `w1` at its end, lit on its left (sweep lights
 * the left of a path going up).
 */
export function limb(c: PixelCanvas, pts: Pt[], w0: number, w1: number, shades: Shades) {
  const colour = shaded(shades);
  sweep(
    c,
    polyline(pts),
    (t) => (w0 + (w1 - w0) * t) / 2,
    (t, side) => colour(t, -side),
    128,
  );
}

/** Lay `top`'s drawn pixels over `base`, with its spots. */
export function over(base: PixelCanvas, top: PixelCanvas) {
  for (let i = 0; i < top.px.length; i++) if (top.px[i]) base.px[i] = top.px[i];
  base.spots.push(...top.spots);
}

/** A stone in its setting (setStone), recorded as a `stone` spot so the client can make it glow. */
export function stone(c: PixelCanvas, x: number, y: number, r: number, trim: Shades, accent: Shades) {
  setStone(c, x, y, r, trim, accent);
  c.spot(SpotKind.STONE, [x, y], r);
}

/** A part drawn on a canvas of its own and outlined, so it keeps its outline where it overlaps the parts behind it. */
export function part(name: string, draw: (c: PixelCanvas) => void): PixelCanvas {
  const c = figureCanvas(name);
  draw(c);
  c.outline();
  return c;
}

/** The parts laid back to front on one canvas. */
export function layer(name: string, parts: PixelCanvas[]): PixelCanvas {
  const c = figureCanvas(name);
  for (const p of parts) over(c, p);
  return c;
}
