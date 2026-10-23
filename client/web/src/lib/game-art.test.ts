import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { BASIC_RESOURCES, buildingMaxLevel, BuildingType, FortType, GEAR_PIECE_IDS, TileType, TroopType } from '@marchlands/core';

import {
  ART_BANDS,
  artBand,
  bareArtFile,
  BUILDING_ART_TYPES,
  buildingArtFile,
  CITY_GROUNDS,
  CITY_WALL_PIECES,
  cityGroundFile,
  cityWallFile,
  GEAR_ART_LEVELS,
  GEAR_STAR_KINDS,
  gearArtFile,
  gearBackdropFile,
  gearStarFile,
  grandTownHallFile,
  RESOURCE_ART_KEYS,
  resourceArtFile,
  TILE_ART_TYPES,
  tileArtFile,
  TROOP_BADGE_TYPES,
  troopBadgeFile,
  UNIT_ART_TYPES,
  unitArtFile,
  WALL_PIECES,
  wallArtFile,
} from '@/lib/game-art';

const ART_DIR = path.resolve(import.meta.dirname, '../assets/buildings');
const TILE_DIR = path.resolve(import.meta.dirname, '../assets/tiles');
const WALL_DIR = path.resolve(import.meta.dirname, '../assets/walls');
const UNIT_DIR = path.resolve(import.meta.dirname, '../assets/units');
const RESOURCE_DIR = path.resolve(import.meta.dirname, '../assets/resources');
const BADGE_DIR = path.resolve(import.meta.dirname, '../assets/badges');
const CITY_DIR = path.resolve(import.meta.dirname, '../assets/city');
const GEAR_DIR = path.resolve(import.meta.dirname, '../assets/gear');
const SPOTS: Record<string, { k: string }[]> = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, '../assets/spots.json'), 'utf8'));
/** Whether a sprite has parts the animated town draws turning (and so a bare twin). */
const moving = (file: string) => (SPOTS[`buildings/${file}`] ?? []).some((s) => s.k === 'sails' || s.k === 'wheel' || s.k === 'sheep');

describe(artBand.name, () => {
  it('changes the art at levels 4, 7 and 10', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(artBand)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4]);
  });

  it('keeps the top band for any level above 10, and the first for 0', () => {
    expect(artBand(11)).toBe(4);
    expect(artBand(0)).toBe(1);
  });
});

describe(buildingArtFile.name, () => {
  it('names the file after the building type, in kebab case, and the band', () => {
    expect(buildingArtFile(BuildingType.COTTAGE, 1)).toBe('cottage-1.png');
    expect(buildingArtFile(BuildingType.TOWN_HALL, 4)).toBe('town-hall-4.png');
  });

  it('falls back to the type id for a type it does not know', () => {
    expect(buildingArtFile(999, 2)).toBe('building-999-2.png');
  });
});

describe('BUILDING_ART_TYPES', () => {
  it('covers every building built in a slot, and neither the fortifications nor the walls', () => {
    expect(BUILDING_ART_TYPES).toContain(BuildingType.TOWN_HALL);
    expect(BUILDING_ART_TYPES).not.toContain(BuildingType.WALLS);
    expect(BUILDING_ART_TYPES).not.toContain(BuildingType.TRAP);
    expect(BUILDING_ART_TYPES.every((t) => buildingMaxLevel(t) === 10)).toBe(true);
  });
});

describe('building sprites', () => {
  it('has a sprite for every building type and band, a bare twin for each with moving parts, and nothing else', () => {
    const files = BUILDING_ART_TYPES.flatMap((t) => ART_BANDS.map(({ band }) => buildingArtFile(t, band)));
    const expected = [...files, ...files.filter(moving).map(bareArtFile)].sort();
    expect(fs.readdirSync(ART_DIR).sort()).toEqual(expected);
    expect(files.filter(moving).length).toBeGreaterThan(0);
  });
});

describe(bareArtFile.name, () => {
  it('names the bare twin of a sprite', () => {
    expect(bareArtFile('farm-4.png')).toBe('farm-4-bare.png');
  });
});

describe(tileArtFile.name, () => {
  it('names the file after the valley type, in kebab case, and the band', () => {
    expect(tileArtFile(TileType.FOREST, 4)).toBe('forest-4.png');
    expect(tileArtFile(TileType.GRASS, 1)).toBe('grass-1.png');
  });

  it('falls back to the type id for a type it does not know', () => {
    expect(tileArtFile(999, 2)).toBe('tile-999-2.png');
  });
});

describe('tile sprites', () => {
  it('has a sprite for every valley type, castles and barbarian camps, at every band, and nothing else', () => {
    expect(TILE_ART_TYPES).toContain(TileType.CASTLE);
    expect(TILE_ART_TYPES).toContain(TileType.NPC);
    const expected = TILE_ART_TYPES.flatMap((t) => ART_BANDS.map(({ band }) => tileArtFile(t, band))).sort();
    expect(fs.readdirSync(TILE_DIR).sort()).toEqual(expected);
  });
});

describe(wallArtFile.name, () => {
  it('names the file after the band and the piece', () => {
    expect(wallArtFile(4, 'gate')).toBe('walls-4-gate.png');
  });
});

describe('wall sprites', () => {
  it('has every piece for every band, and nothing else', () => {
    const expected = ART_BANDS.flatMap(({ band }) => WALL_PIECES.map((piece) => wallArtFile(band, piece))).sort();
    expect(fs.readdirSync(WALL_DIR).sort()).toEqual(expected);
  });
});

describe(unitArtFile.name, () => {
  it('names the file after the troop or fortification type, in kebab case', () => {
    expect(unitArtFile(TroopType.WORKER)).toBe('worker.png');
    expect(unitArtFile(TroopType.CATAPHRACT)).toBe('cataphract.png');
    expect(unitArtFile(FortType.ARCHER_TOWER)).toBe('archer-tower.png');
  });

  it('falls back to the type id for a type it does not know', () => {
    expect(unitArtFile(999)).toBe('unit-999.png');
  });
});

describe('unit sprites', () => {
  it('has a sprite for every troop and fortification type, and nothing else', () => {
    expect(UNIT_ART_TYPES).toHaveLength(17);
    expect(fs.readdirSync(UNIT_DIR).sort()).toEqual(UNIT_ART_TYPES.map(unitArtFile).sort());
  });
});

describe(resourceArtFile.name, () => {
  it('names the file after the resource key', () => {
    expect(resourceArtFile('wood')).toBe('wood.png');
  });
});

describe('resource icons', () => {
  it('has an icon for gold and every basic resource, and nothing else', () => {
    expect([...RESOURCE_ART_KEYS].sort()).toEqual(['gold', ...BASIC_RESOURCES].sort());
    expect(fs.readdirSync(RESOURCE_DIR).sort()).toEqual(RESOURCE_ART_KEYS.map(resourceArtFile).sort());
  });
});

describe(troopBadgeFile.name, () => {
  it('names the badge after the troop type, like its sprite', () => {
    expect(troopBadgeFile(TroopType.CATAPHRACT)).toBe('cataphract.png');
  });
});

describe('troop badges', () => {
  it('has a badge for every troop type, and nothing else', () => {
    expect(TROOP_BADGE_TYPES).toHaveLength(12);
    expect(fs.readdirSync(BADGE_DIR).sort()).toEqual(TROOP_BADGE_TYPES.map(troopBadgeFile).sort());
  });
});

describe(cityGroundFile.name, () => {
  it('names the file after the ground', () => {
    expect(cityGroundFile('plot')).toBe('plot.png');
  });
});

describe(cityWallFile.name, () => {
  it('names the file after the band and the piece', () => {
    expect(cityWallFile(4, 'gate')).toBe('walls-4-gate.png');
  });
});

describe(grandTownHallFile.name, () => {
  it('names the grand Town Hall after its band', () => {
    expect(grandTownHallFile(3)).toBe('town-hall-3.png');
  });
});

describe('city view art', () => {
  it('has the ground, and every wall piece and the grand Town Hall for every band, and nothing else', () => {
    const expected = [
      ...CITY_GROUNDS.map(cityGroundFile),
      ...ART_BANDS.flatMap(({ band }) => [...CITY_WALL_PIECES.map((piece) => cityWallFile(band, piece)), grandTownHallFile(band)]),
    ].sort();
    expect(fs.readdirSync(CITY_DIR).sort()).toEqual(expected);
  });
});

describe(gearArtFile.name, () => {
  it('names the file after the piece and the gear level, 0 to 10', () => {
    expect(gearArtFile('weapon', 0)).toBe('weapon-0.png');
    expect(gearArtFile('feet', 10)).toBe('feet-10.png');
  });

  it('shows level 10 above it, and level 0 below it', () => {
    expect(gearArtFile('weapon', 12)).toBe('weapon-10.png');
    expect(gearArtFile('weapon', -1)).toBe('weapon-0.png');
  });
});

describe(gearBackdropFile.name, () => {
  it('names the backdrop after the gear level, within 0 to 10', () => {
    expect(gearBackdropFile(3)).toBe('backdrop-3.png');
    expect(gearBackdropFile(11)).toBe('backdrop-10.png');
  });
});

describe(gearStarFile.name, () => {
  it('names the star after its kind', () => {
    expect(gearStarFile('waiting')).toBe('star-waiting.png');
  });
});

describe('gear art', () => {
  it('has every piece at every gear level, a backdrop for every level, every kind of star, and nothing else', () => {
    const expected = [
      ...GEAR_PIECE_IDS.flatMap((piece) => GEAR_ART_LEVELS.map((level) => gearArtFile(piece, level))),
      ...GEAR_ART_LEVELS.map(gearBackdropFile),
      ...GEAR_STAR_KINDS.map(gearStarFile),
    ].sort();
    expect(fs.readdirSync(GEAR_DIR).sort()).toEqual(expected);
  });
});
