import { lazyComponent } from '@/lib/lazy';
import { MilitaryTab } from '@/lib/screen-search';

/**
 * The Military page's tabs, in order; the first is shown when the address names none or one it doesn't know. `?tab=inn`
 * (the Inn's building, the mayor chip) shows the heroes with the Inn brought into view.
 */
export const MILITARY_TABS = [MilitaryTab.TROOPS, MilitaryTab.DEFENCES, MilitaryTab.HEROES, MilitaryTab.GEAR] as const;

// Each tab's code is a file of its own, so a tab's own code isn't held up by the others'.
export const TroopsTab = lazyComponent(() => import('@/components/military-panel/troops-tab/troops-tab').then((m) => m.TroopsTab));
export const DefencesTab = lazyComponent(() => import('@/components/military-panel/defences-tab/defences-tab').then((m) => m.DefencesTab));
export const HeroesPanel = lazyComponent(() => import('@/components/heroes-panel/heroes-panel').then((m) => m.HeroesPanel));
export const GearCard = lazyComponent(() => import('@/components/hero-gear/gear-card/gear-card').then((m) => m.GearCard));

/** What the page's code starts fetching as it loads (routes/game/constants.ts), so a tab opens at once. */
export const MILITARY_TAB_CODE = [TroopsTab, DefencesTab, HeroesPanel, GearCard];
