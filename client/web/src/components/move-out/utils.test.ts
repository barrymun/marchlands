import { describe, expect, it } from 'vitest';
import { ArmyDirection, BuildingType, HeroStatus, Mission } from '@marchlands/core';
import {
  attackOnTheWay,
  destinations,
  freeSlots,
  hasAnything,
  heroMoves,
  movableHeroes,
  moveOutShares,
  slotsLeftFor,
  toggled,
} from '@/components/move-out/utils';

const amount = (n: number) => ({ amount: n });
const city = {
  troop: { archer: 5001, militia: 4 },
  injuredTroop: { archer: 3 },
  resource: { gold: 1001, food: amount(2000), wood: amount(0), stone: amount(0), iron: amount(0.5) },
} as unknown as Parameters<typeof moveOutShares>[0];

describe(destinations.name, () => {
  it('lists the player’s other cities, leaving out those being abandoned', () => {
    const castles = [
      { id: 1, abandonAt: 5 },
      { id: 2, abandonAt: 0 },
      { id: 3, abandonAt: 9 },
      { id: 4, abandonAt: 0 },
    ];
    expect(destinations(castles, 1).map((c) => c.id)).toEqual([2, 4]);
  });

  it('is empty with no other city', () => {
    expect(destinations([{ id: 1, abandonAt: 5 }], 1)).toEqual([]);
  });
});

describe(toggled.name, () => {
  it('adds a city at the end, so the first chosen stays first', () => {
    expect(toggled([3], 1)).toEqual([3, 1]);
  });

  it('takes off a city already chosen', () => {
    expect(toggled([3, 1], 3)).toEqual([1]);
  });
});

describe(moveOutShares.name, () => {
  it('gives one city all of it, in whole resources', () => {
    expect(moveOutShares(city, 1)).toEqual([{ troops: 5005, injured: 3, goods: 3001 }]);
  });

  it('shares between cities, the first getting what is left over', () => {
    expect(moveOutShares(city, 2)).toEqual([
      { troops: 2503, injured: 2, goods: 1501 },
      { troops: 2502, injured: 1, goods: 1500 },
    ]);
  });

  it('has nothing to show with no cities chosen', () => {
    expect(moveOutShares(city, 0)).toEqual([]);
  });
});

describe(hasAnything.name, () => {
  it('is true for any of troops, injured or goods', () => {
    expect(hasAnything([{ troops: 1, injured: 0, goods: 0 }])).toBe(true);
    expect(hasAnything([{ troops: 0, injured: 1, goods: 0 }])).toBe(true);
    expect(hasAnything([{ troops: 0, injured: 0, goods: 1 }])).toBe(true);
  });

  it('is false for nothing, or for no shares', () => {
    expect(hasAnything([{ troops: 0, injured: 0, goods: 0 }])).toBe(false);
    expect(hasAnything([])).toBe(false);
  });
});

describe(attackOnTheWay.name, () => {
  const attack = { targetFieldId: 7, direction: ArmyDirection.FORWARD, missionType: Mission.ATTACK };

  it('sees an attack marching on the tile', () => {
    expect(attackOnTheWay([attack], 7)).toBe(true);
  });

  it('leaves out scouts, armies turning back and other tiles', () => {
    expect(attackOnTheWay([{ ...attack, missionType: Mission.SCOUT }], 7)).toBe(false);
    expect(attackOnTheWay([{ ...attack, direction: ArmyDirection.BACKWARD }], 7)).toBe(false);
    expect(attackOnTheWay([attack], 8)).toBe(false);
  });

  it('is false before the armies have loaded', () => {
    expect(attackOnTheWay(undefined, 7)).toBe(false);
  });
});

describe(movableHeroes.name, () => {
  it('keeps heroes at home and the mayor, leaving out one with an army', () => {
    const heroes = [{ status: HeroStatus.IDLE }, { status: HeroStatus.MAYOR }, { status: HeroStatus.ATTACK }, { status: HeroStatus.RETURN }];
    expect(movableHeroes(heroes)).toEqual([{ status: HeroStatus.IDLE }, { status: HeroStatus.MAYOR }]);
  });
});

const place = (id: number, hall: number, heroes: number) =>
  ({
    id,
    buildings: hall ? [{ typeId: BuildingType.FEASTING_HALL, level: hall }] : [],
    heros: Array.from({ length: heroes }, () => ({})),
  }) as unknown as Parameters<typeof freeSlots>[0] & { id: number };

describe(freeSlots.name, () => {
  it('is the Feasting Hall level less the heroes there', () => {
    expect(freeSlots(place(1, 5, 2))).toBe(3);
  });

  it('is 0 when full, over-full or with no Feasting Hall', () => {
    expect(freeSlots(place(1, 5, 5))).toBe(0);
    expect(freeSlots(place(1, 5, 6))).toBe(0);
    expect(freeSlots(place(1, 0, 0))).toBe(0);
  });
});

describe(slotsLeftFor.name, () => {
  it('takes off the other heroes chosen for that city', () => {
    expect(slotsLeftFor(place(1, 3, 1), { 10: 1 }, 20)).toBe(1);
  });

  it('does not take off the hero itself, nor those chosen for another city', () => {
    expect(slotsLeftFor(place(1, 3, 1), { 20: 1, 30: 2 }, 20)).toBe(2);
  });

  it('never goes below 0', () => {
    expect(slotsLeftFor(place(1, 1, 1), { 10: 1 }, 20)).toBe(0);
  });
});

describe(heroMoves.name, () => {
  it('gives each choice as the server takes it', () => {
    expect(heroMoves({ 20: 1, 30: 2 })).toEqual([
      { heroId: 20, cityId: 1 },
      { heroId: 30, cityId: 2 },
    ]);
  });

  it('is empty with no choices', () => {
    expect(heroMoves({})).toEqual([]);
  });
});
