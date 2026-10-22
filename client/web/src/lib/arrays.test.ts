import { describe, expect, it } from 'vitest';
import { moved, pairs } from '@/lib/arrays';

describe(pairs.name, () => {
  it('pairs each element with the next', () => {
    expect(pairs([1, 2, 3, 4])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
  });
  it('has none for fewer than two elements', () => {
    expect(pairs([])).toEqual([]);
    expect(pairs(['a'])).toEqual([]);
  });
  it('takes any iterable', () => {
    expect(pairs(new Set(['a', 'b']))).toEqual([['a', 'b']]);
  });
});

describe(moved.name, () => {
  it('moves an element forwards and backwards', () => {
    expect(moved(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moved(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('keeps the list when moving an element to where it is', () => {
    expect(moved(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
  it('leaves the list unchanged for a position past the end, and never changes the original', () => {
    const list = ['a', 'b'];
    expect(moved(list, 5, 0)).toEqual(['a', 'b']);
    moved(list, 0, 1);
    expect(list).toEqual(['a', 'b']);
  });
});
