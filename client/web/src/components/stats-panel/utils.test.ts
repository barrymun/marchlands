import { describe, expect, it } from 'vitest';
import { sumPrefix } from '@/components/stats-panel/utils';

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
