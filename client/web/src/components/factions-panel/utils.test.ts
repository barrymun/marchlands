import { describe, expect, it } from 'vitest';
import { goldBar } from '@/components/factions-panel/utils';

describe(goldBar.name, () => {
  it('fills below the mark when a faction holds less than its treasury', () => {
    expect(goldBar(1, 4)).toEqual({ fill: 0.25, mark: 1 });
  });

  it('runs past the mark when it holds more', () => {
    expect(goldBar(8, 2)).toEqual({ fill: 1, mark: 0.25 });
  });

  it('fills to the mark exactly at its treasury', () => {
    expect(goldBar(3, 3)).toEqual({ fill: 1, mark: 1 });
  });

  it('is empty with nothing to show', () => {
    expect(goldBar(0, 0)).toEqual({ fill: 0, mark: 0 });
    expect(goldBar(0, 5)).toEqual({ fill: 0, mark: 1 });
  });
});
