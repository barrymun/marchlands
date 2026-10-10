import { describe, expect, it } from 'vitest';
import { FORT_KEYS, TROOP_KEYS, TROOP_NAMES } from '@marchlands/core';
import { troopLabel } from '@/components/reports-panel/report-dialog/report-content/utils';

describe(troopLabel.name, () => {
  it('names every troop key by its troop id', () => {
    for (const [id, key] of Object.entries(TROOP_KEYS)) expect(troopLabel(key)).toBe(TROOP_NAMES[Number(id)]);
  });

  it('names every fortification key by its fort id', () => {
    for (const [id, key] of Object.entries(FORT_KEYS)) expect(troopLabel(key)).toBe(TROOP_NAMES[Number(id)]);
  });

  it('uses the display names, not the client keys', () => {
    expect(troopLabel('lightCavalry')).toBe('Cavalry');
    expect(troopLabel('heavyCavalry')).toBe('Cataphract');
    expect(troopLabel('arrowTower')).toBe("Archer's Tower");
  });

  it('falls back to the raw key when it is unknown', () => {
    expect(troopLabel('dragon')).toBe('dragon');
    expect(troopLabel('')).toBe('');
  });
});
