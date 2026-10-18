// Game art (AGENTS.md, Client, Game art): one pixel-art sprite per building type and level band in
// src/assets/buildings/, the walls' frame pieces per level band in src/assets/walls/, one sprite per valley type and
// level band in src/assets/tiles/, and one sprite per troop and fortification type in src/assets/units/. The art scripts in tools/art
// import this file, so it uses no `@/` imports.

import { buildingConfig, BuildingType, FortType, TileType, TroopType, VALLEY_TYPES } from '@marchlands/core';

/** The level bands the art changes at (a building's or a valley's level): 1-3, 4-6, 7-9 and 10. */
export const ART_BANDS = [
  { band: 1, from: 1, to: 3 },
  { band: 2, from: 4, to: 6 },
  { band: 3, from: 7, to: 9 },
  { band: 4, from: 10, to: 10 },
] as const;

/** The art band of a building or valley at `level` (1-4). */
export function artBand(level: number): number {
  return (ART_BANDS.find((b) => level <= b.to) ?? ART_BANDS[ART_BANDS.length - 1]).band;
}

/**
 * Building types with a sprite: every type built in a slot, but not the fortifications (trained at the walls) and not
 * the Walls, which are drawn as a frame round the city (WALL_PIECES).
 */
export const BUILDING_ART_TYPES: readonly number[] = Object.values(BuildingType).filter((t) => buildingConfig(t, 1)?.inside !== 3 && t !== BuildingType.WALLS);

const SLUGS = new Map<number, string>(Object.entries(BuildingType).map(([key, id]) => [id, key.toLowerCase().replaceAll('_', '-')]));

/** The sprite's file name for a building type and band: `town-hall-4.png`. */
export function buildingArtFile(typeId: number, band: number): string {
  return `${SLUGS.get(typeId) ?? `building-${typeId}`}-${band}.png`;
}

/** Valley types with tile art: forest, desert, hill, swamp, grassland, lake and flat land. */
export const TILE_ART_TYPES: readonly number[] = VALLEY_TYPES;

const TILE_SLUGS = new Map<number, string>(Object.entries(TileType).map(([key, id]) => [id, key.toLowerCase().replaceAll('_', '-')]));

/** The tile sprite's file name for a valley type and band: `forest-4.png`. */
export function tileArtFile(type: number, band: number): string {
  return `${TILE_SLUGS.get(type) ?? `tile-${type}`}-${band}.png`;
}

/**
 * The pieces the walls' frame round the city is made of, for each level band: `wall` repeats along the back and front
 * walls, `side` down the side walls (mirrored on the right), `corner` is a tower and `gate` the gatehouse.
 */
export const WALL_PIECES = ['wall', 'side', 'corner', 'gate'] as const;
export type WallPiece = (typeof WALL_PIECES)[number];

/** A wall piece's file name: `walls-4-gate.png`. */
export function wallArtFile(band: number, piece: WallPiece): string {
  return `walls-${band}-${piece}.png`;
}

/** Unit types with a sprite: every troop and every fortification (they share one id space). */
export const UNIT_ART_TYPES: readonly number[] = [...Object.values(TroopType), ...Object.values(FortType)];

const UNIT_SLUGS = new Map<number, string>(
  [...Object.entries(TroopType), ...Object.entries(FortType)].map(([key, id]) => [id, key.toLowerCase().replaceAll('_', '-')]),
);

/** A troop's or fortification's sprite file name: `cataphract.png`, `archer-tower.png`. */
export function unitArtFile(typeId: number): string {
  return `${UNIT_SLUGS.get(typeId) ?? `unit-${typeId}`}.png`;
}
