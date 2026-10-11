import { describe, expect, it } from 'vitest';
import { BALANCE, BuildingStatus, BuildingType } from '@marchlands/core';
import { player } from '../../src/index.ts';

describe(player.initialCity.name, () => {
  it('is a Town Hall 1 city with the starting resources, population and tax rate', () => {
    const r = BALANCE.startingResources;
    expect(player.initialCity(7, 1234, 'Home', 5000)).toEqual({
      playerId: 7,
      tileId: 1234,
      name: 'Home',
      gold: r,
      food: r,
      wood: r,
      stone: r,
      iron: r,
      resourcesAt: 5000,
      population: BALANCE.startPopulation,
      taxRate: BALANCE.startTaxRate,
      buildings: [{ positionId: -1, typeId: BuildingType.TOWN_HALL, level: 1, status: BuildingStatus.IDLE, startTime: 0, endTime: 0 }],
      misc: { lastTickAt: 5000 },
      createdAt: 5000,
    });
  });

  it('gives each city its own buildings list', () => {
    const a = player.initialCity(1, 1, 'A', 0);
    const b = player.initialCity(1, 2, 'B', 0);
    expect(a.buildings).not.toBe(b.buildings);
  });
});
