import type { Group, ShaderMaterial } from 'three';
import type { FigureAction } from '@/components/heroes-panel/hero-sheet/character-sheet/paper-doll/hero-figure-3d/constants';

/** A colour as red, green and blue, 0–255: one of the base colours (lib/palette.ts). */
export type Rgb = readonly [number, number, number];

/** Three shades of a material: lit, mid and shaded, as the art scripts' `Shades`. */
export type Shades = readonly [Rgb, Rgb, Rgb];

/** A point in the figure's space, in render pixels: x to the hero's left (the picture's right), y up, z to its front. */
export type Vec = readonly [number, number, number];

/** A gear level's metal, trim and stones, as the icons' `look(level)` (tools/art/gear/common.ts); levels 0-2 dress in sets of their own. */
export interface GearLook {
  metal: Shades;
  trim: Shades;
  accent: Shades;
  /** spikes from level 7, horns from level 8 */
  spikes: boolean;
  horns: boolean;
}

/** A body's build in render pixels: where the woman's cut differs from the man's. */
export interface Build {
  /** the breastplate's half-width at the shoulders and at the waist */
  chest: number;
  waist: number;
  belt: number;
  /** the hips' half-width at the top */
  hips: number;
  thigh: number;
  calf: number;
  neck: number;
  /** the head's scale across, up and front to back */
  head: Vec;
}

/** What the figure does on a tap, one in turn. */

/** An action under way: which, and when it started (the animation clock, ms). */
export interface Acting {
  kind: FigureAction;
  at: number;
}

/** The figure's arm angles at a moment of an action, in radians: the sword arm about x and z, the shield arm about x. */
export type ArmAngles = readonly [swordX: number, swordZ: number, shieldX: number];

/** A built figure: its root (turned), and the parts that move: the upper body (it breathes), the arms (they act), what hangs at its back (it stirs), and the materials that glow. */
export interface FigureModel {
  root: Group;
  upper: Group;
  swordArm: Group;
  shieldArm: Group;
  /** the cape (side 0), or each bat wing (side -1 or 1) */
  back: { group: Group; side: number }[];
  glow: ShaderMaterial[];
}
