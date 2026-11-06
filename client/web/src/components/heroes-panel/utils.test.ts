import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

import { HERO_VIEW_KEY, HeroView } from '@/components/heroes-panel/constants';
import { readHeroView, saveHeroView, sheetHero } from '@/components/heroes-panel/utils';

describe(readHeroView.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the list when it was chosen, and the sheet otherwise', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === HERO_VIEW_KEY ? 'list' : null) });
    expect(readHeroView()).toBe(HeroView.LIST);
    vi.stubGlobal('localStorage', { getItem: () => 'something else' });
    expect(readHeroView()).toBe(HeroView.SHEET);
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readHeroView()).toBe(HeroView.SHEET);
  });

  it('falls back to the sheet when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readHeroView()).toBe(HeroView.SHEET);
  });
});

describe(saveHeroView.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores the view under its key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveHeroView(HeroView.LIST);
    expect(setItem).toHaveBeenCalledWith(HERO_VIEW_KEY, 'list');
  });

  it('carries on when storage throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveHeroView(HeroView.SHEET)).not.toThrow();
  });
});

describe(sheetHero.name, () => {
  const hero = (id: number, status: number = HeroStatus.IDLE) => ({ id, status }) as HeroBean;
  const heroes = [hero(1), hero(2, HeroStatus.MAYOR), hero(3)];

  it('shows the hero the address names', () => {
    expect(sheetHero(heroes, 3)?.id).toBe(3);
  });

  it('shows the mayor when the address names none, or a hero no longer here', () => {
    expect(sheetHero(heroes, null)?.id).toBe(2);
    expect(sheetHero(heroes, 99)?.id).toBe(2);
  });

  it('shows the first hero without a mayor, and none without heroes', () => {
    expect(sheetHero([hero(5), hero(6)], null)?.id).toBe(5);
    expect(sheetHero([], 1)).toBeNull();
  });
});
