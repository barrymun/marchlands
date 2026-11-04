import { describe, expect, it } from 'vitest';
import type { ChipCity } from '@/components/flows-panel/city-chips/types';
import { cityChips, limitChips } from '@/components/flows-panel/city-chips/utils';

const city = (id: number, name: string, historicLevel: ChipCity['historicLevel'] = null): ChipCity => ({ id, name, x: id, y: id + 1, historicLevel });
const OAKMERE = city(1, 'Oakmere');
const FENWICK_A = city(2, 'Fenwick');
const FENWICK_B = city(3, 'Fenwick');
const NAJRAN = city(4, 'Najran', 12);
const ROME = city(5, 'Rome', 16);
const ALL = [OAKMERE, FENWICK_A, FENWICK_B, NAJRAN, ROME];

describe(cityChips.name, () => {
  it('gives each chosen city a chip, in the order of the cities', () => {
    expect(cityChips([5, 1], ALL).map((c) => c.name)).toEqual(['Oakmere', 'Rome']);
  });

  it('puts cities of the same name on one chip', () => {
    const chips = cityChips([2, 3, 4], ALL);
    expect(chips.map((c) => c.name)).toEqual(['Fenwick', 'Najran']);
    expect(chips[0]?.cities).toEqual([FENWICK_A, FENWICK_B]);
  });

  it('keeps apart cities of one name at different historic levels', () => {
    expect(cityChips([1, 2], [city(1, 'Keep', 12), city(2, 'Keep')]).map((c) => c.historicLevel)).toEqual([12, null]);
  });

  it('carries a historic city its level', () => {
    expect(cityChips([5], ALL)[0]).toMatchObject({ name: 'Rome', historicLevel: 16 });
  });

  it('marks the chip with the city in view and puts it first', () => {
    const chips = cityChips([1, 2, 3, 5], ALL, 3);
    expect(chips.map((c) => [c.name, c.here])).toEqual([
      ['Fenwick', true],
      ['Oakmere', false],
      ['Rome', false],
    ]);
  });

  it('marks none when the city in view is not chosen, or none is given', () => {
    expect(cityChips([1], ALL, 5).map((c) => c.here)).toEqual([false]);
    expect(cityChips([1], ALL).map((c) => c.here)).toEqual([false]);
  });

  it('leaves out a chosen city the player no longer holds', () => {
    expect(cityChips([1, 99], ALL).map((c) => c.name)).toEqual(['Oakmere']);
    expect(cityChips([99], ALL)).toEqual([]);
    expect(cityChips([], ALL)).toEqual([]);
  });
});

describe(limitChips.name, () => {
  const chips = cityChips([1, 2, 3, 4, 5], ALL); // Oakmere, Fenwick (two), Najran, Rome

  it('shows them all without a limit', () => {
    expect(limitChips(chips)).toEqual({ shown: chips, hidden: [] });
  });

  it('shows them all within the limit', () => {
    expect(limitChips(chips, 4)).toEqual({ shown: chips, hidden: [] });
  });

  it('shows one over the limit rather than "+1 more"', () => {
    expect(limitChips(chips, 3)).toEqual({ shown: chips, hidden: [] });
  });

  it('hides the rest past that, counting their cities', () => {
    expect(limitChips(chips, 1)).toEqual({ shown: chips.slice(0, 1), hidden: [FENWICK_A, FENWICK_B, NAJRAN, ROME] });
    expect(limitChips(chips, 2).hidden).toEqual([NAJRAN, ROME]);
  });

  it('is empty with no chips', () => {
    expect(limitChips([], 2)).toEqual({ shown: [], hidden: [] });
  });
});
