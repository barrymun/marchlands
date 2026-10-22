import { describe, expect, it } from 'vitest';
import { one } from '#/rows.ts';

describe(one.name, () => {
  it('gives the only row', () => {
    expect(one([{ n: 3 }])).toEqual({ n: 3 });
  });

  it('throws when there is no row', () => {
    expect(() => one([])).toThrow('expected one row, got 0');
  });

  it('throws when there is more than one', () => {
    expect(() => one([{ n: 1 }, { n: 2 }])).toThrow('expected one row, got 2');
  });
});
