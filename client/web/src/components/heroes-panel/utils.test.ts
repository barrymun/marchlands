import { afterEach, describe, expect, it, vi } from 'vitest';

import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

import { HERO_VIEW_KEY } from '@/components/heroes-panel/constants';
import { heroesTab, readHeroView, saveHeroView, sheetHero } from '@/components/heroes-panel/utils';

describe(heroesTab.name, () => {
  it('takes the tab the address names', () => {
    expect(heroesTab('gear')).toBe('gear');
    expect(heroesTab('heroes')).toBe('heroes');
  });

  it('shows the heroes for the Inn, which sits beside them', () => {
    expect(heroesTab('inn')).toBe('heroes');
  });

  it('shows the heroes for no tab or one it does not know', () => {
    expect(heroesTab(null)).toBe('heroes');
    expect(heroesTab('nonsense')).toBe('heroes');
  });
});

describe(readHeroView.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the list when it was chosen, and the sheet otherwise', () => {
    vi.stubGlobal('localStorage', { getItem: (key: string) => (key === HERO_VIEW_KEY ? 'list' : null) });
    expect(readHeroView()).toBe('list');
    vi.stubGlobal('localStorage', { getItem: () => 'something else' });
    expect(readHeroView()).toBe('sheet');
    vi.stubGlobal('localStorage', { getItem: () => null });
    expect(readHeroView()).toBe('sheet');
  });

  it('falls back to the sheet when storage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readHeroView()).toBe('sheet');
  });
});

describe(saveHeroView.name, () => {
  afterEach(() => vi.unstubAllGlobals());

  it('stores the view under its key', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { setItem });
    saveHeroView('list');
    expect(setItem).toHaveBeenCalledWith(HERO_VIEW_KEY, 'list');
  });

  it('carries on when storage throws', () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveHeroView('sheet')).not.toThrow();
  });
});

describe(sheetHero.name, () => {
  const hero = (id: number, status: number = HeroStatus.IDLE) => ({ id, status }) as HeroBean;
  const heroes = [hero(1), hero(2, HeroStatus.MAYOR), hero(3)];

  it('shows the hero the address names', () => {
    expect(sheetHero(heroes, '3')?.id).toBe(3);
  });

  it('shows the mayor when the address names none, or a hero no longer here', () => {
    expect(sheetHero(heroes, null)?.id).toBe(2);
    expect(sheetHero(heroes, '99')?.id).toBe(2);
  });

  it('shows the first hero without a mayor, and none without heroes', () => {
    expect(sheetHero([hero(5), hero(6)], null)?.id).toBe(5);
    expect(sheetHero([], '1')).toBeNull();
  });
});
