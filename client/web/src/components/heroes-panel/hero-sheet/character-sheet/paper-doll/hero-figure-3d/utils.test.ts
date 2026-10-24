import { type BufferGeometry, Mesh, type Object3D, ShaderMaterial, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';

import { Sex } from '@marchlands/core';

import type { FigureBody } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/types';
import { breathLift, glowAlpha } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure/utils';
import {
  ACTION_KEYS,
  ACTION_MS,
  CAMERA,
  FIGURE_ACTIONS,
  GEAR_TIERS,
  GLOW_STRENGTH,
  RENDER_SIZE,
  REST_ANGLE,
  SETTLE_HALF_LIFE_MS,
  SHADES,
  TURN_PER_PX,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/constants';
import {
  actionAngles,
  buildFigure,
  disposeFigure,
  gearLook,
  poseFigure,
  settle,
  toonMaterial,
  turnBy,
} from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/utils';
import { FIGURE_HAIR_COLOURS, FIGURE_HAIR_STYLES, FIGURE_SKIN_TONES } from '@/lib/game-art';

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAN: FigureBody = { sex: Sex.MALE, tone: 'fair', style: 'beard', hair: 'brown' };
const WOMAN: FigureBody = { sex: Sex.FEMALE, tone: 'olive', style: 'braid', hair: 'auburn' };
/** Every body the heroes can have: each sex with each of its hairstyles, the tones and colours taken in turn. */
const BODIES: FigureBody[] = [Sex.MALE, Sex.FEMALE].flatMap((sex) =>
  FIGURE_HAIR_STYLES[sex].map((style, i) => ({
    sex,
    style,
    tone: FIGURE_SKIN_TONES[(sex * 2 + i) % FIGURE_SKIN_TONES.length] ?? 'fair',
    hair: FIGURE_HAIR_COLOURS[(sex * 2 + i) % FIGURE_HAIR_COLOURS.length] ?? 'brown',
  })),
);

/** The names of a figure's meshes. */
const parts = (figure: Object3D) => {
  const names: string[] = [];
  figure.traverse((o) => {
    if (o instanceof Mesh) names.push(o.name);
  });
  return names;
};
const has = (body: FigureBody, level: number, name: string) => parts(buildFigure(body, level).root).includes(name);
/** The levels from 0 to 10 at which a figure has the part. */
const levelsWith = (body: FigureBody, name: string) => LEVELS.filter((l) => has(body, l, name));

/** Every vertex of a figure where it stands, turned by `angle`. */
function corners(figure: Object3D, angle: number): Vector3[] {
  figure.rotation.y = angle;
  figure.updateMatrixWorld(true);
  const out: Vector3[] = [];
  figure.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    const pos = (o.geometry as BufferGeometry).getAttribute('position');
    for (let i = 0; i < pos.count; i++) out.push(new Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(o.matrixWorld));
  });
  return out;
}

describe(gearLook.name, () => {
  it('is steel trimmed in gold with the level’s colour up to 8', () => {
    expect(gearLook(5)).toEqual({ metal: SHADES.steel, trim: SHADES.gold, accent: GEAR_TIERS[5], spikes: false, horns: false });
  });

  it('gilds at 9 and turns crimson trimmed in silver at 10', () => {
    expect(gearLook(9)).toMatchObject({ metal: SHADES.gold, trim: SHADES.steel });
    expect(gearLook(10)).toMatchObject({ metal: GEAR_TIERS[10], trim: SHADES.steel });
  });

  it('adds spikes from 7 and horns from 8', () => {
    expect([6, 7, 8].map((l) => [gearLook(l).spikes, gearLook(l).horns])).toEqual([
      [false, false],
      [true, false],
      [true, true],
    ]);
  });

  it('keeps a level beyond 10 to level 10’s colours', () => {
    expect(gearLook(12).metal).toBe(GEAR_TIERS[10]);
  });
});

describe(turnBy.name, () => {
  it('turns by the drag, right turning towards the right of the picture', () => {
    expect(turnBy(1, 100)).toBeCloseTo(1 + 100 * TURN_PER_PX);
    expect(turnBy(1, -50)).toBeCloseTo(1 - 50 * TURN_PER_PX);
    expect(turnBy(1, 0)).toBe(1);
  });
});

describe(settle.name, () => {
  it('halves the way back every half-life', () => {
    expect(settle(REST_ANGLE + 1, REST_ANGLE, SETTLE_HALF_LIFE_MS)).toBeCloseTo(REST_ANGLE + 0.5);
    expect(settle(REST_ANGLE - 1, REST_ANGLE, 2 * SETTLE_HALF_LIFE_MS)).toBeCloseTo(REST_ANGLE - 0.25);
  });

  it('goes back the shorter way round after more than half a turn', () => {
    // a turn and a quarter on is a quarter on
    expect(settle(REST_ANGLE + 2.5 * Math.PI, REST_ANGLE, SETTLE_HALF_LIFE_MS)).toBeCloseTo(REST_ANGLE + Math.PI / 4);
  });

  it('stops exactly at rest once close enough', () => {
    expect(settle(REST_ANGLE + 0.001, REST_ANGLE, 16)).toBe(REST_ANGLE);
    expect(settle(REST_ANGLE, REST_ANGLE, 16)).toBe(REST_ANGLE);
  });
});

describe(actionAngles.name, () => {
  it('starts and ends at rest', () => {
    for (const kind of FIGURE_ACTIONS) {
      expect(actionAngles(kind, 0)).toEqual([0, 0, 0]);
      expect(actionAngles(kind, 1)).toEqual([0, 0, 0]);
      expect(actionAngles(kind, -0.5)).toEqual([0, 0, 0]);
      expect(actionAngles(kind, 1.5)).toEqual([0, 0, 0]);
    }
  });

  it('reaches each keyframe at its time', () => {
    for (const kind of FIGURE_ACTIONS)
      for (const [at, swordX, swordZ, shieldX] of ACTION_KEYS[kind].slice(1, -1)) {
        const [x, z, s] = actionAngles(kind, at);
        expect([x, z, s].map((v) => +v.toFixed(6))).toEqual([swordX, swordZ, shieldX]);
      }
  });

  it('eases between keyframes', () => {
    // the swing: drawn back by 0.3, struck by 0.55
    const [back] = actionAngles('swing', 0.15);
    expect(back).toBeLessThan(0);
    expect(back).toBeGreaterThan(-0.55);
    const [mid] = actionAngles('swing', 0.425);
    expect(mid).toBeCloseTo((-0.55 + 1.35) / 2);
  });

  it('moves only the shield arm for the shield, and only the sword arm otherwise', () => {
    expect(actionAngles('shield', 0.5)).toEqual([0, 0, -0.85]);
    expect(actionAngles('salute', 0.5)).toEqual([-0.5, 0.7, 0]);
  });
});

describe(poseFigure.name, () => {
  it('lifts the upper body a pixel for part of each breath, as the 2D figure', () => {
    const model = buildFigure(MAN, 5);
    for (const ms of [0, 1500, 2000, 3000]) {
      poseFigure(model, ms, null);
      expect(model.upper.position.y).toBe(-breathLift(ms));
    }
  });

  it('stirs the cape and flaps the wings round where they hang', () => {
    const caped = buildFigure(MAN, 5);
    poseFigure(caped, 700, null);
    const [cape] = caped.back;
    expect(cape?.side).toBe(0);
    expect(cape?.group.rotation.x).toBeGreaterThan(0.12);
    const winged = buildFigure(MAN, 10);
    poseFigure(winged, 700, null);
    expect(winged.back.map((b) => b.side)).toEqual([-1, 1]);
    for (const { group, side } of winged.back) expect(Math.abs(group.rotation.y)).toBeGreaterThan(0.6 * Math.abs(side));
  });

  it('glows level 10’s stones only', () => {
    expect(buildFigure(MAN, 9).glow).toEqual([]);
    const model = buildFigure(MAN, 10);
    poseFigure(model, 500, null);
    const [stones] = model.glow;
    expect(stones?.uniforms.glow?.value).toBeCloseTo(glowAlpha(500) * GLOW_STRENGTH);
  });

  it('turns the arms as the action has them', () => {
    const model = buildFigure(MAN, 5);
    poseFigure(model, 1000 + ACTION_MS / 2, { kind: 'shield', at: 1000 });
    expect(model.shieldArm.rotation.x).toBeCloseTo(-0.85);
    expect(model.swordArm.rotation.x).toBe(0);
    poseFigure(model, 1000 + ACTION_MS * 2, { kind: 'shield', at: 1000 });
    expect(model.shieldArm.rotation.x).toBe(0);
  });

  it('stands still in its rest pose with no time', () => {
    const model = buildFigure(MAN, 10);
    poseFigure(model, null, { kind: 'swing', at: 0 });
    expect(model.upper.position.y).toBe(0);
    expect(model.swordArm.rotation.x).toBe(0);
    expect(model.back.map((b) => b.group.rotation.y)).toEqual([-0.6, 0.6]);
    expect(model.glow[0]?.uniforms.glow?.value).toBe(0);
  });
});

describe(toonMaterial.name, () => {
  it('holds the three shades as colours from 0 to 1', () => {
    const m = toonMaterial(SHADES.steel);
    expect(m).toBeInstanceOf(ShaderMaterial);
    expect(m.uniforms.hi?.value).toMatchObject({ x: 226 / 255, y: 232 / 255, z: 240 / 255 });
    expect(m.uniforms.dark?.value).toMatchObject({ x: 110 / 255 });
  });
});

describe(buildFigure.name, () => {
  const always = [
    'thigh',
    'shin',
    'boot',
    'foot',
    'hips',
    'breastplate',
    'neck',
    'head',
    'helm',
    'pauldron',
    'arm',
    'bracer',
    'fist',
    'blade',
    'point',
    'guard',
    'grip',
    'pommel',
    'shield',
    'belt',
    'buckle',
    'charm',
    'charm cord',
    'necklace',
  ];

  it('builds every piece at every level for every body, every mesh in a toon material and in place', () => {
    for (const body of BODIES)
      for (const level of LEVELS) {
        const figure = buildFigure(body, level).root;
        expect(parts(figure)).toEqual(expect.arrayContaining(always));
        figure.traverse((o) => {
          if (o instanceof Mesh) expect(o.material).toBeInstanceOf(ShaderMaterial);
        });
        for (const v of corners(figure, REST_ANGLE)) expect([v.x, v.y, v.z].every(Number.isFinite)).toBe(true);
      }
  });

  it('stays inside the picture however far it is turned, at every moment of its actions', () => {
    const half = RENDER_SIZE / 2;
    for (const body of [MAN, WOMAN])
      for (const level of [0, 5, 8, 10])
        for (const angle of [0, REST_ANGLE, Math.PI / 2, Math.PI, -Math.PI / 2])
          for (const pose of [null, ...FIGURE_ACTIONS.flatMap((kind) => ACTION_KEYS[kind].map(([at]) => ({ kind, at })))]) {
            const model = buildFigure(body, level);
            if (pose) poseFigure(model, ACTION_MS * pose.at, { kind: pose.kind, at: 0 });
            const vs = corners(model.root, angle);
            // across the picture, and up it as the camera looks a little down (a point nearer the camera shows lower)
            expect(Math.max(...vs.map((v) => Math.abs(v.x)))).toBeLessThan(half - 2);
            const up = vs.map((v) => (v.y - CAMERA.target) * Math.cos(CAMERA.tilt) - v.z * Math.sin(CAMERA.tilt));
            expect(Math.max(...up)).toBeLessThan(half - 2);
            expect(Math.min(...up)).toBeGreaterThan(-half + 2);
          }
  });

  it('shows the face, hair and a beard under level 0’s open cap only', () => {
    expect(levelsWith(MAN, 'eye')).toEqual([0]);
    expect(levelsWith(MAN, 'beard')).toEqual([0]);
    expect(has({ ...MAN, style: 'short' }, 0, 'beard')).toBe(false);
    expect(has(MAN, 0, 'brow')).toBe(true);
    expect(has(WOMAN, 0, 'lips')).toBe(true);
  });

  it('shows a woman’s braid or loose hair below the helm at every level', () => {
    expect(levelsWith(WOMAN, 'braid')).toEqual(LEVELS);
    expect(levelsWith({ ...WOMAN, style: 'loose' }, 'hair')).toEqual(LEVELS);
    expect(levelsWith(MAN, 'braid')).toEqual([]);
  });

  it('gives a woman her own cut', () => {
    expect(has(WOMAN, 5, 'bust')).toBe(true);
    expect(has(MAN, 5, 'bust')).toBe(false);
  });

  it('climbs the helm’s ladder: closed from 1, a T slit from 2, a crest from 3, a plume from 4, wing spikes at 6-7, horns from 8', () => {
    expect(levelsWith(MAN, 'eye slit')).toEqual(LEVELS.slice(1));
    expect(levelsWith(MAN, 'breathing hole')).toEqual([1, 2]);
    expect(levelsWith(MAN, 'crest')).toEqual(LEVELS.slice(3));
    expect(levelsWith(MAN, 'plume')).toEqual(LEVELS.slice(4));
    expect(levelsWith(MAN, 'helm wing')).toEqual([6, 7]);
    expect(levelsWith(MAN, 'horn')).toEqual(LEVELS.slice(8));
  });

  it('adds stones from 3, spikes from their level and the bat wings in place of the cape at 10', () => {
    expect(levelsWith(MAN, 'chest stone')).toEqual(LEVELS.slice(3));
    expect(levelsWith(MAN, 'collar')).toEqual(LEVELS.slice(6));
    expect(levelsWith(MAN, 'pauldron spike')).toEqual(LEVELS.slice(6));
    expect(levelsWith(MAN, 'knee spike')).toEqual(LEVELS.slice(7));
    expect(levelsWith(MAN, 'thigh plate')).toEqual(LEVELS.slice(6));
    expect(levelsWith(MAN, 'cape')).toEqual(LEVELS.slice(0, 10));
    expect(levelsWith(MAN, 'wing')).toEqual([10]);
  });

  it('gives the sword a fuller from 1 and runes from 5, and the shield a cross from 5', () => {
    expect(levelsWith(MAN, 'fuller')).toEqual(LEVELS.slice(1));
    expect(levelsWith(MAN, 'rune')).toEqual(LEVELS.slice(5));
    expect(levelsWith(MAN, 'shield cross')).toEqual(LEVELS.slice(5));
    expect(levelsWith(MAN, 'plank seam')).toEqual([0]);
  });

  it('hangs a pendant on the necklace at every level but 1', () => {
    expect(levelsWith(MAN, 'pendant')).toEqual(LEVELS.filter((l) => l !== 1));
  });

  it('shares one material between the meshes of a material', () => {
    const materials = new Set<unknown>();
    const figure = buildFigure(MAN, 5).root;
    figure.traverse((o) => {
      if (o instanceof Mesh) materials.add(o.material);
    });
    expect(materials.size).toBeLessThan(parts(figure).length / 2);
  });
});

describe(disposeFigure.name, () => {
  it('frees every geometry and material', () => {
    const figure = buildFigure(WOMAN, 10).root;
    const freed = vi.fn();
    figure.traverse((o) => {
      if (o instanceof Mesh) (o.geometry as BufferGeometry).addEventListener('dispose', freed);
    });
    disposeFigure(figure);
    expect(freed).toHaveBeenCalledTimes(parts(figure).length);
  });
});
