// Game art (AGENTS.md, Client, Game art): one pixel-art sprite per building type and level band in
// src/assets/buildings/, the walls' frame pieces per level band in src/assets/walls/, one sprite per valley type and
// level band in src/assets/tiles/, one sprite per troop and fortification type in src/assets/units/, one badge per
// troop type in src/assets/badges/, one icon per resource in src/assets/resources/, and the isometric city view's
// ground and wall pieces in src/assets/city/. The art scripts in tools/art import this file, so it uses no `@/` imports.

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
  return (ART_BANDS.find((b) => level <= b.to) ?? ART_BANDS[3]).band; // past the last band: the last
}

/**
 * Building types with a sprite: every type built in a slot, but not the fortifications (trained at the walls) and not
 * the Walls, which are drawn as a frame round the city (WALL_PIECES).
 */
export const BUILDING_ART_TYPES: readonly number[] = Object.values(BuildingType).filter((t) => buildingConfig(t, 1)?.inside !== 3 && t !== BuildingType.WALLS);

const SLUGS = new Map<number, string>(Object.entries(BuildingType).map(([key, id]) => [id, key.toLowerCase().replaceAll('_', '-')]));

/**
 * A sprite's bare twin, drawn without its moving parts (windmill sails, water wheels) for the animated town to draw them
 * turning over it: `farm-4.png` → `farm-4-bare.png`. Only sprites with moving parts have one (assets/spots.json).
 */
export function bareArtFile(file: string): string {
  return file.replace(/\.png$/, '-bare.png');
}

/** The sprite's file name for a building type and band: `town-hall-4.png`. */
export function buildingArtFile(typeId: number, band: number): string {
  return `${SLUGS.get(typeId) ?? `building-${typeId}`}-${band}.png`;
}

/**
 * Map tile types with art: the valleys (forest, desert, hill, swamp, grassland, lake and flat land), players' castles and
 * barbarian camps.
 */
export const TILE_ART_TYPES: readonly number[] = [...VALLEY_TYPES, TileType.CASTLE, TileType.NPC];

const TILE_SLUGS = new Map<number, string>(Object.entries(TileType).map(([key, id]) => [id, key.toLowerCase().replaceAll('_', '-')]));

/** The tile sprite's file name for a tile type and band: `forest-4.png`, `castle-2.png`, `npc-3.png`. */
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

/** Troop types with a badge (the small icon for lists of troops): all of them. */
export const TROOP_BADGE_TYPES: readonly number[] = Object.values(TroopType);

/** A troop's badge file name, named like its sprite: `cataphract.png`. */
export function troopBadgeFile(typeId: number): string {
  return unitArtFile(typeId);
}

/** The resources with an icon, as the resource bar lists them. */
export const RESOURCE_ART_KEYS = ['gold', 'food', 'wood', 'stone', 'iron'] as const;
export type ResourceKey = (typeof RESOURCE_ART_KEYS)[number];

/** A resource icon's file name: `wood.png`. */
export function resourceArtFile(key: ResourceKey): string {
  return `${key}.png`;
}

/** The isometric city view's ground: grass tiles, and the markers laid over it for an empty plot and a locked field. */
export const CITY_GROUNDS = ['grass', 'plot', 'locked'] as const;
export type CityGround = (typeof CITY_GROUNDS)[number];

/** A city ground tile's file name: `plot.png`. */
export function cityGroundFile(name: CityGround): string {
  return `${name}.png`;
}

/**
 * The isometric city view's wall pieces, for each art band: a stretch of wall where the row is fixed (`wall-x`) or the
 * column is (`wall-y`), a corner `tower` and the `gate` at the front corner.
 */
export const CITY_WALL_PIECES = ['wall-x', 'wall-y', 'tower', 'gate'] as const;
export type CityWallPiece = (typeof CITY_WALL_PIECES)[number];
export type WallBand = 1 | 2 | 3 | 4;

/** A city wall piece's file name: `walls-4-gate.png` (in src/assets/city/, apart from the grid view's frame pieces). */
export function cityWallFile(band: number, piece: CityWallPiece): string {
  return `walls-${band}-${piece}.png`;
}

/** The grand Town Hall of the isometric town (128×128, a 2×2 block) for a level band: `town-hall-4.png` in src/assets/city/. */
export function grandTownHallFile(band: number): string {
  return `town-hall-${band}.png`;
}
