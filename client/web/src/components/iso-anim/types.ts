import type { SpotKind } from '@marchlands/core';
import type { PixelArt } from '@/components/iso-viewport/types';

/** A colour as red, green and blue. */
export type Rgb = readonly [number, number, number];

/**
 * Where something that moves stands on a sprite (assets/spots.json, written by tools/art/pixel.ts): its kind, the
 * sprite's pixel, and its size where it has one (a sail's length, a wheel's radius, a window's height, a field's width
 * and depth in world units).
 */
export interface Spot {
  k: SpotKind;
  x: number;
  y: number;
  n?: number;
  m?: number;
}

/** Where on a sprite something is placed: a spot's pixel, or the middle of the ground for a sprite with no spot for it. */
export type SpotPoint = Pick<Spot, 'x' | 'y'>;

/** An animation frame and its anchor: the frame's pixel that sits on the spot (it may lie outside the frame). */
export interface Frame {
  art: PixelArt;
  ax: number;
  ay: number;
  /** it gives light (a flame, a lit window): drawn over the night's darkness */
  light?: boolean;
}

/** A point of a grid, by column and row (fractional between tiles). */
export interface GridSpot {
  col: number;
  row: number;
}

/** Where people can walk on a grid: the points where its streets cross, and which points each joins (by index). */
export interface Streets {
  nodes: GridSpot[];
  links: number[][];
}

/** What a city is doing, for the buildings that show it (components/buildings-panel/hooks.ts, useTownState). */
export interface TownState {
  /** barracks positions whose training queue is running */
  training: readonly number[];
  /** cavalry or cataphracts are being trained */
  cavalry: boolean;
  /** siege engines (ballistae, rams, catapults) are being trained */
  siege: boolean;
  /** research is running in this city */
  research: boolean;
  /** fortifications are being built */
  forts: boolean;
  /** the city has injured troops to heal */
  injured: boolean;
  /** an enemy army is on its way to this city */
  enemy: boolean;
  /** one of this city's armies is away */
  armyOut: boolean;
  /** the state (zone) it stands in, whose weather it shares */
  zoneId: number;
  /** when it was last attacked (ms, real time), if one of the latest army reports says so */
  attackedAt: number | null;
}

/** An army on the map, as the armies list gives it: where it set out from and goes (tile ids), and when. */
export interface Marching {
  armyId: number;
  startFieldId: number;
  targetFieldId: number;
  startTime: number;
  reachTime: number;
  /** ArmyDirection: 1 going out, 2 coming back, 3 staying */
  direction: number;
}

/** Whose army it is, which sets its banner's colour. */

/** A sprite in the scene that may carry animations: where it stands, how big it is, and its file in spots.json. */
export interface Animated {
  key: string;
  col: number;
  row: number;
  /** the sprite's size in pixels (64 when left out) */
  size?: number;
  /** its key in spots.json: `buildings/forge-2.png` */
  file: string;
}
