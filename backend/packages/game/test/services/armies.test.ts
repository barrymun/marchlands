import { describe, expect, it } from 'vitest';
import { BALANCE, msg, tileId } from '@marchlands/core';
import { armies } from '../../src/index.ts';

describe(armies.armyRef.name, () => {
  it('keys an army event by its id', () => {
    expect(armies.armyRef(42)).toBe('army:42');
    expect(armies.armyRef(42)).not.toBe(armies.armyRef(43));
  });
});

describe(armies.cityPosition.name, () => {
  it('names the city and its coordinates', () => {
    expect(armies.cityPosition('Ashford', tileId(12, 34))).toEqual(msg('world.position.city', { name: 'Ashford', x: 12, y: 34 }));
  });

  it('works at the map edges', () => {
    const last = BALANCE.mapSize - 1;
    expect(armies.cityPosition('Edge', tileId(last, last))).toEqual(msg('world.position.city', { name: 'Edge', x: last, y: last }));
    expect(armies.cityPosition('Origin', 0)).toEqual(msg('world.position.city', { name: 'Origin', x: 0, y: 0 }));
  });
});
