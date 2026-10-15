import { describe, expect, it } from 'vitest';

import { buildingInfo, BUILDINGS, BuildingType, isFortType, TechType, TroopType } from '@marchlands/core';

import { unlockName } from '@/components/buildings-panel/building-dialog/unlocks/utils';
import dataBuildings from '@/locales/en-GB/data-buildings.json';

describe(unlockName.name, () => {
  it('names buildings, troops and technologies from their data namespaces', () => {
    expect(unlockName({ kind: 'building', id: BuildingType.TOWN_HALL })).toBe('Town Hall');
    expect(unlockName({ kind: 'troop', id: TroopType.PIKE })).toBe('Pikeman');
    expect(unlockName({ kind: 'tech', id: TechType.AGRICULTURE })).toBe('Agriculture');
  });

  it('falls back to a numbered name for an unknown id', () => {
    expect(unlockName({ kind: 'building', id: 999 })).toBe('Building 999');
  });

  it('names everything a building unlocks', () => {
    for (const typeId of Object.values(BuildingType))
      for (const u of buildingInfo(typeId).unlocks) expect(unlockName(u), `${u.kind} ${u.id}`).not.toMatch(/^(Building|Unit|Research) \d+$/);
  });
});

describe('data-buildings', () => {
  it('has an en-GB name for every building the game defines (fortifications are troops)', () => {
    const names = dataBuildings as Record<string, string>;
    const ids = new Set(BUILDINGS.filter((b) => !isFortType(b.typeId)).map((b) => b.typeId));
    for (const id of ids) expect(names[String(id)], `building ${id}`).toBeTruthy();
  });
});
