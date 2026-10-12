import { describe, expect, it } from 'vitest';
import { BALANCE, msg, tileId } from '@marchlands/core';
import { armyRef, cityPosition } from '#/engine/armies.ts';

describe(armyRef.name, () => {
  it('keys an army event by its id', () => {
    expect(armyRef(42)).toBe('army:42');
    expect(armyRef(42)).not.toBe(armyRef(43));
  });
});

describe(cityPosition.name, () => {
  it('names the city and its coordinates', () => {
    expect(cityPosition('Ashford', tileId(12, 34))).toEqual(msg('world.position.city', { name: 'Ashford', x: 12, y: 34 }));
  });

  it('works at the map edges', () => {
    const last = BALANCE.mapSize - 1;
    expect(cityPosition('Edge', tileId(last, last))).toEqual(msg('world.position.city', { name: 'Edge', x: last, y: last }));
    expect(cityPosition('Origin', 0)).toEqual(msg('world.position.city', { name: 'Origin', x: 0, y: 0 }));
  });
});
