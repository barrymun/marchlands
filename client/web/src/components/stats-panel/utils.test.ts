import { describe, expect, it } from 'vitest';

import { FORT_KEY_LIST, FORT_KEYS, TROOP_KEY_LIST, TROOP_KEYS } from '@marchlands/core';

import { shareOf, sumPrefix, unitCount, unitName } from '@/components/stats-panel/utils';
import { troopName } from '@/lib/game-data';

describe(sumPrefix.name, () => {
  const c = { 'attacks.won.city': 3, 'attacks.won.npc': 5, 'attacks.lost.city': 2, 'defenses.won.city': 1, honor: 40 };

  it('adds every counter whose key starts with the prefix', () => {
    expect(sumPrefix(c, 'attacks.won.')).toBe(8);
    expect(sumPrefix(c, 'attacks.lost.')).toBe(2);
    expect(sumPrefix(c, 'attacks.')).toBe(10);
  });

  it('is 0 when nothing matches or the counters are empty', () => {
    expect(sumPrefix(c, 'items.used.')).toBe(0);
    expect(sumPrefix({}, 'attacks.won.')).toBe(0);
  });

  it('matches only at the start of the key', () => {
    expect(sumPrefix(c, 'won.')).toBe(0);
  });

  it('sums everything with an empty prefix, including negative values', () => {
    expect(sumPrefix(c, '')).toBe(51);
    expect(sumPrefix({ 'spent.building.gold': 100, 'spent.building.food': -30 }, 'spent.building.')).toBe(70);
  });
});

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
    for (const [id, key] of Object.entries(TROOP_KEYS)) expect(unitName(key)).toBe(troopName(Number(id)));
    expect(unitName('archer')).toBe('Archer');
    expect(unitName('lightCavalry')).toBe('Cavalry');
  });

  it('names every fortification key by its fort id', () => {
    for (const [id, key] of Object.entries(FORT_KEYS)) expect(unitName(key)).toBe(troopName(Number(id)));
    expect(unitName('rockfall')).toBe('Trebuchet');
  });

  it('gives a display name for every listed unit', () => {
    for (const k of [...TROOP_KEY_LIST, ...FORT_KEY_LIST]) expect(unitName(k)).not.toBe(k);
  });

  it('falls back to the key when the unit is unknown', () => {
    expect(unitName('dragon')).toBe('dragon');
    expect(unitName('')).toBe('');
    expect(unitName('toString')).toBe('toString');
  });
});

describe(shareOf.name, () => {
  it('is the part over the whole', () => {
    expect(shareOf(25, 100)).toBe(0.25);
    expect(shareOf(100, 100)).toBe(1);
  });

  it('is 0 for a whole of nothing', () => {
    expect(shareOf(5, 0)).toBe(0);
    expect(shareOf(0, 0)).toBe(0);
  });

  it('stays between 0 and 1', () => {
    expect(shareOf(150, 100)).toBe(1);
    expect(shareOf(-5, 100)).toBe(0);
  });
});
