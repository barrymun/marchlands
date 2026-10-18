import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BuildingBean } from '@marchlands/api-client';
import { BALANCE, BuildingType, TOWN_HALL_POSITION } from '@marchlands/core';

import { OUTSIDE, VIEW_KEY } from '@/components/buildings-panel/constants';
import { fieldSlots, readView, saveView } from '@/components/buildings-panel/utils';

const building = (positionId: number, typeId: number, level: number): BuildingBean => ({ positionId, typeId, level, status: 0, startTime: 0, endTime: 0 });

describe(fieldSlots.name, () => {
  it('unlocks the base slots without a Town Hall', () => {
    expect(fieldSlots([])).toEqual({ townHall: 0, unlocked: BALANCE.outerSlotsBase });
  });

  it('adds outerSlotsPerTownHall slots per Town Hall level', () => {
    const buildings = [building(TOWN_HALL_POSITION, BuildingType.TOWN_HALL, 4), building(0, BuildingType.COTTAGE, 9), building(1001, BuildingType.FARM, 7)];
    expect(fieldSlots(buildings)).toEqual({ townHall: 4, unlocked: BALANCE.outerSlotsBase + 4 * BALANCE.outerSlotsPerTownHall });
  });

  it('reads the level of the building at the Town Hall position only', () => {
    expect(fieldSlots([building(5, BuildingType.COTTAGE, 10)]).townHall).toBe(0);
  });

  it('never unlocks more slots than there are field positions', () => {
    expect(fieldSlots([building(TOWN_HALL_POSITION, BuildingType.TOWN_HALL, 10)]).unlocked).toBe(OUTSIDE.length);
    expect(fieldSlots([building(TOWN_HALL_POSITION, BuildingType.TOWN_HALL, 15)]).unlocked).toBe(OUTSIDE.length);
  });
});

describe(readView.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the grid when it was chosen, and the town otherwise', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === VIEW_KEY ? 'grid' : null) });
    expect(readView()).toBe('grid');
    vi.stubGlobal('localStorage', { getItem: () => 'something else' });
    expect(readView()).toBe('town');
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readView()).toBe('town');
  });

  it('falls back to the town when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readView()).toBe('town');
  });
});

describe(saveView.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores the view under its key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveView('grid');
    expect(setItem).toHaveBeenCalledWith(VIEW_KEY, 'grid');
  });

  it('carries on when storage throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveView('town')).not.toThrow();
  });
});
