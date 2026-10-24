import { Sex } from '@marchlands/core';
import type { Build, Rgb, Shades } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/types';
import type { FigureHairColour, FigureSkinTone } from '@/lib/game-art';

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
export const FIGURE_ACTIONS = ['swing', 'salute', 'shield'] as const;

/** How long an action takes, in milliseconds. */
export const ACTION_MS = 800;

/**
 * Each action's keyframes: at a share of its time, the sword arm's turn about x (forward: positive tips the sword
 * forward) and z (towards the body), and the shield arm's about x (negative raises it forward); eased between.
 */
export const ACTION_KEYS: Record<(typeof FIGURE_ACTIONS)[number], readonly (readonly [at: number, swordX: number, swordZ: number, shieldX: number])[]> = {
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

// the sprites' palette colours the figure uses (tools/art/pixel.ts, PALETTE), kept in step with it
const rgb = (r: number, g: number, b: number): Rgb => [r, g, b];

/** The outline round every sprite. */
export const OUTLINE = rgb(52, 36, 28);

/** The materials, as the art scripts' (tools/art/gear/common.ts and tools/art/figure/). */
export const SHADES = {
  blue: [rgb(112, 154, 208), rgb(72, 112, 172), rgb(50, 80, 130)],
  steel: [rgb(226, 232, 240), rgb(172, 180, 194), rgb(110, 118, 134)],
  brightSteel: [rgb(226, 232, 240), rgb(226, 232, 240), rgb(172, 180, 194)],
  iron: [rgb(150, 156, 166), rgb(150, 156, 166), rgb(110, 118, 134)],
  darkSteel: [rgb(150, 156, 166), rgb(88, 82, 78), rgb(60, 56, 54)],
  mail: [rgb(150, 156, 168), rgb(104, 110, 122), rgb(110, 118, 134)],
  gold: [rgb(252, 222, 100), rgb(232, 186, 72), rgb(178, 132, 40)],
  wood: [rgb(176, 132, 86), rgb(152, 108, 66), rgb(118, 82, 50)],
  rod: [rgb(176, 132, 86), rgb(176, 132, 86), rgb(94, 66, 42)],
  leather: [rgb(160, 106, 66), rgb(146, 100, 62), rgb(104, 70, 44)],
  cloth: [rgb(242, 240, 230), rgb(214, 196, 154), rgb(174, 154, 112)],
  wool: [rgb(242, 240, 230), rgb(242, 240, 230), rgb(214, 196, 154)],
  whiteFoot: [rgb(242, 240, 230), rgb(242, 240, 230), rgb(174, 154, 112)],
  banner: [rgb(214, 76, 64), rgb(178, 44, 44), rgb(128, 30, 32)],
  cord: [rgb(214, 76, 64), rgb(214, 76, 64), rgb(128, 30, 32)],
  flower: [rgb(236, 120, 140), rgb(214, 76, 64), rgb(146, 74, 50)],
  hood: [rgb(88, 82, 78), rgb(60, 56, 54), rgb(42, 36, 42)],
  blueBelt: [rgb(226, 232, 240), rgb(72, 112, 172), rgb(50, 80, 130)],
  amber: [rgb(240, 132, 40), rgb(240, 132, 40), rgb(156, 56, 38)],
} satisfies Record<string, Shades>;

/** Single colours: the outline (for eyes and slits), lips, a man's brow, a plank's seam, a braid's tie. */
export const COLOURS = {
  outline: OUTLINE,
  lips: rgb(176, 92, 84),
  brow: rgb(66, 42, 26),
  seam: rgb(118, 82, 50),
  tie: rgb(104, 70, 44),
  sparkle: rgb(255, 255, 255),
} satisfies Record<string, Rgb>;

/** The skin tones (FIGURE_SKIN_TONES), each light, mid and shaded. */
export const SKIN_TONES = {
  pale: [rgb(252, 226, 204), rgb(240, 204, 176), rgb(208, 162, 134)],
  fair: [rgb(246, 206, 166), rgb(228, 178, 136), rgb(190, 136, 98)],
  olive: [rgb(220, 170, 122), rgb(196, 144, 98), rgb(154, 104, 68)],
  brown: [rgb(172, 118, 80), rgb(140, 92, 60), rgb(102, 64, 42)],
} satisfies Record<FigureSkinTone, Shades>;

/** The hair colours (FIGURE_HAIR_COLOURS), each light, mid and dark. */
export const HAIR_COLOURS = {
  black: [rgb(78, 70, 72), rgb(44, 38, 40), rgb(26, 22, 24)],
  brown: [rgb(132, 90, 58), rgb(98, 64, 40), rgb(66, 42, 26)],
  auburn: [rgb(190, 98, 50), rgb(148, 66, 32), rgb(100, 40, 20)],
  blond: [rgb(240, 210, 136), rgb(212, 168, 86), rgb(158, 118, 52)],
  grey: [rgb(214, 212, 206), rgb(168, 164, 158), rgb(118, 114, 110)],
} satisfies Record<FigureHairColour, Shades>;

/** Each gear level's colours, 0 to 10 (the gearN palette entries). */
export const GEAR_TIERS: readonly [Shades, ...Shades[]] = [
  [rgb(74, 66, 72), rgb(42, 36, 42), rgb(20, 16, 22)],
  [rgb(178, 182, 188), rgb(130, 134, 142), rgb(80, 84, 92)],
  [rgb(152, 198, 76), rgb(100, 156, 42), rgb(56, 102, 26)],
  [rgb(104, 140, 236), rgb(46, 90, 210), rgb(24, 50, 138)],
  [rgb(92, 204, 184), rgb(32, 152, 138), rgb(16, 94, 90)],
  [rgb(132, 112, 226), rgb(84, 60, 190), rgb(46, 30, 122)],
  [rgb(188, 104, 178), rgb(140, 54, 132), rgb(86, 28, 86)],
  [rgb(244, 100, 192), rgb(208, 44, 152), rgb(138, 18, 100)],
  [rgb(252, 162, 74), rgb(228, 112, 26), rgb(154, 64, 12)],
  [rgb(252, 224, 112), rgb(224, 178, 40), rgb(150, 110, 16)],
  [rgb(244, 96, 116), rgb(198, 30, 64), rgb(118, 12, 36)],
];

/** Level 10's stones: white at heart, in its crimson. */
export const CRIMSON_STONE: Shades = [rgb(255, 255, 255), rgb(244, 96, 116), rgb(118, 12, 36)];

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
