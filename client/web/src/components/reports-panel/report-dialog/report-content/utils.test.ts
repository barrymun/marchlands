import { describe, expect, it } from 'vitest';

import { FORT_KEYS, ResourceKey, TROOP_KEYS } from '@marchlands/core';

import { resourceKeyLabel, troopLabel } from '@/components/reports-panel/report-dialog/report-content/utils';
import { troopName } from '@/lib/game-data';

describe(troopLabel.name, () => {
  it('names every troop key by its troop id', () => {
    for (const [id, key] of Object.entries(TROOP_KEYS)) expect(troopLabel(key)).toBe(troopName(Number(id)));
  });

  it('names every fortification key by its fort id', () => {
    for (const [id, key] of Object.entries(FORT_KEYS)) expect(troopLabel(key)).toBe(troopName(Number(id)));
  });

  it('uses the display names, not the client keys', () => {
    expect(troopLabel('lightCavalry')).toBe('Cavalry');
    expect(troopLabel('heavyCavalry')).toBe('Cataphract');
    expect(troopLabel('arrowTower')).toBe("Archer's Tower");
  });

  it('falls back to the raw key when it is unknown', () => {
    expect(troopLabel('dragon')).toBe('dragon');
    expect(troopLabel('')).toBe('');
    expect(troopLabel('constructor')).toBe('constructor');
  });
});

describe(resourceKeyLabel.name, () => {
  it('labels every resource key', () => {
    expect(resourceKeyLabel(ResourceKey.GOLD)).toBe('Gold');
    expect(resourceKeyLabel(ResourceKey.FOOD)).toBe('Food');
    expect(resourceKeyLabel(ResourceKey.WOOD)).toBe('Lumber');
    expect(resourceKeyLabel(ResourceKey.STONE)).toBe('Stone');
    expect(resourceKeyLabel(ResourceKey.IRON)).toBe('Iron');
  });

  it('falls back to the raw key when it is not a resource', () => {
    expect(resourceKeyLabel('honor')).toBe('honor');
    expect(resourceKeyLabel('')).toBe('');
  });
});
