import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORE_KEY } from '@/components/activity-dock/constants';
import { readCollapsed } from '@/components/activity-dock/utils';

/** A localStorage stand-in holding `stored` under STORE_KEY (nothing else). */
const storage = (stored: string | null) => ({ getItem: vi.fn((key: string) => (key === STORE_KEY ? stored : null)) });

/** A window whose matchMedia reports `matches` for every query. */
const windowWith = (matches: boolean) => ({ matchMedia: vi.fn(() => ({ matches })) });

describe(readCollapsed.name, () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when the stored flag is "1"', () => {
    const win = windowWith(false);
    vi.stubGlobal('localStorage', storage('1'));
    vi.stubGlobal('window', win);
    expect(readCollapsed()).toBe(true);
    expect(win.matchMedia).not.toHaveBeenCalled();
  });

  it('returns false when the stored flag is "0", even on a phone', () => {
    const win = windowWith(true);
    vi.stubGlobal('localStorage', storage('0'));
    vi.stubGlobal('window', win);
    expect(readCollapsed()).toBe(false);
    expect(win.matchMedia).not.toHaveBeenCalled();
  });

  it('treats any stored value other than "1" as expanded', () => {
    vi.stubGlobal('localStorage', storage('yes'));
    vi.stubGlobal('window', windowWith(true));
    expect(readCollapsed()).toBe(false);
  });

  it('reads the dock key from storage', () => {
    const store = storage('1');
    vi.stubGlobal('localStorage', store);
    readCollapsed();
    expect(store.getItem).toHaveBeenCalledWith('marchlands-activity-collapsed');
  });

  it('falls back to the phone media query when nothing is stored', () => {
    const win = windowWith(true);
    vi.stubGlobal('localStorage', storage(null));
    vi.stubGlobal('window', win);
    expect(readCollapsed()).toBe(true);
    expect(win.matchMedia).toHaveBeenCalledWith('(max-width: 639px)');
  });

  it('starts expanded on wider screens when nothing is stored', () => {
    vi.stubGlobal('localStorage', storage(null));
    vi.stubGlobal('window', windowWith(false));
    expect(readCollapsed()).toBe(false);
  });

  it('falls back to the media query when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    vi.stubGlobal('window', windowWith(true));
    expect(readCollapsed()).toBe(true);
  });

  it('returns false without a window (server rendering)', () => {
    vi.stubGlobal('localStorage', storage(null));
    vi.stubGlobal('window', undefined);
    expect(readCollapsed()).toBe(false);
  });
});
