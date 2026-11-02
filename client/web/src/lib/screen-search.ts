// The search parameters of the screens that other screens link to (`useGameNav`'s `go`, typed by lib/nav.ts), and the
// values those links use. Each screen reads its own with `useSearchState`; a link writes them through `go`, so a
// misspelt name or a value the screen doesn't know fails the typecheck. Only what links need lives here: a screen's
// other constants stay in its own folder.

import { isValidPosition, REPORT_KINDS, REPORT_ORDERS, REPORT_SEARCH_MAX, ReportOrder } from '@marchlands/core';
import { param, type SearchSchema } from '@/lib/search-state';

/** What the Heroes page's `tab` can name: its two tabs, and the Inn (the heroes, with the Inn brought into view). */
export const HeroTab = { HEROES: 'heroes', GEAR: 'gear', INN: 'inn' } as const;
export type HeroTab = (typeof HeroTab)[keyof typeof HeroTab];

/** The Reports page's tabs. */
export const ReportTab = { ALL: 'all', ARMY: 'army', TRADE: 'trade', OTHER: 'other' } as const;
export type ReportTab = (typeof ReportTab)[keyof typeof ReportTab];

/** The Town and Fields views: `building` (a position) opens that building's dialog, once (the activity dock). */
export const BUILDING_SEARCH = {
  building: param.int(isValidPosition),
} satisfies SearchSchema;

/**
 * The world map: the place last gone to (the go-to box, a valley or a farming target), where it opens again after a
 * reload, selected; going back to the city clears it.
 */
export const MAP_SEARCH = {
  at: param.point(),
} satisfies SearchSchema;

/** The Heroes page: the tab, or the Inn, and the hero on the sheet. */
export const HEROES_SEARCH = {
  tab: param.oneOf(Object.values(HeroTab), HeroTab.HEROES),
  hero: param.id(),
} satisfies SearchSchema;

/**
 * The Reports page: the tab, the filters, the order, the page and the report open, so a reload or a shared link lands
 * on the same list with the same report open.
 */
export const REPORT_SEARCH = {
  tab: param.oneOf(Object.values(ReportTab), ReportTab.ALL),
  q: param.text(REPORT_SEARCH_MAX),
  kind: param.maybe(REPORT_KINDS),
  unread: param.flag(),
  order: param.oneOf(REPORT_ORDERS, ReportOrder.NEWEST),
  page: param.page(),
  report: param.id(),
} satisfies SearchSchema;
