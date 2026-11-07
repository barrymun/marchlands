import { describe, expect, it } from 'vitest';
import {
  isPanel,
  isScreen,
  leavingPrefix,
  legacyHref,
  legacyTarget,
  pageAsPanelHref,
  PageId,
  PANEL_IDS,
  PanelId,
  screenHref,
  searchForCity,
  ViewId,
  viewOf,
} from '@/lib/nav';
import { hasScrollingPanes, MilitaryTab, ReportTab } from '@/lib/screen-search';

describe(isScreen.name, () => {
  it('knows the views and the pages', () => {
    expect(isScreen('town')).toBe(true);
    expect(isScreen('fields')).toBe(true);
    expect(isScreen('map')).toBe(true);
    expect(isScreen('reports')).toBe(true);
    expect(isScreen('military')).toBe(true);
  });

  it('turns down panels, old tabs and anything else', () => {
    expect(isScreen('research')).toBe(false);
    expect(isScreen('heroes')).toBe(false);
    expect(isScreen('buildings')).toBe(false);
    expect(isScreen('')).toBe(false);
  });
});

describe(isPanel.name, () => {
  it('knows the panels, and nothing else', () => {
    for (const p of PANEL_IDS) expect(isPanel(p)).toBe(true);
    expect(isPanel('map')).toBe(false);
    expect(isPanel('heroes')).toBe(false);
    expect(isPanel('nonsense')).toBe(false);
  });
});

describe(legacyTarget.name, () => {
  it('takes the city itself and the old City tab to the town', () => {
    expect(legacyTarget('')).toEqual({ screen: ViewId.TOWN });
    expect(legacyTarget('buildings')).toEqual({ screen: ViewId.TOWN });
  });

  it('opens an old tab that is now a panel over the town', () => {
    expect(legacyTarget('research')).toEqual({ screen: ViewId.TOWN, panel: PanelId.RESEARCH });
  });

  it('falls back to the town for an address it does not know', () => {
    expect(legacyTarget('nowhere')).toEqual({ screen: ViewId.TOWN });
  });
});

describe(legacyHref.name, () => {
  it("keeps the old Heroes page's place on the Military page", () => {
    expect(legacyHref(12, 'heroes', '?tab=gear')).toBe('/cities/12/military?tab=gear');
    expect(legacyHref(12, 'heroes', '?tab=inn')).toBe('/cities/12/military?tab=inn');
    expect(legacyHref(12, 'heroes', '?tab=heroes&hero=3')).toBe('/cities/12/military?tab=heroes&hero=3');
  });

  it('takes the old page with no tab to the Heroes tab, not the first', () => {
    expect(legacyHref(12, 'heroes', '')).toBe('/cities/12/military?tab=heroes');
    expect(legacyHref(12, 'heroes', '?hero=3')).toBe('/cities/12/military?tab=heroes&hero=3');
  });

  it('leaves any other address to legacyTarget', () => {
    expect(legacyHref(12, '', '')).toBe('/cities/12/town');
    expect(legacyHref(12, 'research', '?x=1')).toBe('/cities/12/town?panel=research');
  });
});

describe(pageAsPanelHref.name, () => {
  it('takes a page asked for as a panel to the page', () => {
    expect(pageAsPanelHref(12, PageId.MILITARY)).toBe('/cities/12/military');
    expect(pageAsPanelHref(12, PageId.REPORTS)).toBe('/cities/12/reports');
  });

  it('takes the old Heroes panel to the Heroes tab', () => {
    // eslint-disable-next-line marchlands/no-string-value -- the word in an old address, which has no name outside lib/nav.ts
    expect(pageAsPanelHref(12, 'heroes')).toBe('/cities/12/military?tab=heroes');
  });
});

describe(hasScrollingPanes.name, () => {
  it('is the tabs with two columns of their own', () => {
    expect(hasScrollingPanes(MilitaryTab.TROOPS)).toBe(true);
    expect(hasScrollingPanes(MilitaryTab.DEFENCES)).toBe(true);
  });

  it('leaves the tabs that scroll as a page', () => {
    for (const tab of [MilitaryTab.HEROES, MilitaryTab.GEAR, MilitaryTab.INN]) expect(hasScrollingPanes(tab)).toBe(false);
  });
});

describe(viewOf.name, () => {
  it('puts fields in the fields view and everything else in the town', () => {
    expect(viewOf(1001)).toBe(ViewId.FIELDS);
    expect(viewOf(1040)).toBe(ViewId.FIELDS);
    expect(viewOf(0)).toBe(ViewId.TOWN);
    expect(viewOf(-1)).toBe(ViewId.TOWN);
    expect(viewOf(-2)).toBe(ViewId.TOWN);
  });
});

describe(screenHref.name, () => {
  it('addresses a screen of a city', () => {
    expect(screenHref(12, ViewId.MAP)).toBe('/cities/12/map');
  });

  it("adds the screen's own search parameters, typed by the screen", () => {
    expect(screenHref(12, ViewId.FIELDS, { building: 1003 })).toBe('/cities/12/fields?building=1003');
    expect(screenHref(12, ViewId.TOWN, { building: -1 })).toBe('/cities/12/town?building=-1');
    expect(screenHref(12, PageId.MILITARY, { tab: MilitaryTab.INN })).toBe('/cities/12/military?tab=inn');
    expect(screenHref(12, PageId.REPORTS, { tab: ReportTab.ARMY, page: 2, report: 7 })).toBe('/cities/12/reports?tab=army&page=2&report=7');
    expect(screenHref(12, ViewId.MAP, { at: { x: 300, y: 500 } })).toBe('/cities/12/map?at=300%2C500');
  });

  it('leaves defaults and empty parameters out', () => {
    expect(screenHref(12, ViewId.TOWN, {})).toBe('/cities/12/town');
    expect(screenHref(12, PageId.MILITARY, { tab: MilitaryTab.TROOPS })).toBe('/cities/12/military');
  });

  it('adds the panel open over the screen', () => {
    expect(screenHref(12, ViewId.TOWN, undefined, PanelId.RESEARCH)).toBe('/cities/12/town?panel=research');
    expect(screenHref(12, PageId.MILITARY, { tab: MilitaryTab.GEAR }, PanelId.ITEMS)).toBe('/cities/12/military?tab=gear&panel=items');
  });

  it('takes only what the screen knows', () => {
    // @ts-expect-error -- the town takes a building's position, not a tab
    screenHref(12, ViewId.TOWN, { tab: MilitaryTab.GEAR });
    // @ts-expect-error -- a tab the Heroes page does not have
    screenHref(12, PageId.MILITARY, { tab: 'stats' });
    // @ts-expect-error -- the map takes a place, not a building
    screenHref(12, ViewId.MAP, { building: 1 });
    // @ts-expect-error -- the market has no parameters of its own
    screenHref(12, PageId.MARKET, { tab: MilitaryTab.GEAR });
  });
});

describe(leavingPrefix.name, () => {
  it("drops the open panel's parameters as it closes or another takes its place", () => {
    expect(leavingPrefix(PanelId.ITEMS, null)).toBe('items.');
    expect(leavingPrefix(PanelId.ITEMS, PanelId.RESEARCH)).toBe('items.');
  });

  it('drops nothing with no panel open, or when the same one opens again', () => {
    expect(leavingPrefix(null, PanelId.ITEMS)).toBeUndefined();
    expect(leavingPrefix(null, null)).toBeUndefined();
    expect(leavingPrefix(PanelId.ITEMS, PanelId.ITEMS)).toBeUndefined();
  });
});

describe(searchForCity.name, () => {
  it('keeps everything but the map’s place, so the map opens on the city switched to', () => {
    expect(searchForCity('?at=231%2C429')).toBe('');
    expect(searchForCity('?at=231%2C429&panel=items&items.q=horn')).toBe('?panel=items&items.q=horn');
    expect(searchForCity('?tab=gear&hero=4')).toBe('?tab=gear&hero=4');
    expect(searchForCity('')).toBe('');
  });
});
