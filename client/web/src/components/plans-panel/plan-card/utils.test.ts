import { afterEach, describe, expect, it, vi } from 'vitest';
import { MAX_STORED, STORE_KEY } from '@/components/plans-panel/plan-card/constants';
import { readCollapsed, storeCollapsed } from '@/components/plans-panel/plan-card/utils';

/** A localStorage stand-in holding `stored` under STORE_KEY. */
function storage(stored: string | null) {
  const items = new Map<string, string>(stored == null ? [] : [[STORE_KEY, stored]]);
  return {
    getItem: vi.fn((key: string) => items.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => void items.set(key, value)),
  };
}

const throwing = () => ({
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
});

describe(readCollapsed.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true for a stored id and false for any other', () => {
    vi.stubGlobal('localStorage', storage('[3,7]'));
    expect(readCollapsed(7)).toBe(true);
    expect(readCollapsed(4)).toBe(false);
  });

  it('is false when nothing is stored', () => {
    vi.stubGlobal('localStorage', storage(null));
    expect(readCollapsed(1)).toBe(false);
  });

  it('ignores what is not a list of ids', () => {
    vi.stubGlobal('localStorage', storage('{"7":true}'));
    expect(readCollapsed(7)).toBe(false);
    vi.stubGlobal('localStorage', storage('not json'));
    expect(readCollapsed(7)).toBe(false);
    vi.stubGlobal('localStorage', storage('["7", 7.5, null]'));
    expect(readCollapsed(7)).toBe(false);
  });

  it('is false when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwing());
    expect(readCollapsed(7)).toBe(false);
  });
});

describe(storeCollapsed.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds a collapsed plan once, latest last', () => {
    const store = storage('[3,7]');
    vi.stubGlobal('localStorage', store);
    storeCollapsed(3, true);
    expect(store.setItem).toHaveBeenLastCalledWith(STORE_KEY, '[7,3]');
    expect(readCollapsed(3)).toBe(true);
  });

  it('drops a plan opened again', () => {
    const store = storage('[3,7]');
    vi.stubGlobal('localStorage', store);
    storeCollapsed(7, false);
    expect(store.setItem).toHaveBeenLastCalledWith(STORE_KEY, '[3]');
    expect(readCollapsed(7)).toBe(false);
  });

  it('keeps only the latest MAX_STORED ids', () => {
    const store = storage(JSON.stringify(Array.from({ length: MAX_STORED }, (_, i) => i + 1)));
    vi.stubGlobal('localStorage', store);
    storeCollapsed(1000, true);
    expect(readCollapsed(1)).toBe(false);
    expect(readCollapsed(2)).toBe(true);
    expect(readCollapsed(1000)).toBe(true);
  });

  it('does nothing when storage is unavailable', () => {
    vi.stubGlobal('localStorage', throwing());
    expect(() => storeCollapsed(7, true)).not.toThrow();
  });
});
