import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BuildingBean } from '@marchlands/api-client';
import { BALANCE, BuildingType, TOWN_HALL_POSITION, TroopType } from '@marchlands/core';

import { OUTSIDE, VIEW_KEY } from '@/components/buildings-panel/constants';
import { fieldSlots, fieldWorkers, readView, saveView, townState, townWalkers } from '@/components/buildings-panel/utils';

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

  it('reads the grid when it was chosen, and the scene otherwise', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === VIEW_KEY ? 'grid' : null) });
    expect(readView()).toBe('grid');
    vi.stubGlobal('localStorage', { getItem: () => 'something else' });
    expect(readView()).toBe('scene');
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readView()).toBe('scene');
  });

  it('falls back to the scene when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readView()).toBe('scene');
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
    expect(() => saveView('scene')).not.toThrow();
  });
});

describe(townWalkers.name, () => {
  it('grows with the population, by its square root', () => {
    expect(townWalkers(900)).toBe(5);
    expect(townWalkers(3600)).toBe(10);
  });

  it('keeps between 2 and 16 people', () => {
    expect(townWalkers(0)).toBe(2);
    expect(townWalkers(-5)).toBe(2);
    expect(townWalkers(1_000_000)).toBe(16);
  });
});

describe(fieldWorkers.name, () => {
  it('puts one worker on every two fields built, rounding up, and none on empty fields', () => {
    expect(fieldWorkers(0)).toBe(0);
    expect(fieldWorkers(1)).toBe(1);
    expect(fieldWorkers(7)).toBe(4);
  });

  it('stops at 10', () => {
    expect(fieldWorkers(40)).toBe(10);
  });
});

describe(townState.name, () => {
  const city = { id: 7, fieldId: 4321, zoneId: 3, x: 12, y: 34, injuredTroop: {} };
  const batch = (type: number, running = true) => ({ type, startTime: running ? 1 : 0, endTime: running ? 2 : 0 });

  it('is quiet with nothing loaded', () => {
    expect(townState(city, {})).toEqual({
      training: [],
      cavalry: false,
      siege: false,
      research: false,
      forts: false,
      injured: false,
      enemy: false,
      armyOut: false,
      zoneId: 3,
      attackedAt: null,
    });
  });

  it('knows when the city was last attacked, from its army reports', () => {
    const report = (code: string, x: number, y: number, eventTime: number) => ({
      title: { code },
      targetPos: { code: 'world.position.city', params: { name: 'Keep', x, y } },
      eventTime,
    });
    const reports = [
      report('report.title.attackRepelled', 12, 34, 500),
      report('report.title.cityAttacked', 12, 34, 900),
      report('report.title.cityAttacked', 1, 1, 2000),
      report('report.title.attackSucceeded', 12, 34, 3000),
      { title: { code: 'report.title.cityAttacked' }, targetPos: null, eventTime: 4000 },
    ];
    expect(townState(city, { reports }).attackedAt).toBe(900);
    expect(townState(city, { reports: reports.slice(2) }).attackedAt).toBeNull();
  });

  it('knows which barracks train, and whether cavalry or siege engines are among it', () => {
    const s = townState(city, {
      troops: [
        { positionId: 3, allProduceQueue: [batch(TroopType.CAVALRY)] },
        { positionId: 5, allProduceQueue: [batch(TroopType.RAM, false)] },
        { positionId: 9, allProduceQueue: [batch(TroopType.ARCHER)] },
      ],
    });
    expect(s.training).toEqual([3, 9]);
    expect(s.cavalry).toBe(true);
    // the ram is only queued, not started
    expect(s.siege).toBe(false);
  });

  it('sees research here, fortifications under way and injured troops', () => {
    const s = townState(
      { ...city, injuredTroop: { archer: 0, peasants: 12 } },
      {
        techs: [{ upgrading: true, castleId: 7 }],
        forts: [{ positionId: -2, allProduceQueue: [batch(14)] }],
      },
    );
    expect([s.research, s.forts, s.injured]).toEqual([true, true, true]);
    expect(townState(city, { techs: [{ upgrading: true, castleId: 8 }] }).research).toBe(false);
  });

  it('sees an enemy army coming to this city, and its own armies away', () => {
    expect(townState(city, { enemy: [{ targetFieldId: 4321 }] }).enemy).toBe(true);
    expect(townState(city, { enemy: [{ targetFieldId: 1 }] }).enemy).toBe(false);
    expect(townState(city, { own: [{ cityId: 7, startFieldId: 1 }] }).armyOut).toBe(true);
    expect(townState(city, { own: [{ cityId: 8, startFieldId: 1 }] }).armyOut).toBe(false);
  });
});
