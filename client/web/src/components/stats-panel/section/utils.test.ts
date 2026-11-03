import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionId, TABLES_KEY } from '@/components/stats-panel/section/constants';
import { readShowTable, storeShowTable } from '@/components/stats-panel/section/utils';

/** A localStorage stand-in backed by a map. */
function fakeStorage(start: Record<string, string> = {}) {
  const items = new Map(Object.entries(start));
  return {
    getItem: (k: string) => items.get(k) ?? null,
    setItem: (k: string, v: string) => void items.set(k, v),
    items,
  };
}

describe(readShowTable.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is true for a section stored as showing its table', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [TABLES_KEY]: JSON.stringify([SectionId.TROOPS]) }));
    expect(readShowTable(SectionId.TROOPS)).toBe(true);
    expect(readShowTable(SectionId.SPENDING)).toBe(false);
  });

  it('is false with nothing stored, or something unreadable', () => {
    vi.stubGlobal('localStorage', fakeStorage());
    expect(readShowTable(SectionId.TROOPS)).toBe(false);
    vi.stubGlobal('localStorage', fakeStorage({ [TABLES_KEY]: '{not json' }));
    expect(readShowTable(SectionId.TROOPS)).toBe(false);
    vi.stubGlobal('localStorage', fakeStorage({ [TABLES_KEY]: JSON.stringify({ troops: true }) }));
    expect(readShowTable(SectionId.TROOPS)).toBe(false);
  });

  it('is false when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readShowTable(SectionId.RESOURCES)).toBe(false);
  });

  it('ignores ids that are not sections', () => {
    vi.stubGlobal('localStorage', fakeStorage({ [TABLES_KEY]: JSON.stringify(['heroes', 3, SectionId.RESOURCES]) }));
    expect(readShowTable(SectionId.RESOURCES)).toBe(true);
  });
});

describe(storeShowTable.name, () => {
  let storage: ReturnType<typeof fakeStorage>;
  beforeEach(() => {
    storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('adds a section showing its table, once', () => {
    storeShowTable(SectionId.TROOPS, true);
    storeShowTable(SectionId.SPENDING, true);
    storeShowTable(SectionId.TROOPS, true);
    expect(JSON.parse(storage.items.get(TABLES_KEY) ?? '')).toEqual([SectionId.SPENDING, SectionId.TROOPS]);
  });

  it('takes a section back to its chart', () => {
    storeShowTable(SectionId.TROOPS, true);
    storeShowTable(SectionId.TROOPS, false);
    expect(readShowTable(SectionId.TROOPS)).toBe(false);
  });

  it('does nothing when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(() => storeShowTable(SectionId.TROOPS, true)).not.toThrow();
  });
});
