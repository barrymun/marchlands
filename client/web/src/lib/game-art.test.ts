import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildingMaxLevel, BuildingType, FortType, TileType, TroopType } from '@marchlands/core';

import {
  ART_BANDS,
  artBand,
  BUILDING_ART_TYPES,
  buildingArtFile,
  TILE_ART_TYPES,
  tileArtFile,
  UNIT_ART_TYPES,
  unitArtFile,
  WALL_PIECES,
  wallArtFile,
} from '@/lib/game-art';

const ART_DIR = path.resolve(import.meta.dirname, '../assets/buildings');
const TILE_DIR = path.resolve(import.meta.dirname, '../assets/tiles');
const WALL_DIR = path.resolve(import.meta.dirname, '../assets/walls');
const UNIT_DIR = path.resolve(import.meta.dirname, '../assets/units');

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
  it('has a sprite for every building type and band, and nothing else', () => {
    const expected = BUILDING_ART_TYPES.flatMap((t) => ART_BANDS.map(({ band }) => buildingArtFile(t, band))).sort();
    expect(fs.readdirSync(ART_DIR).sort()).toEqual(expected);
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
  it('has a sprite for every valley type and band, and nothing else', () => {
    expect(TILE_ART_TYPES).not.toContain(TileType.CASTLE);
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
