import { Sex } from '@marchlands/core';

import type { Build, Rgb, Shades } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/types';
import type { FigureHairColour, FigureSkinTone } from '@/lib/game-art';
import { PALETTE } from '@/lib/palette';

/** The render's size in pixels, scaled up crisp by whole multiples (docs/features/hero-3d.md). */
export const RENDER_SIZE = 128;

/** Where the camera looks (the middle of the figure, in render pixels), how far down it looks, and its depth range. */
export const CAMERA = { target: 56, tilt: 0.18, distance: 200, near: 1, far: 400 };

/** The turn the figure rests at: three-quarters towards the right of the picture, as the 2D figure and the troops face. */
export const REST_ANGLE = 0.55;

/** How far an arrow key turns it: a sixteenth of a turn. */
export const KEY_TURN = Math.PI / 8;

/** How far a drag turns it: a full turn for 400 CSS pixels. */
export const TURN_PER_PX = (2 * Math.PI) / 400;

/** How quickly it eases back to rest once let go: half the way every this many milliseconds. */
export const SETTLE_HALF_LIFE_MS = 90;

/** Close enough to rest to stop easing, in radians. */
export const SETTLED = 0.002;

/** What a tap does, one in turn: a sword swing, a salute, the shield raised. */
export const FigureAction = {
  SWING: 'swing',
  SALUTE: 'salute',
  SHIELD: 'shield',
} as const;
export type FigureAction = (typeof FigureAction)[keyof typeof FigureAction];
export const FIGURE_ACTIONS = Object.values(FigureAction) as [FigureAction, ...FigureAction[]];

/** How long an action takes, in milliseconds. */
export const ACTION_MS = 800;

/**
 * Each action's keyframes: at a share of its time, the sword arm's turn about x (forward: positive tips the sword
 * forward) and z (towards the body), and the shield arm's about x (negative raises it forward); eased between.
 */
export const ACTION_KEYS: Record<FigureAction, readonly (readonly [at: number, swordX: number, swordZ: number, shieldX: number])[]> = {
  // drawn back, then struck down in front
  swing: [
    [0, 0, 0, 0],
    [0.3, -0.55, 0, 0],
    [0.55, 1.35, 0.15, 0],
    [1, 0, 0, 0],
  ],
  // the hilt brought up before the face, held, and lowered
  salute: [
    [0, 0, 0, 0],
    [0.3, -0.5, 0.7, 0],
    [0.7, -0.5, 0.7, 0],
    [1, 0, 0, 0],
  ],
  // the shield lifted in front, held, and lowered
  shield: [
    [0, 0, 0, 0],
    [0.25, 0, 0, -0.85],
    [0.75, 0, 0, -0.85],
    [1, 0, 0, 0],
  ],
};

/** The cape hangs back this far (radians about x) and stirs this much either way; the bat wings spread and flap so. */
export const BACK = { capeTilt: 0.12, capeStir: 0.05, wingSpread: 0.6, wingFlap: 0.1 };

/** How strongly level 10's stones glow at the 2D figure's brightest (glowAlpha), towards its glow colour. */
export const GLOW_STRENGTH = 0.6;

/** The light, from the top left and in front, fixed to the view so the figure stays lit like the sprites as it turns. */
export const LIGHT: readonly [number, number, number] = [-0.55, 0.65, 0.52];

/** Where the light's bands start: lit above the first, mid above the second, shaded below. */
export const BANDS = { lit: 0.5, mid: -0.1 };

/** An inner edge is outlined where a neighbour is nearer by this many render pixels (an arm over the chest). */
export const DEPTH_EDGE = 3;

// the figure's colours are the base colours the sprites use (lib/palette.ts)
/** The outline round every sprite. */
export const OUTLINE = PALETTE.OUTLINE;

/** The materials, as the art scripts' (tools/art/gear/common.ts and tools/art/figure/). */
export const SHADES = {
  blue: [PALETTE.BLUE_HI, PALETTE.BLUE, PALETTE.BLUE_DARK],
  steel: [PALETTE.STEEL_HI, PALETTE.STEEL, PALETTE.STEEL_DARK],
  brightSteel: [PALETTE.STEEL_HI, PALETTE.STEEL_HI, PALETTE.STEEL],
  iron: [PALETTE.METAL, PALETTE.METAL, PALETTE.STEEL_DARK],
  darkSteel: [PALETTE.METAL, PALETTE.HOOD, PALETTE.HOOD_DARK],
  mail: [PALETTE.MAIL_HI, PALETTE.MAIL, PALETTE.STEEL_DARK],
  gold: [PALETTE.FIRE_HI, PALETTE.GOLD, PALETTE.GOLD_DARK],
  wood: [PALETTE.PLANK_TOP, PALETTE.PLANK_L, PALETTE.PLANK_R],
  rod: [PALETTE.PLANK_TOP, PALETTE.PLANK_TOP, PALETTE.TRUNK],
  leather: [PALETTE.HORSE_HI, PALETTE.LEATHER, PALETTE.LEATHER_DARK],
  cloth: [PALETTE.WOOL, PALETTE.LINEN, PALETTE.LINEN_DARK],
  wool: [PALETTE.WOOL, PALETTE.WOOL, PALETTE.LINEN],
  whiteFoot: [PALETTE.WOOL, PALETTE.WOOL, PALETTE.LINEN_DARK],
  banner: [PALETTE.BANNER_HI, PALETTE.BANNER, PALETTE.BANNER_DARK],
  cord: [PALETTE.BANNER_HI, PALETTE.BANNER_HI, PALETTE.BANNER_DARK],
  flower: [PALETTE.FLOWER, PALETTE.BANNER_HI, PALETTE.BARN_L],
  hood: [PALETTE.HOOD, PALETTE.HOOD_DARK, PALETTE.GEAR_0],
  blueBelt: [PALETTE.STEEL_HI, PALETTE.BLUE, PALETTE.BLUE_DARK],
  amber: [PALETTE.FIRE, PALETTE.FIRE, PALETTE.ROOF_D],
} satisfies Record<string, Shades>;

/** Single colours: the outline (for eyes and slits), lips, a man's brow, a plank's seam, a braid's tie. */
export const COLOURS = {
  outline: OUTLINE,
  lips: PALETTE.LIPS,
  brow: PALETTE.HAIR_BROWN_DARK,
  seam: PALETTE.PLANK_R,
  tie: PALETTE.LEATHER_DARK,
  sparkle: PALETTE.SPARKLE,
} satisfies Record<string, Rgb>;

/** The skin tones (FIGURE_SKIN_TONES), each light, mid and shaded. */
export const SKIN_TONES = {
  pale: [PALETTE.SKIN_PALE_HI, PALETTE.SKIN_PALE, PALETTE.SKIN_PALE_SHADE],
  fair: [PALETTE.SKIN_FAIR_HI, PALETTE.SKIN_FAIR, PALETTE.SKIN_FAIR_SHADE],
  olive: [PALETTE.SKIN_OLIVE_HI, PALETTE.SKIN_OLIVE, PALETTE.SKIN_OLIVE_SHADE],
  brown: [PALETTE.SKIN_BROWN_HI, PALETTE.SKIN_BROWN, PALETTE.SKIN_BROWN_SHADE],
} satisfies Record<FigureSkinTone, Shades>;

/** The hair colours (FIGURE_HAIR_COLOURS), each light, mid and dark. */
export const HAIR_COLOURS = {
  black: [PALETTE.HAIR_BLACK_HI, PALETTE.HAIR_BLACK, PALETTE.HAIR_BLACK_DARK],
  brown: [PALETTE.HAIR_BROWN_HI, PALETTE.HAIR_BROWN, PALETTE.HAIR_BROWN_DARK],
  auburn: [PALETTE.HAIR_AUBURN_HI, PALETTE.HAIR_AUBURN, PALETTE.HAIR_AUBURN_DARK],
  blond: [PALETTE.HAIR_BLOND_HI, PALETTE.HAIR_BLOND, PALETTE.HAIR_BLOND_DARK],
  grey: [PALETTE.HAIR_GREY_HI, PALETTE.HAIR_GREY, PALETTE.HAIR_GREY_DARK],
} satisfies Record<FigureHairColour, Shades>;

/** Each gear level's colours, 0 to 10 (the gearN palette entries). */
export const GEAR_TIERS: readonly [Shades, ...Shades[]] = [
  [PALETTE.GEAR_0_HI, PALETTE.GEAR_0, PALETTE.GEAR_0_DARK],
  [PALETTE.GEAR_1_HI, PALETTE.GEAR_1, PALETTE.GEAR_1_DARK],
  [PALETTE.GEAR_2_HI, PALETTE.GEAR_2, PALETTE.GEAR_2_DARK],
  [PALETTE.GEAR_3_HI, PALETTE.GEAR_3, PALETTE.GEAR_3_DARK],
  [PALETTE.GEAR_4_HI, PALETTE.GEAR_4, PALETTE.GEAR_4_DARK],
  [PALETTE.GEAR_5_HI, PALETTE.GEAR_5, PALETTE.GEAR_5_DARK],
  [PALETTE.GEAR_6_HI, PALETTE.GEAR_6, PALETTE.GEAR_6_DARK],
  [PALETTE.GEAR_7_HI, PALETTE.GEAR_7, PALETTE.GEAR_7_DARK],
  [PALETTE.GEAR_8_HI, PALETTE.GEAR_8, PALETTE.GEAR_8_DARK],
  [PALETTE.GEAR_9_HI, PALETTE.GEAR_9, PALETTE.GEAR_9_DARK],
  [PALETTE.GEAR_10_HI, PALETTE.GEAR_10, PALETTE.GEAR_10_DARK],
];

/** Level 10's stones: white at heart, in its crimson. */
export const CRIMSON_STONE: Shades = [PALETTE.SPARKLE, PALETTE.GEAR_10_HI, PALETTE.GEAR_10_DARK];

/** The builds: a woman's narrower waist, belt, neck and legs, wider hips and smaller head, as the 2D figure's cut. */
export const BUILDS = {
  [Sex.MALE]: { chest: 15, waist: 11, belt: 11.8, hips: 11, thigh: 6, calf: 4.3, neck: 3.4, head: [0.95, 1.08, 1] },
  [Sex.FEMALE]: { chest: 14, waist: 9.3, belt: 10.2, hips: 12.2, thigh: 5.6, calf: 3.7, neck: 2.9, head: [0.88, 1.0, 0.94] },
} satisfies Record<Sex, Build>;

/** The body's joints in render pixels, feet at 0 and about 106 tall to the top of the helm, alike for both builds. */
export const BODY = {
  ankle: 7,
  knee: 30,
  hip: 50,
  waist: 57,
  shoulder: 79,
  neck: 85,
  head: 94,
  headR: 8.5,
  hipX: 6,
  shoulderX: 15.5,
};

/** The toon shader: the material's lit, mid or shaded colour by how the surface faces the light; no textures. */
export const TOON_VERTEX = /* glsl */ `
varying vec3 vNormal;
void main() {
  vNormal = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export const TOON_FRAGMENT = /* glsl */ `
uniform vec3 hi;
uniform vec3 mid;
uniform vec3 dark;
uniform vec3 light;
uniform vec2 bands;
uniform float glow;
uniform vec3 glowColour;
varying vec3 vNormal;
void main() {
  float d = dot(normalize(vNormal), light);
  vec3 c = d > bands.x ? hi : d > bands.y ? mid : dark;
  gl_FragColor = vec4(mix(c, glowColour, glow), 1.0);
}`;

/**
 * The outline pass over the low-resolution render: a clear pixel next to the figure becomes outline (the outline
 * round the silhouette, as the sprites' `outline()`), and so does a pixel with a much nearer neighbour (inner edges).
 */
export const OUTLINE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export const OUTLINE_FRAGMENT = /* glsl */ `
uniform sampler2D tColour;
uniform sampler2D tDepth;
uniform vec2 texel;
uniform vec3 outline;
uniform float edge;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tColour, vUv);
  float d = texture2D(tDepth, vUv).r;
  float nearest = d;
  float cover = 0.0;
  vec2 around[4];
  around[0] = vec2(texel.x, 0.0);
  around[1] = vec2(-texel.x, 0.0);
  around[2] = vec2(0.0, texel.y);
  around[3] = vec2(0.0, -texel.y);
  for (int i = 0; i < 4; i++) {
    vec2 at = vUv + around[i];
    float a = texture2D(tColour, at).a;
    cover = max(cover, a);
    if (a > 0.5) nearest = min(nearest, texture2D(tDepth, at).r);
  }
  if (c.a < 0.5) gl_FragColor = cover > 0.5 ? vec4(outline, 1.0) : vec4(0.0);
  else if (d - nearest > edge) gl_FragColor = vec4(outline, 1.0);
  else gl_FragColor = c;
}`;
