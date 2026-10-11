// Map and world info (see index.ts).
export const WORLD_MESSAGES = {
  /** no free flat to found a city on */
  noOpenFlat: [],
  invalidArea: [],
  /** a map view larger than `max` × `max` tiles */
  areaTooLarge: ['max'],
  invalidTile: [],
  /** where an army or a report starts or ends: a city by name, a tile by type (`tile`, a tile reference) and level, or a tile without a level (flat land) */
  'position.city': ['name', 'x', 'y'],
  'position.tile': ['tile', 'level', 'x', 'y'],
  'position.place': ['tile', 'x', 'y'],
} as const;
