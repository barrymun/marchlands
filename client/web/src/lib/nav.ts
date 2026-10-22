// Where things are in the game: the views shown in the viewport (the town, the fields, the map), the pages that take
// its place for the heavier screens, and the panels that slide over it for the lighter ones. A view or page is the
// address's last part (/cities/12/map), a panel the `panel` search parameter (/cities/12/town?panel=research), so the
// browser's back button closes a panel and every screen can be linked to.

import { isOuterPosition } from '@marchlands/core';

/** The views of the viewport, in the order of the switch. */
export const VIEW_IDS = ['town', 'fields', 'map'] as const;
/** The heavier screens, each a page in the viewport's place. */
const PAGE_IDS = ['reports', 'market', 'flows', 'stats'] as const;
/** The lighter screens, each a panel over the view. */
export const PANEL_IDS = ['military', 'heroes', 'research', 'items', 'armies', 'factions'] as const;

export type ViewId = (typeof VIEW_IDS)[number];
export type PageId = (typeof PAGE_IDS)[number];
export type ScreenId = ViewId | PageId;
export type PanelId = (typeof PANEL_IDS)[number];

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
  return isPanel(part) ? { screen: 'town', panel: part } : { screen: 'town' };
}

/** The view a building stands in: the fields for a field, the town for the rest (the Town Hall and the Walls too). */
export function viewOf(positionId: number): ViewId {
  return isOuterPosition(positionId) ? 'fields' : 'town';
}

/** The address of a screen of a city, with search parameters (a panel, a building to open). */
export function screenHref(cityId: number, screen: ScreenId, search?: Record<string, string>): string {
  const q = search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : '';
  return `/cities/${cityId}/${screen}${q}`;
}
