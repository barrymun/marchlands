// The search parameters of the screens that other screens link to (`useGameNav`'s `go`, typed by lib/nav.ts), and the
// values those links use. Each screen reads its own with `useSearchState`; a link writes them through `go`, so a
// misspelt name or a value the screen doesn't know fails the typecheck. Only what links need lives here: a screen's
// other constants stay in its own folder.

import { isValidPosition, REPORT_KINDS, REPORT_ORDERS, REPORT_SEARCH_MAX, ReportOrder } from '@marchlands/core';
import { param, type SearchSchema } from '@/lib/search-state';

/** What the Military page's `tab` can name: its four tabs, and the Inn (the heroes, with the Inn brought into view). */
export const MilitaryTab = { TROOPS: 'troops', DEFENCES: 'defences', HEROES: 'heroes', GEAR: 'gear', INN: 'inn' } as const;
export type MilitaryTab = (typeof MilitaryTab)[keyof typeof MilitaryTab];

/** Whether a Military page tab has two columns that scroll apart from xl up, filling the viewport; the others scroll as a page. */
export const hasScrollingPanes = (tab: MilitaryTab) => tab === MilitaryTab.TROOPS || tab === MilitaryTab.DEFENCES;

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

/** The Military page: the tab, or the Inn, and the hero on the sheet. */
export const MILITARY_SEARCH = {
  tab: param.oneOf(Object.values(MilitaryTab), MilitaryTab.TROOPS),
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
