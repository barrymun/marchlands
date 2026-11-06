import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  Mesh,
  type Object3D,
  OctahedronGeometry,
  ShaderMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';

import { Sex } from '@marchlands/core';

import { GLOW_RGB, SWAY_MS } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/constants';
import type { FigureBody } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/types';
import { breathLift, glowAlpha } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import {
  ACTION_KEYS,
  ACTION_MS,
  BACK,
  BANDS,
  BODY,
  BUILDS,
  COLOURS,
  CRIMSON_STONE,
  type FigureAction,
  GEAR_TIERS,
  GLOW_STRENGTH,
  HAIR_COLOURS,
  LIGHT,
  SETTLE_HALF_LIFE_MS,
  SETTLED,
  SHADES,
  SKIN_TONES,
  TOON_FRAGMENT,
  TOON_VERTEX,
  TURN_PER_PX,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/constants';
import type {
  Acting,
  ArmAngles,
  FigureModel,
  GearLook,
  Rgb,
  Shades,
  Vec,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/types';
import { FigureHairStyle } from '@/lib/game-art';

/** A gear level's colours, the level kept to 0–10. */
function tier(level: number): Shades {
  return GEAR_TIERS[Math.max(0, Math.min(10, Math.round(level)))] ?? GEAR_TIERS[0];
}

/** One colour as a material's three shades: a flat colour, still outlined. */
const flat = (c: Rgb): Shades => [c, c, c];

/** Steel trimmed in gold with stones in the level's colour; gilded at 9; crimson trimmed in silver at 10 (the icons' look). */
export function gearLook(level: number): GearLook {
  const spikes = level >= 7;
  const horns = level >= 8;
  if (level >= 10) return { metal: tier(10), trim: SHADES.steel, accent: CRIMSON_STONE, spikes, horns };
  if (level === 9) return { metal: SHADES.gold, trim: SHADES.steel, accent: tier(9), spikes, horns };
  return { metal: SHADES.steel, trim: SHADES.gold, accent: tier(level), spikes, horns };
}

/** The figure's turn after a drag of `dx` CSS pixels (right turns it towards the right of the picture). */
export function turnBy(angle: number, dx: number): number {
  return angle + dx * TURN_PER_PX;
}

/** The turn eased `ms` towards `rest` the shorter way round; `rest` itself once close enough. */
export function settle(angle: number, rest: number, ms: number): number {
  const off = Math.atan2(Math.sin(angle - rest), Math.cos(angle - rest)) * 0.5 ** (ms / SETTLE_HALF_LIFE_MS);
  return Math.abs(off) < SETTLED ? rest : rest + off;
}

/** The arms' angles `share` of the way through an action (0 to 1, eased between its keyframes); at rest outside it. */
export function actionAngles(kind: FigureAction, share: number): ArmAngles {
  const keys = ACTION_KEYS[kind];
  if (share <= 0 || share >= 1) return [0, 0, 0];
  for (const [i, b] of keys.entries()) {
    const a = keys[i - 1];
    if (!a || share > b[0]) continue;
    const t = (share - a[0]) / (b[0] - a[0]);
    const e = t * t * (3 - 2 * t);
    return [a[1] + (b[1] - a[1]) * e, a[2] + (b[2] - a[2]) * e, a[3] + (b[3] - a[3]) * e];
  }
  return [0, 0, 0];
}

/**
 * Pose a figure at `ms` (null: still, as with reduced motion): the upper body lifted a pixel for part of each breath,
 * the cape or the wings stirring, level 10's stones glowing, all in time with the 2D figure; and the arms as `acting`
 * has them, `ms` being on the same clock.
 */
export function poseFigure(model: FigureModel, ms: number | null, acting: Acting | null) {
  const wave = ms === null ? 0 : Math.sin((2 * Math.PI * ms) / SWAY_MS);
  model.upper.position.y = ms === null ? 0 : -breathLift(ms);
  for (const { group, side } of model.back)
    if (side === 0) group.rotation.x = BACK.capeTilt + BACK.capeStir * wave;
    else group.rotation.y = side * (BACK.wingSpread + BACK.wingFlap * wave);
  for (const m of model.glow) {
    const glow = m.uniforms.glow;
    if (glow) glow.value = ms === null ? 0 : glowAlpha(ms) * GLOW_STRENGTH;
  }
  const [swordX, swordZ, shieldX] = acting && ms !== null ? actionAngles(acting.kind, (ms - acting.at) / ACTION_MS) : [0, 0, 0];
  model.swordArm.rotation.set(swordX, 0, swordZ);
  model.shieldArm.rotation.set(shieldX, 0, 0);
}

const colour = ([r, g, b]: Rgb) => new Vector3(r / 255, g / 255, b / 255);

/** A material lit in bands: its lit, mid or shaded colour by how the surface faces the light, as the sprites are shaded. */
export function toonMaterial([hi, mid, dark]: Shades): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: TOON_VERTEX,
    fragmentShader: TOON_FRAGMENT,
    uniforms: {
      hi: { value: colour(hi) },
      mid: { value: colour(mid) },
      dark: { value: colour(dark) },
      light: { value: new Vector3(...LIGHT).normalize() },
      bands: { value: new Vector2(BANDS.lit, BANDS.mid) },
      glow: { value: 0 },
      glowColour: { value: colour(GLOW_RGB) },
    },
  });
}

/**
 * The hero wearing its gear at `level` (docs/features/hero-3d.md), built from simple shapes in render pixels: feet at
 * 0, facing +z, its right (the sword arm) towards -x. Every piece follows the 2D figure's ladder (tools/art/figure/),
 * level by level, and is a mesh named after its part. The ring isn't shown and the mount only as its icon, as in 2D.
 * The parts that move hang from groups of their own (`FigureModel`): the arms from joints at the shoulders.
 */
export function buildFigure(body: FigureBody, level: number): FigureModel {
  const L = gearLook(level);
  const build = BUILDS[body.sex];
  const female = body.sex === Sex.FEMALE;
  const skin = SKIN_TONES[body.tone];
  const hair = HAIR_COLOURS[body.hair];
  const open = level <= 0;
  const { ankle, knee, hip, waist, shoulder, neck, head, headR, hipX, shoulderX } = BODY;
  const figure = new Group();
  // where the next pieces go: the root (legs and hips), the upper body, an arm
  let into: Object3D = figure;
  const upper = new Group();
  upper.name = 'upper';
  figure.add(upper);
  // a joint turning about `pivot`, its pieces placed in the figure's own space
  const joint = (name: string, pivot: Vec) => {
    const j = new Group();
    j.name = name;
    j.position.set(...pivot);
    upper.add(j);
    const inner = new Group();
    inner.position.set(-pivot[0], -pivot[1], -pivot[2]);
    j.add(inner);
    return { joint: j, inner };
  };
  const back: FigureModel['back'] = [];

  // one material per set of shades, shared by every mesh in it
  const materials = new Map<string, ShaderMaterial>();
  const material = (shades: Shades) => {
    const key = shades.flat().join();
    const known = materials.get(key);
    if (known) return known;
    const made = toonMaterial(shades);
    materials.set(key, made);
    return made;
  };
  const add = (name: string, geometry: BufferGeometry, shades: Shades, at: Vec, scale: Vec = [1, 1, 1], parent: Object3D = into) => {
    const mesh = new Mesh(geometry, material(shades));
    mesh.name = name;
    mesh.position.set(...at);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  };
  const ball = (name: string, at: Vec, r: number, shades: Shades, scale?: Vec, parent?: Object3D) =>
    add(name, new SphereGeometry(r, 10, 7), shades, at, scale, parent);
  const box = (name: string, at: Vec, size: Vec, shades: Shades, parent?: Object3D) => add(name, new BoxGeometry(...size), shades, at, undefined, parent);
  // a flat disc facing the front, `r` across and `tall` times as high
  const disc = (r: number, thick: number, tall = 1, sides = 10) => new CylinderGeometry(r, r, thick, sides).rotateX(Math.PI / 2).scale(1, tall, 1);
  // a flat shape facing the front, from its outline's points
  const plate = (pts: readonly (readonly [number, number])[], thick: number) =>
    new ExtrudeGeometry(new Shape(pts.map(([x, y]) => new Vector2(x, y))), { depth: thick, bevelEnabled: false }).translate(0, 0, -thick / 2);
  // a shape stood along a line from one point to another, centred on it
  const along = (name: string, geometry: BufferGeometry, from: Vec, to: Vec, shades: Shades, parent?: Object3D) => {
    const a = new Vector3(...from);
    const dir = new Vector3(...to).sub(a);
    const mesh = add(name, geometry, shades, [a.x + dir.x / 2, a.y + dir.y / 2, a.z + dir.z / 2], undefined, parent);
    mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    return mesh;
  };
  const length = (from: Vec, to: Vec) => new Vector3(...to).distanceTo(new Vector3(...from));
  // a tapered limb, r0 wide at `from` and r1 at `to`
  const limb = (name: string, from: Vec, to: Vec, r0: number, r1: number, shades: Shades, parent?: Object3D) =>
    along(name, new CylinderGeometry(r1, r0, length(from, to), 8), from, to, shades, parent);
  const cone = (name: string, from: Vec, to: Vec, r: number, shades: Shades, parent?: Object3D) =>
    along(name, new ConeGeometry(r, length(from, to), 6), from, to, shades, parent);
  const bar = (name: string, from: Vec, to: Vec, width: number, depth: number, shades: Shades, parent?: Object3D) =>
    along(name, new BoxGeometry(width, length(from, to), depth), from, to, shades, parent);
  // a stone in a setting: a flat disc of `setting` with the gem standing out of it
  const stone = (name: string, at: Vec, r: number, setting: Shades, gem: Shades, parent?: Object3D) => {
    add(`${name} setting`, disc(r + 0.9, 0.8), setting, at, undefined, parent);
    ball(name, [at[0], at[1], at[2] + 0.5], r, gem, [1, 1, 0.7], parent);
  };
  // the breastplate's front surface at a height, for what lies on it
  const chestH = shoulder + 1 - waist;
  const chestFront = (y: number) => (build.waist + ((build.chest - build.waist) * (y - waist)) / chestH) * 0.62;

  // ---- legs: the leg cloth from hip to ankle, plates and knee guards as the level climbs, and boots
  const legCloth = level <= 0 ? SHADES.cloth : level === 1 ? SHADES.flower : level === 2 ? SHADES.hood : level >= 10 ? L.metal : L.accent;
  const legPlate = level <= 0 ? SHADES.blue : level <= 2 ? SHADES.steel : L.metal;
  for (const side of [-1, 1]) {
    const x = side * hipX;
    const kx = x + side * 0.5;
    limb('thigh', [x, hip, 0], [kx, knee, 0.5], build.thigh, build.thigh * 0.8, legCloth);
    limb('shin', [kx, knee, 0.5], [kx, ankle + 2, 0], build.calf, build.calf * 0.85, legCloth);
    if (level >= 6)
      limb('thigh plate', [x, hip - 4, 0.3], [kx, knee + 5, 0.6], build.thigh + 0.4, build.thigh * 0.85 + 0.4, level >= 10 ? SHADES.steel : legPlate);
    if (level >= 3) {
      ball('knee', [kx, knee, build.calf + 0.8], 3.4, L.trim, [1, 0.9, 0.6]);
      ball('knee plate', [kx, knee, build.calf + 1.8], 2, level >= 9 ? L.trim : SHADES.steel, [1, 0.9, 0.6]);
    }
    if (level >= 7) cone('knee spike', [kx, knee + 1, build.calf + 2], [kx + side * 0.5, knee + 5, build.calf + 6], 1.2, L.trim);
    if (level === 2)
      for (const dx of [-1, 1]) bar('lacing', [kx - dx * 2.5, knee - 3, build.calf], [kx + dx * 2.5, knee - 8, build.calf], 0.9, 0.6, flat(SHADES.steel[0]));
    // the boot: a shaft to the sole and a foot pointing forward
    const shaft = level <= 0 ? SHADES.blue : level <= 2 ? SHADES.steel : L.metal;
    limb('boot', [kx, ankle + 4, 0], [kx, 1.5, 0.5], build.calf + 0.3, build.calf + 0.9, shaft);
    box('foot', [kx, 2, 4], [7.5, 4, 10], level <= 0 ? SHADES.whiteFoot : shaft);
    if (level <= 0 || level >= 3)
      limb('boot cuff', [kx, ankle + 4.8, 0], [kx, ankle + 3, 0.1], build.calf + 0.8, build.calf + 0.8, level <= 0 ? SHADES.gold : L.trim);
    if (level >= 3) stone('ankle stone', [kx + side * 1.5, ankle - 1, build.calf + 1.6], 1, L.trim, L.accent);
  }
  // the hips, in the leg cloth below the plate armour, metal from 3; a leather band at 1
  add('hips', new CylinderGeometry(build.hips, build.hips + 1.2, 9, 10), level <= 2 ? legCloth : L.metal, [0, hip + 2.5, 0], [1, 1, 0.7]);
  if (level === 1) add('hip band', new CylinderGeometry(build.hips + 0.6, build.hips + 0.8, 2, 10), SHADES.leather, [0, hip - 0.5, 0], [1, 1, 0.72]);

  into = upper;
  // ---- chest: the breastplate (blue banded in gold at 0, plain steel at 1-2, trimmed from 3), its ridge, stone and collar
  const chestMetal = level <= 0 ? SHADES.blue : level <= 2 ? SHADES.steel : L.metal;
  const chestTrim = level <= 0 ? SHADES.gold : level <= 2 ? null : L.trim;
  add('breastplate', new CylinderGeometry(build.chest, build.waist, chestH, 12), chestMetal, [0, waist + chestH / 2, 0], [1, 1, 0.62]);
  if (chestTrim) {
    add('chest rim', new CylinderGeometry(build.chest + 0.4, build.chest + 0.2, 1.8, 12), chestTrim, [0, shoulder, 0], [1, 1, 0.64]);
    add('chest rim', new CylinderGeometry(build.waist + 0.5, build.waist + 0.4, 1.8, 12), chestTrim, [0, waist + 1.5, 0], [1, 1, 0.66]);
  }
  if (level <= 0)
    for (const y of [waist + 6, waist + 10, waist + 14, waist + 18]) {
      const r = chestFront(y) / 0.62 + 0.15;
      add('chest band', new CylinderGeometry(r, r, 0.9, 12), flat(SHADES.blue[2]), [0, y, 0], [1, 1, 0.63]);
    }
  if (female) for (const side of [-1, 1]) ball('bust', [side * 4.6, shoulder - 9, chestFront(shoulder - 9) - 1.2], 4.2, chestMetal, [1, 0.85, 0.7]);
  if (level >= 1) {
    const from = female ? waist + 9 : shoulder - 5;
    bar('ridge', [0, from, chestFront(from) + 0.15], [0, waist + 2, chestFront(waist + 2) + 0.15], 1, 0.8, flat(chestMetal[2]));
  }
  if (level >= 3) {
    const y = female ? waist + 8 : waist + 10;
    stone('chest stone', [0, y, chestFront(y) + 0.3], 1.6 + level * 0.13, L.trim, L.accent);
  }
  if (level >= 6)
    for (const side of [-1, 1]) {
      const collar = box('collar', [side * 4.6, shoulder + 2.6, 2.5], [3.4, 6, 1.2], L.trim);
      collar.rotation.z = side * -0.35;
    }

  // ---- the neck, the head and, under level 0's open cap, the face and hair
  limb('neck', [0, shoulder - 1, 0], [0, neck + 2, 0], build.neck, build.neck * 0.95, skin);
  ball('head', [0, head, 0.5], headR, skin, build.head);
  if (open) {
    const front = headR * build.head[2] + 0.5;
    for (const side of [-1, 1]) {
      box('eye', [side * 3, head + 0.5, front - 1.6], [1.6, 1.8, 1], flat(COLOURS.outline));
      if (!female) box('brow', [side * 3, head + 2.6, front - 1.8], [3, 1, 1], flat(COLOURS.brow));
    }
    box('nose', [0, head - 1.5, front - 0.4], [1.6, 2.4, 1.6], skin);
    if (female) box('lips', [0, head - 4.6, front - 1.6], [3, 1.2, 1], flat(COLOURS.lips));
    ball('hair', [0, head + 0.8, -2], headR + 0.3, hair, [build.head[0] * 1.02, build.head[1], 1]);
    if (body.style === FigureHairStyle.BEARD) ball('beard', [0, head - 5.5, 1.8], 5.6, hair, [build.head[0], 0.7, 1]);
  }
  // a woman's hair shows below the helm at every level: loose down the back and over the near shoulder, or a braid
  if (body.style === FigureHairStyle.LOOSE) {
    bar('hair', [0, head - 2, -5.5], [0, shoulder - 14, -9.5], 9, 2.5, hair);
    limb('hair', [-6, head - 3, 1], [-9, shoulder - 10, 7.5], 2.4, 1.6, hair);
  }
  if (body.style === FigureHairStyle.BRAID) {
    const from: Vec = [-6, head - 4, -1];
    const to: Vec = [-8.5, shoulder - 15, 8.5];
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      ball('braid', [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t], 2.1 - t * 0.5, hair);
    }
    ball('braid tie', [to[0], to[1] - 2, to[2]], 1.4, flat(COLOURS.tie));
  }

  // ---- the helm: a blue cap rimmed in gold at 0; closed from 1 (a slit, a T slit from 2), trimmed with a crest from 3,
  // a plume from 4, wing spikes at 6-7, horns from 8
  const helmMetal = level <= 0 ? SHADES.blue : level <= 2 ? SHADES.steel : L.metal;
  const shellR = headR + 1.4;
  const top = head - 0.5 + shellR * 1.18;
  if (open) {
    add('helm', new SphereGeometry(headR + 1, 10, 6, 0, 2 * Math.PI, 0, Math.PI * 0.42), helmMetal, [0, head + 1.2, 0.3]);
    add('helm rim', new CylinderGeometry(headR + 0.4, headR + 0.6, 1.6, 12), SHADES.gold, [0, head + 3.4, 0.3]);
  } else {
    ball('helm', [0, head - 0.5, 0.4], shellR, helmMetal, [1, 1.18, 1.04]);
    const front = shellR * 1.04 + 0.4;
    const slit = level >= 10 ? flat(tier(10)[0]) : flat(tier(0)[2]);
    box('eye slit', [1, head + 0.5, front - 1.1], [9, level <= 1 ? 2 : 1.4, 1.2], slit);
    if (level >= 2) box('eye slit', [1.5, head - 3, front - 1.6], [1.4, 7, 1.2], slit);
    if (level <= 2)
      for (const dx of [-2.2, 2.6]) for (const dy of [-6, -8.5]) box('breathing hole', [dx, head + dy, front - 2.6], [1.3, 1.3, 1], flat(SHADES.steel[2]));
    if (level >= 3) {
      add('helm rim', new CylinderGeometry(shellR + 0.2, shellR + 0.3, 1.6, 14), L.trim, [0, head + 4, 0.4], [1, 1, 1.04]);
      box('crest', [0, top - 0.6, 0.4], [1.4, 1.8, shellR * 1.4], flat(L.trim[1]));
    }
  }
  if (level >= 4) {
    const end: Vec = L.horns ? [0, top - 6, -15] : [0, top - 1, -15];
    limb('plume', [0, top - 0.5, 2], [0, top + 1.5, -6], 1.9, 1.6, L.accent);
    limb('plume', [0, top + 1.5, -6], end, 1.6, 0.6, L.accent);
  }
  if (level === 6 || level === 7)
    for (const side of [-1, 1]) {
      cone('helm wing', [side * 5, head + 3, -6.5], [side * 8, head + 11, -11], 1, L.trim);
      cone('helm wing', [side * 5.5, head - 1, -6.5], [side * 8.5, head + 5, -10.5], 0.9, L.trim);
    }
  if (L.horns)
    for (const side of [-1, 1]) {
      limb('horn', [side * 8, head + 4, 0], [side * 13, head + 10, 0], 2.6, 1.8, L.trim);
      cone('horn', [side * 13, head + 10, 0], [side * 14.5, head + 16, 0], 1.8, L.trim);
    }

  // ---- pauldrons: a dome over a lower plate, edged; cloth hanging below at 0 and from 5; a ridge at 2; a stone on the
  // near one from 3, spikes from 6, a horn on the near one from 8
  const pauldron = level <= 0 ? SHADES.blue : level === 1 ? SHADES.iron : level === 2 ? SHADES.steel : L.metal;
  const edge = level <= 0 ? SHADES.gold : level <= 2 ? flat(SHADES.steel[2]) : L.trim;
  for (const side of [-1, 1]) {
    const px = side * shoulderX;
    ball('pauldron', [px, shoulder - 1, 0], 6.2, pauldron, [1, 0.75, 1.05]);
    ball('pauldron', [px * 1.04, shoulder - 4.5, 0], 5.9, pauldron, [1, 0.45, 1]);
    add('pauldron edge', new CylinderGeometry(6.1, 6.1, 1.2, 10), edge, [px * 1.04, shoulder - 6, 0]);
    if (level <= 0 || level >= 5)
      add('pauldron cloth', new CylinderGeometry(5.6, 6.3, 5, 10), level <= 0 ? SHADES.cloth : L.accent, [px * 1.04, shoulder - 9, 0]);
    if (level === 2) box('pauldron ridge', [px, shoulder + 3.4, 0], [1, 1, 10], flat(SHADES.steel[2]));
    if (level >= 6) cone('pauldron spike', [side * (shoulderX + 4), shoulder + 1, 0], [side * (shoulderX + 9), shoulder + 4, 0], 1.3, L.trim);
  }
  if (level >= 3) stone('pauldron stone', [-shoulderX - 1, shoulder - 1, 6.6], 0.9 + level * 0.07, L.trim, L.accent);
  if (L.horns) cone('pauldron horn', [-shoulderX - 1, shoulder + 3, 0], [-shoulderX - 7, shoulder + 11, -1], 2.4, L.trim);

  // ---- arms: sleeves of cloth (0-2) or mail, bracers by level, a cuff at 0 and from 3, the fist bare at 0 and 2
  const sleeve = level <= 2 ? SHADES.cloth : SHADES.mail;
  const bracer = level <= 0 ? SHADES.blue : level === 1 ? SHADES.steel : level === 2 ? SHADES.darkSteel : L.metal;
  const fist = level === 0 || level === 2 ? skin : bracer;
  const cuff = level <= 0 ? SHADES.gold : level >= 3 ? L.trim : null;
  const swordArm = joint('sword arm', [-shoulderX - 0.5, shoulder - 3, 0]);
  const shieldArm = joint('shield arm', [shoulderX + 0.5, shoulder - 3, 0]);
  into = swordArm.inner;
  limb('arm', [-shoulderX - 0.5, shoulder - 3, 0], [-19, 64, 3], 4.2, 3.6, sleeve);
  limb('bracer', [-19, 64, 3], [-18, 57, 10], 3.9, 3.6, bracer);
  if (cuff) limb('cuff', [-18.3, 58.6, 8.8], [-18, 56.6, 10.6], 4.2, 4.2, cuff);
  if (level >= 3) stone('elbow stone', [-19.6, 63, 6.8], 0.9 + level * 0.05, L.trim, L.accent);
  if (L.spikes) cone('elbow spike', [-19.5, 64, 0], [-20.5, 64.5, -5.5], 1.1, cuff ?? L.trim);
  if (L.horns) cone('elbow horn', [-20, 65.5, 1], [-23.5, 71, -3], 1.8, L.trim);
  ball('fist', [-18, 55, 11.4], 3.7, fist);
  into = shieldArm.inner;
  limb('arm', [shoulderX + 0.5, shoulder - 3, 0], [19, 64, 2], 3.9, 3.4, sleeve);
  limb('bracer', [19, 64, 2], [18, 58, 8], 3.4, 3.1, bracer);
  ball('hand', [18, 57, 9], 2.8, fist);

  into = swordArm.inner;
  // ---- the sword in the near fist, raised point up and leaning out: wood at 0, steel, bright steel at 9, crimson at 10;
  // its guard turns up at the ends from 3 and grows horns from 8; a fuller from 1 (glowing from 6), runes from 5
  const blade = level <= 0 ? SHADES.wood : level >= 10 ? L.metal : level === 9 ? SHADES.brightSteel : SHADES.steel;
  const guard = level <= 0 ? SHADES.wood : level <= 2 ? SHADES.iron : L.trim;
  const [gx, gy, gz] = [-18, 59.5, 11.4];
  const width = level <= 0 ? 4.4 : 4.6 + Math.min(level, 8) * 0.15;
  const tip: Vec = [-22, 93 + Math.min(level, 8) * 0.33, gz];
  const shoulderOfPoint: Vec = [tip[0] + 0.4, tip[1] - 4.5, gz];
  bar('blade', [gx, gy + 0.8, gz], shoulderOfPoint, width, 1.3, blade);
  cone('point', shoulderOfPoint, tip, width * 0.55, blade);
  const half = (level <= 0 ? 3 : 4 + Math.min(level, 6) * 0.3) * 1.2;
  box('guard', [gx, gy, gz], [half * 2, 2.4, 2.8], guard);
  if (level >= 3) for (const side of [-1, 1]) box('guard end', [gx + side * (half - 0.8), gy + 1.8, gz], [1.8, 3.6, 2.8], guard);
  if (L.horns) for (const side of [-1, 1]) cone('guard horn', [gx + side * half, gy + 1, gz], [gx + side * (half + 3.5), gy + 7, gz], 1.2, guard);
  limb('grip', [gx, gy - 8, gz], [gx, gy - 1, gz], 1.3, 1.3, SHADES.leather);
  ball('pommel', [gx, gy - 8.5, gz], 2.1, guard);
  if (level >= 3) ball('pommel stone', [gx, gy - 8.5, gz + 1.9], 0.9, L.accent);
  const onBlade = (t: number, dx = 0): Vec => [gx + (shoulderOfPoint[0] - gx) * t + dx, gy + 0.8 + (shoulderOfPoint[1] - gy - 0.8) * t, gz + 0.7];
  if (level >= 1) bar('fuller', onBlade(0.08), onBlade(0.8), 1.1, 0.3, level >= 6 ? flat(L.accent[0]) : flat(blade[2]));
  if (level >= 5) for (const t of [0.3, 0.45, 0.6]) box('rune', onBlade(t, 1.4), [0.9, 1.1, 0.3], flat(L.accent[1]));
  if (level >= 10) bar('blade edge', onBlade(0, -width / 2 + 0.4), onBlade(1, -width / 2 + 0.4), 0.8, 0.3, flat(SHADES.steel[0]));

  // ---- the shield on the far arm: round wood rimmed in iron at 0; a kite from 1, rimmed from 2, a boss stone from 3,
  // a cross from 5, corner spikes from 7
  const shield = new Group();
  shield.position.set(21, 61, 11);
  shield.rotation.y = 0.45;
  shieldArm.inner.add(shield);
  if (level <= 0) {
    add('shield rim', disc(8.8, 1.6, 1.38, 12), SHADES.iron, [0, 0, -0.6], undefined, shield);
    add('shield', disc(7.4, 2, 1.38, 12), SHADES.wood, [0, 0, 0], undefined, shield);
    box('plank seam', [-2, 0, 1.05], [0.9, 18, 0.4], flat(COLOURS.seam), shield);
    ball('boss', [0, 0, 1.2], 2.2, SHADES.iron, undefined, shield);
  } else {
    const kite = [
      [-9, 11],
      [9, 11],
      [10, 2],
      [0, -22],
      [-10, 2],
    ] as const;
    if (level >= 2) add('shield rim', plate(kite, 1.4), level === 2 ? SHADES.iron : L.trim, [0, -0.6, -0.6], [1.12, 1.08, 1], shield);
    add('shield', plate(kite, 2), level <= 2 ? SHADES.steel : L.metal, [0, 0, 0], undefined, shield);
    if (level >= 3) stone('shield stone', [0, 3, 1.2], (1 + level * 0.1) * 0.9, L.trim, L.accent, shield);
    if (level >= 5) {
      box('shield cross', [0, -2, 1.15], [1.3, 24, 0.4], flat(L.trim[1]), shield);
      box('shield cross', [0, 3, 1.15], [16, 1.3, 0.4], flat(L.trim[1]), shield);
    }
    if (L.spikes) for (const side of [-1, 1]) cone('shield spike', [side * 9, 11, 0], [side * 12.5, 15, 0], 1.1, L.trim, shield);
  }

  into = upper;
  // ---- belt and charm: a band by level with studs (2-8) and a buckle; the charm on a cord at the near hip
  const beltBand =
    level <= 0 ? SHADES.blue : level === 1 ? SHADES.blueBelt : level === 2 ? SHADES.hood : level <= 8 ? SHADES.leather : level === 9 ? SHADES.gold : L.metal;
  add('belt', new CylinderGeometry(build.belt, build.belt, 3.4, 12), beltBand, [0, waist, 0], [1, 1, 0.66]);
  const beltFront = (x: number) => build.belt * 0.66 * Math.sqrt(Math.max(0, 1 - (x / build.belt) ** 2));
  if (level >= 2 && level <= 8) for (const x of [-7.5, -4.5, 4.5, 7.5]) box('stud', [x, waist, beltFront(x) + 0.2], [1, 1, 0.8], flat(SHADES.steel[0]));
  box('buckle', [1.5, waist, beltFront(1.5) + 0.3], [5, 5, 1], level <= 0 ? SHADES.gold : level <= 2 ? SHADES.steel : L.trim);
  if (level >= 3) ball('buckle stone', [1.5, waist, beltFront(1.5) + 1], 1, L.accent);
  const cx = -7;
  const cz = beltFront(cx) + 0.6;
  box('charm cord', [cx, waist - 3.2, cz], [0.8, 3.6, 0.8], level <= 0 ? flat(SHADES.banner[1]) : level <= 2 ? flat(SHADES.steel[0]) : flat(L.trim[0]));
  const charmAt: Vec = [cx, waist - 6.8, cz + 0.3];
  if (level <= 0) box('charm', charmAt, [4, 5.5, 1.2], SHADES.gold);
  else if (level === 1) add('charm', disc(2.1, 0.9), SHADES.wool, charmAt);
  else if (level === 2) add('charm', disc(2.1, 0.9), SHADES.steel, charmAt);
  else if (level <= 9) stone('charm', charmAt, (0.9 + level * 0.06) * 1.3, L.trim, L.accent);
  else add('charm', new OctahedronGeometry(2.6), [tier(10)[0], tier(10)[0], tier(10)[1]] as const, charmAt, [1, 1.6, 0.7]);

  // ---- the necklace: a chain dipping over the breastplate with its pendant; a red cord and amber at 0, plain silver
  // at 1, a small disc at 2, a stone from 3, a silver heart round a crimson one at 10
  const chain = level <= 0 ? SHADES.cord : level <= 2 ? SHADES.brightSteel : ([L.trim[0], L.trim[0], L.trim[2]] as const);
  const chainZ = chestFront(shoulder) + 0.4;
  const necklace = add('necklace', new TorusGeometry(5.2, 0.55, 4, 10, Math.PI), chain, [0, shoulder + 0.5, chainZ]);
  necklace.rotation.z = Math.PI;
  const pendant: Vec = [0, shoulder - 6.4, chestFront(shoulder - 6.4) + 0.9];
  if (level <= 0) add('pendant', disc(1.7, 0.9), SHADES.amber, pendant);
  else if (level === 2) add('pendant', disc(1.3, 0.8), SHADES.steel, pendant);
  else if (level >= 3 && level <= 9) stone('pendant', pendant, (0.7 + level * 0.07) * 1.3, L.trim, L.accent);
  else if (level >= 10) {
    ball('pendant', pendant, 2.6, SHADES.steel, [1, 1, 0.5]);
    ball('pendant', [pendant[0], pendant[1], pendant[2] + 0.8], 1.6, [tier(10)[1], tier(10)[1], tier(10)[2]] as const, [1, 1, 0.6]);
  }

  into = figure;
  // ---- the back: a cape hung from a rod (0) or a collar, edged from 5, torn from 8; bat wings instead at 10
  if (level >= 10) {
    const panels = [
      [tier(10)[0], tier(10)[0], tier(10)[1]],
      [tier(10)[1], tier(10)[1], tier(10)[2]],
    ] as const;
    for (const side of [-1, 1]) {
      const wing = new Group();
      wing.position.set(side * 3, shoulder - 6, -9);
      wing.rotation.y = side * BACK.wingSpread;
      figure.add(wing);
      back.push({ group: wing, side });
      const root = [0, 0] as const;
      const tips = [
        [side * 20, 18],
        [side * 24, 2],
        [side * 18, -12],
        [side * 9, -20],
      ] as const;
      const notches = [
        [side * 15, 6],
        [side * 16, -5],
        [side * 10, -10],
      ] as const;
      for (const [i, notch] of notches.entries()) {
        const a = tips[i];
        const b = tips[i + 1];
        if (a && b) add('wing', plate([root, a, notch, b], 0.8), panels[i % 2] ?? panels[0], [0, 0, 0], undefined, wing);
      }
      for (const t of tips.slice(0, 3)) bar('wing bone', [0, 0, 0], [t[0], t[1], 0], 0.9, 1.6, flat(tier(0)[2]), wing);
      cone('wing claw', [side * 20, 18, 0], [side * 22, 22, 0], 0.9, SHADES.steel, wing);
    }
  } else {
    const cloth = level <= 0 ? SHADES.blue : level === 1 ? SHADES.banner : level === 2 ? SHADES.hood : L.accent;
    const cape = new Group();
    cape.position.set(0, shoulder + 1, -9.5);
    cape.rotation.x = BACK.capeTilt;
    figure.add(cape);
    back.push({ group: cape, side: 0 });
    const hem: (readonly [number, number])[] =
      level >= 8
        ? [
            [17, -40],
            [13, -36],
            [9, -41],
            [5, -37],
            [0, -41],
            [-5, -37],
            [-9, -41],
            [-13, -36],
            [-17, -40],
          ]
        : [
            [17, -40],
            [-17, -40],
          ];
    add('cape', plate([[-11, 0], [11, 0], ...hem], 1.2), cloth, [0, 0, 0], undefined, cape);
    if (level <= 0) for (const x of [-8, 0, 8]) bar('cape stripe', [x * 0.8, -2, -0.7], [x * 1.3, -38, -0.7], 1.4, 0.3, flat(SHADES.cloth[0]), cape);
    if (level >= 5) for (const side of [-1, 1]) bar('cape edge', [side * 11, 0, -0.7], [side * 17, -39, -0.7], 1.4, 0.4, flat(L.trim[1]), cape);
    if (level <= 0) box('cape rod', [0, shoulder + 1, -9.8], [26, 1.6, 1.6], SHADES.rod);
    else add('cape collar', new CylinderGeometry(8, 8.6, 2.4, 12), level <= 2 ? SHADES.steel : L.trim, [0, shoulder + 1.5, -0.6], [1, 1, 0.78]);
  }
  // level 10's stones glow
  const glow = level >= 10 ? [material(L.accent)] : [];
  return { root: figure, upper, swordArm: swordArm.joint, shieldArm: shieldArm.joint, back, glow };
}

/** Free a figure's geometries and materials (the GPU's copies too) once it is no longer drawn. */
export function disposeFigure(figure: Object3D) {
  figure.traverse((o) => {
    if (o instanceof Mesh) {
      (o.geometry as BufferGeometry).dispose();
      (o.material as ShaderMaterial).dispose();
    }
  });
}
