import { describe, expect, it } from 'vitest';
import { isPanel, isScreen, legacyTarget, pageOfPanel, PANEL_IDS, screenHref, viewOf } from '@/lib/nav';

describe(isScreen.name, () => {
  it('knows the views and the pages', () => {
    expect(isScreen('town')).toBe(true);
    expect(isScreen('fields')).toBe(true);
    expect(isScreen('map')).toBe(true);
    expect(isScreen('reports')).toBe(true);
    expect(isScreen('heroes')).toBe(true);
  });

  it('turns down panels, old tabs and anything else', () => {
    expect(isScreen('military')).toBe(false);
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

describe(pageOfPanel.name, () => {
  it('names the page a panel became', () => {
    expect(pageOfPanel('heroes')).toBe('heroes');
  });

  it('gives nothing for a panel, a view, or no parameter', () => {
    expect(pageOfPanel('research')).toBeNull();
    expect(pageOfPanel('town')).toBeNull();
    expect(pageOfPanel(null)).toBeNull();
  });
});

describe(legacyTarget.name, () => {
  it('takes the city itself and the old City tab to the town', () => {
    expect(legacyTarget('')).toEqual({ screen: 'town' });
    expect(legacyTarget('buildings')).toEqual({ screen: 'town' });
  });

  it('opens an old tab that is now a panel over the town', () => {
    expect(legacyTarget('research')).toEqual({ screen: 'town', panel: 'research' });
  });

  it('falls back to the town for an address it does not know', () => {
    expect(legacyTarget('nowhere')).toEqual({ screen: 'town' });
  });
});

describe(viewOf.name, () => {
  it('puts fields in the fields view and everything else in the town', () => {
    expect(viewOf(1001)).toBe('fields');
    expect(viewOf(1040)).toBe('fields');
    expect(viewOf(0)).toBe('town');
    expect(viewOf(-1)).toBe('town');
    expect(viewOf(-2)).toBe('town');
  });
});

describe(screenHref.name, () => {
  it('addresses a screen of a city', () => {
    expect(screenHref(12, 'map')).toBe('/cities/12/map');
  });

  it('adds search parameters when there are any', () => {
    expect(screenHref(12, 'town', { panel: 'research' })).toBe('/cities/12/town?panel=research');
    expect(screenHref(12, 'fields', { building: '1003' })).toBe('/cities/12/fields?building=1003');
    expect(screenHref(12, 'town', {})).toBe('/cities/12/town');
  });
});
