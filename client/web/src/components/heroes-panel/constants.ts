/**
 * The Heroes page's tabs, in order; the first is shown when the address names none or one it doesn't know. `?tab=inn`
 * (the Inn's building, the mayor chip) shows the heroes with the Inn brought into view.
 */
export const HERO_TABS = ['heroes', 'gear'] as const;

/** How the Heroes tab can show the heroes, in the order of their buttons: a roster beside a character sheet, or cards. */
export const HERO_VIEWS = ['sheet', 'list'] as const;

/** Where this browser remembers the chosen view (localStorage). */
export const HERO_VIEW_KEY = 'marchlands-heroes-view';

/** Screens at least this wide may show the sheet (Tailwind's md); narrower ones always show the cards. */
export const HERO_VIEW_QUERY = '(min-width: 768px)';
