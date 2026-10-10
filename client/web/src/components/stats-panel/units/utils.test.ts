import { describe, expect, it } from 'vitest';
import { FORT_KEY_LIST, FORT_KEYS, TROOP_KEY_LIST, TROOP_KEYS, TROOP_NAMES } from '@marchlands/core';
import { unitCount, unitName } from '@/components/stats-panel/units/utils';

describe(unitCount.name, () => {
  it('reads the `group.unit` counter', () => {
    const c = { 'trained.archer': 120, 'killed.archer': 7, 'trained.pikemen': 3 };
    expect(unitCount(c, 'trained', 'archer')).toBe(120);
    expect(unitCount(c, 'killed', 'archer')).toBe(7);
    expect(unitCount(c, 'trained', 'pikemen')).toBe(3);
  });

  it('is 0 when the counter is missing', () => {
    expect(unitCount({}, 'trained', 'archer')).toBe(0);
    expect(unitCount({ 'trained.archer': 5 }, 'healed', 'archer')).toBe(0);
  });

  it('computes died as lost less injured', () => {
    expect(unitCount({ 'lost.archer': 50, 'injured.archer': 20 }, 'died', 'archer')).toBe(30);
    expect(unitCount({ 'lost.archer': 50 }, 'died', 'archer')).toBe(50);
  });

  it('never reports a negative died count', () => {
    expect(unitCount({ 'lost.archer': 10, 'injured.archer': 25 }, 'died', 'archer')).toBe(0);
    expect(unitCount({ 'injured.archer': 4 }, 'died', 'archer')).toBe(0);
  });

  it('ignores a stored `died.` counter (died is always derived)', () => {
    expect(unitCount({ 'died.archer': 99 }, 'died', 'archer')).toBe(0);
  });

  it('works for fortifications', () => {
    expect(unitCount({ 'trained.trap': 400, 'lost.trap': 30 }, 'trained', 'trap')).toBe(400);
    expect(unitCount({ 'trained.trap': 400, 'lost.trap': 30 }, 'died', 'trap')).toBe(30);
  });
});

describe(unitName.name, () => {
  it('names every troop key by its troop id', () => {
    for (const [id, key] of Object.entries(TROOP_KEYS)) expect(unitName(key)).toBe(TROOP_NAMES[Number(id)]);
    expect(unitName('archer')).toBe('Archer');
    expect(unitName('lightCavalry')).toBe('Cavalry');
  });

  it('names every fortification key by its fort id', () => {
    for (const [id, key] of Object.entries(FORT_KEYS)) expect(unitName(key)).toBe(TROOP_NAMES[Number(id)]);
    expect(unitName('rockfall')).toBe('Trebuchet');
  });

  it('gives a display name for every listed unit', () => {
    for (const k of [...TROOP_KEY_LIST, ...FORT_KEY_LIST]) expect(unitName(k)).not.toBe(k);
  });

  it('falls back to the key when the unit is unknown', () => {
    expect(unitName('dragon')).toBe('dragon');
    expect(unitName('')).toBe('');
  });
});
