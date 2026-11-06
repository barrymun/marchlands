// The hero figure's body (tools/art/figure.ts): the skin layer (the head, neck and hands in a skin tone, a man's or a
// woman's face) and the hair layer (a hairstyle in a colour), which the client stacks with the gear. The hair lies over
// the gear (long hair falls over the shoulders) and under the helm.

import { Sex } from '@marchlands/core';

import { type FigureHairColour, FigureHairStyle, type FigureSkinTone } from '../../../client/web/src/lib/game-art.ts';
import { Colour } from '../../../client/web/src/lib/palette.ts';
import { lit, type Shades, sweep } from '../gear/common.ts';
import type { PixelCanvas, Pt } from '../pixel.ts';
import { oval } from '../shapes.ts';
import { HAND_FAR, HAND_NEAR, HEAD, layer, part } from './skeleton.ts';

const SKIN_SHADES: Record<FigureSkinTone, Shades> = {
  pale: [Colour.SKIN_PALE_HI, Colour.SKIN_PALE, Colour.SKIN_PALE_SHADE],
  fair: [Colour.SKIN_FAIR_HI, Colour.SKIN_FAIR, Colour.SKIN_FAIR_SHADE],
  olive: [Colour.SKIN_OLIVE_HI, Colour.SKIN_OLIVE, Colour.SKIN_OLIVE_SHADE],
  brown: [Colour.SKIN_BROWN_HI, Colour.SKIN_BROWN, Colour.SKIN_BROWN_SHADE],
};
const HAIR_SHADES: Record<FigureHairColour, Shades> = {
  black: [Colour.HAIR_BLACK_HI, Colour.HAIR_BLACK, Colour.HAIR_BLACK_DARK],
  brown: [Colour.HAIR_BROWN_HI, Colour.HAIR_BROWN, Colour.HAIR_BROWN_DARK],
  auburn: [Colour.HAIR_AUBURN_HI, Colour.HAIR_AUBURN, Colour.HAIR_AUBURN_DARK],
  blond: [Colour.HAIR_BLOND_HI, Colour.HAIR_BLOND, Colour.HAIR_BLOND_DARK],
  grey: [Colour.HAIR_GREY_HI, Colour.HAIR_GREY, Colour.HAIR_GREY_DARK],
};

const inHead = (x: number, y: number, grow = 0) => ((x + 0.5 - HEAD.cx) / (HEAD.rx + grow)) ** 2 + ((y + 0.5 - HEAD.cy) / (HEAD.ry + grow)) ** 2 <= 1;

/** The head, neck and hands in `tone`. */
export function skin(sex: Sex, tone: FigureSkinTone): PixelCanvas {
  const s = SKIN_SHADES[tone];
  const [, mid, shade] = s;
  const female = sex === Sex.FEMALE;
  const head = part('skin-head', (c) => {
    // the neck, shaded at the front under the jaw
    for (let y = 18; y <= 23; y++) for (let x = female ? 48 : 47; x <= 52; x++) c.set(x, y, x >= 51 || y <= 19 ? shade : mid);
    oval(c, HEAD.cx, HEAD.cy, HEAD.rx, HEAD.ry, lit(HEAD.cx - 1, HEAD.cy, HEAD.ry, s));
    // the jaw and chin, forward and down to the right
    const jaw: Pt[] = female
      ? [
          [46, 15],
          [55, 15],
          [55.5, 18],
          [52.5, 20.5],
          [49, 20],
          [46, 18],
        ]
      : [
          [46, 15],
          [55.5, 15],
          [56, 18.5],
          [53.5, 21],
          [48.5, 21],
          [46, 18.5],
        ];
    c.poly(jaw, (x, y) => (y >= 19 && x <= 51 ? shade : mid));
    // the nose stands out of the profile
    c.set(56, 14, mid);
    c.set(56, 15, shade);
  });
  // the face, inside the outline
  head.set(48, 13, s[2]);
  head.set(48, 14, s[2]);
  head.set(49, 14, s[2]);
  head.set(53, 13, Colour.OUTLINE);
  head.set(54, 13, Colour.SPARKLE);
  for (const x of [52, 53, 54]) head.set(x, 11, female ? s[2] : Colour.HAIR_BROWN_DARK);
  if (female) head.set(54, 12, Colour.OUTLINE);
  head.set(53, 17, female ? Colour.LIPS : s[2]);
  head.set(54, 17, female ? Colour.LIPS : s[2]);
  head.set(55, 15, s[2]);
  const hands = part('skin-hands', (c) => {
    oval(c, HAND_FAR[0], HAND_FAR[1], 2.2, 2.2, lit(HAND_FAR[0], HAND_FAR[1], 2, s));
    oval(c, HAND_NEAR[0], HAND_NEAR[1], 2.8, 2.6, lit(HAND_NEAR[0], HAND_NEAR[1], 2.5, s));
  });
  // the knuckles of the fist round the grip
  for (const y of [47, 49]) hands.set(HAND_NEAR[0] + 1, y, shade);
  return layer(`skin-${sex}-${tone}`, [head, hands]);
}

/** Hair over the top and back of the skull, down to `nape`, leaving the ear and the face clear. */
function crown(c: PixelCanvas, h: Shades, grow: number, nape: number) {
  const colour = lit(HEAD.cx - 1, HEAD.cy - 3, HEAD.ry, h);
  for (let y = 5; y <= nape; y++)
    for (let x = 42; x <= 57; x++) {
      if (!inHead(x, y, grow)) continue;
      const ear = x >= 47 && x <= 50 && y >= 12 && y <= 15;
      const face = x >= 50 && y >= 11;
      const fringe = y <= 9 || (y <= 10 && x <= 54);
      if (fringe || (!ear && !face && x <= 50 - (y - 11) * 0.5)) c.set(x, y, colour(x, y));
    }
}

/** A hairstyle in a colour. */
export function hair(style: FigureHairStyle, colour: FigureHairColour): PixelCanvas {
  const h = HAIR_SHADES[colour];
  const sex = style === FigureHairStyle.LOOSE || style === FigureHairStyle.BRAID ? Sex.FEMALE : Sex.MALE;
  const parts: PixelCanvas[] = [];
  if (style === FigureHairStyle.LOOSE)
    parts.push(
      part('hair-fall', (c) => {
        // a fall of hair down the back and over the near shoulder
        sweep(
          c,
          (t) => [45 - t * 2.5 - Math.sin(t * Math.PI) * 1.5, 11 + t * 22],
          (t) => 3.2 + Math.sin(t * Math.PI) * 1.4 - t * 0.8,
          (t, side) => (Math.floor(t * 7 + side * 1.5) % 3 === 0 ? h[2] : side > 0.4 ? h[0] : h[1]),
        );
      }),
    );
  if (style === FigureHairStyle.BRAID)
    parts.push(
      part('hair-braid', (c) => {
        // a braid from behind the ear over the near shoulder and down the chest, plaited
        sweep(
          c,
          (t) => [47 - t * 2 - Math.sin(t * Math.PI) * 2, 16 + t * 20],
          (t) => 3.1 - t * 0.7,
          (t, side) => (Math.floor(t * 10 + side * 0.9) % 2 ? h[2] : side > 0.3 ? h[1] : h[0]),
        );
        oval(c, 45, 37, 1.6, 1.2, Colour.LEATHER_DARK);
      }),
    );
  parts.push(
    part('hair-crown', (c) => {
      crown(c, h, sex === Sex.FEMALE ? 0.9 : 0.6, sex === Sex.FEMALE ? 18 : 16);
      if (style === FigureHairStyle.BEARD) {
        // a beard along the jaw and round the mouth, a moustache above it
        for (let y = 15; y <= 22; y++)
          for (let x = 48; x <= 56; x++) {
            const onJaw = (y >= 17 && x <= 55 && y <= 22 - Math.max(0, x - 54)) || (x <= 50 && y >= 14);
            if (onJaw && !(y === 17 && (x === 53 || x === 54))) c.set(x, y, y >= 20 || x <= 49 ? h[2] : h[1]);
          }
        for (const x of [53, 54, 55]) c.set(x, 16, h[1]);
      }
    }),
  );
  return layer(`hair-${style}-${colour}`, parts);
}
