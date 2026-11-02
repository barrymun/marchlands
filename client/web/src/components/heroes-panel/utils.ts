import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

import { HERO_VIEW_KEY } from '@/components/heroes-panel/constants';
import type { HeroView } from '@/components/heroes-panel/types';

/** How this browser last chose to show the heroes: the sheet unless the cards were picked. */
export function readHeroView(): HeroView {
  try {
    return localStorage.getItem(HERO_VIEW_KEY) === 'list' ? 'list' : 'sheet';
  } catch {
    return 'sheet';
  }
}

/** Remember the chosen view; without storage it lasts until the page reloads. */
export function saveHeroView(view: HeroView) {
  try {
    localStorage.setItem(HERO_VIEW_KEY, view);
  } catch {
    /* storage unavailable */
  }
}

/** The hero the sheet shows: the one the address names (`hero`), else the mayor, else the first; none without heroes. */
export function sheetHero(heroes: readonly HeroBean[], id: number | null): HeroBean | null {
  return heroes.find((h) => h.id === id) ?? heroes.find((h) => h.status === HeroStatus.MAYOR) ?? heroes[0] ?? null;
}
