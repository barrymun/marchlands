/** How the Heroes tab can show the heroes: a roster beside a character sheet, or cards. Remembered in localStorage (HERO_VIEW_KEY), so a value never changes. */
export const HeroView = { SHEET: 'sheet', LIST: 'list' } as const;
export type HeroView = (typeof HeroView)[keyof typeof HeroView];
/** The views in the order of their buttons. */
export const HERO_VIEWS = Object.values(HeroView);

/** Where this browser remembers the chosen view (localStorage). */
export const HERO_VIEW_KEY = 'marchlands-heroes-view';

/** Screens at least this wide may show the sheet (Tailwind's md); narrower ones always show the cards. */
export const HERO_VIEW_QUERY = '(min-width: 768px)';
