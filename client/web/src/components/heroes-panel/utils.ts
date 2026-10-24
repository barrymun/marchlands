import type { HeroBean } from '@marchlands/api-client';
import { HeroStatus } from '@marchlands/core';

import { HERO_TABS, HERO_VIEW_KEY } from '@/components/heroes-panel/constants';
import type { HeroView } from '@/components/heroes-panel/types';

/** The tab a `tab` search parameter names, or the first (the heroes) for none or one it doesn't know. */
export function heroesTab(param: string | null): (typeof HERO_TABS)[number] {
  return HERO_TABS.find((tab) => tab === param) ?? HERO_TABS[0];
}

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

/** The hero the sheet shows: the one a `hero` search parameter names, else the mayor, else the first; none without heroes. */
export function sheetHero(heroes: readonly HeroBean[], param: string | null): HeroBean | null {
  return heroes.find((h) => String(h.id) === param) ?? heroes.find((h) => h.status === HeroStatus.MAYOR) ?? heroes[0] ?? null;
}
