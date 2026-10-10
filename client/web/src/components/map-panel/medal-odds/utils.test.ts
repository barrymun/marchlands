import { afterEach, describe, expect, it, vi } from 'vitest';
import { itemConfig } from '@marchlands/core';
import { medalName } from '@/components/map-panel/medal-odds/utils';

vi.mock('@marchlands/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marchlands/core')>();
  return { ...actual, itemConfig: vi.fn(actual.itemConfig) };
});

afterEach(() => {
  vi.mocked(itemConfig).mockClear();
});

describe(medalName.name, () => {
  it('names each medal level without the " Medal" suffix', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(medalName)).toEqual(['Cross', 'Rose', 'Lion', 'Honor', 'Courage', 'Wisdom', 'Freedom', 'Justice', 'Nation']);
  });

  it('clamps levels outside 1..9 (core medalId)', () => {
    expect(medalName(0)).toBe('Cross');
    expect(medalName(-3)).toBe('Cross');
    expect(medalName(10)).toBe('Nation');
  });

  it('falls back to "Medal <level>" when the item is missing', () => {
    vi.mocked(itemConfig).mockReturnValueOnce(undefined);
    expect(medalName(4)).toBe('Medal 4');
    expect(itemConfig).toHaveBeenCalledWith('hero.loyalty.4');
  });
});
