// Where things are in the game: the views shown in the viewport (the town, the fields, the map), the pages that take
// its place for the heavier screens, and the panels that slide over it for the lighter ones. A view or page is the
// address's last part (/cities/12/map), a panel the `panel` search parameter (/cities/12/town?panel=research), so the
// browser's back button closes a panel and every screen can be linked to.

import { isOuterPosition } from '@marchlands/core';
import { BUILDING_SEARCH, HEROES_SEARCH, MAP_SEARCH, REPORT_SEARCH } from '@/lib/screen-search';
import { param, type SearchSchema, type SearchValues, writeSearch } from '@/lib/search-state';

/** The views of the viewport, in the order of the switch. */
export const ViewId = { TOWN: 'town', FIELDS: 'fields', MAP: 'map' } as const;
export type ViewId = (typeof ViewId)[keyof typeof ViewId];
export const VIEW_IDS = Object.values(ViewId);

/** The heavier screens, each a page in the viewport's place. */
export const PageId = { HEROES: 'heroes', REPORTS: 'reports', MARKET: 'market', FLOWS: 'flows', STATS: 'stats' } as const;
export type PageId = (typeof PageId)[keyof typeof PageId];
const PAGE_IDS = Object.values(PageId);

/** The lighter screens, each a panel over the view. */
export const PanelId = { MILITARY: 'military', RESEARCH: 'research', ITEMS: 'items', ARMIES: 'armies', PLANS: 'plans', FACTIONS: 'factions' } as const;
export type PanelId = (typeof PanelId)[keyof typeof PanelId];
export const PANEL_IDS = Object.values(PanelId);

export type ScreenId = ViewId | PageId;

/** Whether an address part names a view or a page. */
export function isScreen(s: string): s is ScreenId {
  return (VIEW_IDS as readonly string[]).includes(s) || (PAGE_IDS as readonly string[]).includes(s);
}

/** Whether a `panel` parameter names a panel. */
export function isPanel(s: string): s is PanelId {
  return (PANEL_IDS as readonly string[]).includes(s);
}

/**
 * Where an address part that is not a screen leads: nothing (the city's own address) and the old City tab to the town,
 * an old tab that is now a panel to that panel over the town; anything else to the town too.
 */
export function legacyTarget(part: string): { screen: ScreenId; panel?: PanelId } {
  return isPanel(part) ? { screen: ViewId.TOWN, panel: part } : { screen: ViewId.TOWN };
}

/** The view a building stands in: the fields for a field, the town for the rest (the Town Hall and the Walls too). */
export function viewOf(positionId: number): ViewId {
  return isOuterPosition(positionId) ? ViewId.FIELDS : ViewId.TOWN;
}

/**
 * The search parameters of every screen: the panel open over it. It may also name a page, in an address from before
 * that page was one (`?panel=heroes`), which the game page redirects.
 */
export const GAME_SEARCH = {
  panel: param.maybe([...PANEL_IDS, ...PAGE_IDS]),
} satisfies SearchSchema;

/** Where a panel's own search parameters are named (`items.q`), apart from the page under it. */
export const panelPrefix = (panel: PanelId) => `${panel}.`;

/** The prefix of the open panel's own parameters, to drop as `next` takes its place (null: the panel closes); none when no panel is open or it stays. */
export function leavingPrefix(open: PanelId | null, next: PanelId | null): string | undefined {
  return open && open !== next ? panelPrefix(open) : undefined;
}

/** Each screen's own search parameters (lib/screen-search.ts), for the links to it. */
const SCREEN_SEARCH = {
  [ViewId.TOWN]: BUILDING_SEARCH,
  [ViewId.FIELDS]: BUILDING_SEARCH,
  [ViewId.MAP]: MAP_SEARCH,
  [PageId.HEROES]: HEROES_SEARCH,
  [PageId.REPORTS]: REPORT_SEARCH,
} satisfies Partial<Record<ScreenId, SearchSchema>>;
const SCREEN_SCHEMAS: Partial<Record<ScreenId, SearchSchema>> = SCREEN_SEARCH;

/** What a link to a screen may set in its address; nothing for a screen with no parameters of its own. */
export type ScreenSearch<S extends ScreenId> = S extends keyof typeof SCREEN_SEARCH ? Partial<SearchValues<(typeof SCREEN_SEARCH)[S]>> : never;

/** The address of a screen of a city, with its own search parameters (a tab, a building to open) and a panel over it. */
export function screenHref<S extends ScreenId>(cityId: number, screen: S, search?: ScreenSearch<S>, panel?: PanelId): string {
  let params = new URLSearchParams();
  const schema = SCREEN_SCHEMAS[screen];
  if (schema && search) params = writeSearch(schema, params, search);
  if (panel) params = writeSearch(GAME_SEARCH, params, { panel });
  const q = params.toString();
  return `/cities/${cityId}/${screen}${q ? `?${q}` : ''}`;
}
