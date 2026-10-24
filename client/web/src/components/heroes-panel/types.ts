import type { HERO_VIEWS } from '@/components/heroes-panel/constants';

/** How the Heroes tab shows the heroes. */
export type HeroView = (typeof HERO_VIEWS)[number];
