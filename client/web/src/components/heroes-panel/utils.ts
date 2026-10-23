import { HERO_TABS } from '@/components/heroes-panel/constants';

/** The tab a `tab` search parameter names, or the first (the heroes) for none or one it doesn't know. */
export function heroesTab(param: string | null): (typeof HERO_TABS)[number] {
  return HERO_TABS.find((tab) => tab === param) ?? HERO_TABS[0];
}
