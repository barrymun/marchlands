import { describe, expect, it } from 'vitest';
import { BALANCE, tavernRefill } from '#/index.ts';

const heroes = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe(tavernRefill.name, () => {
  it('fills an empty Inn with one hero per level', () => {
    expect(tavernRefill([], 3)).toEqual({ keep: [], drop: [], add: 3, heroInnLevel: 3 });
  });

  it('keeps the current offers and tops them up', () => {
    const current = heroes(2);
    expect(tavernRefill(current, 5)).toEqual({ keep: current, drop: [], add: 3, heroInnLevel: 5 });
  });

  it('adds nothing when the Inn is full', () => {
    expect(tavernRefill(heroes(4), 4)).toMatchObject({ drop: [], add: 0 });
  });

  it('drops the offers past the Inn level, keeping the first ones', () => {
    const current = heroes(6);
    expect(tavernRefill(current, 4)).toEqual({ keep: current.slice(0, 4), drop: current.slice(4), add: 0, heroInnLevel: 4 });
  });

  it('offers at most BALANCE.inn.maxOffers heroes, generated at that Inn level', () => {
    const max = BALANCE.inn.maxOffers;
    expect(tavernRefill([], max + 3)).toEqual({ keep: [], drop: [], add: max, heroInnLevel: max });
    expect(tavernRefill(heroes(max + 1), max + 3)).toMatchObject({ drop: [{ id: max + 1 }], add: 0 });
  });

  it('offers nothing without an Inn', () => {
    expect(tavernRefill(heroes(2), 0)).toMatchObject({ keep: [], add: 0 });
  });
});
