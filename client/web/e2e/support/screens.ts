// The game's screens (client/web/src/lib/nav.ts: ViewId, PageId, PanelId), and checks every screen should pass.
import { expect, type Page } from '@playwright/test';
import type { Account } from './accounts.ts';
import { text } from './text.ts';

/** A new screen goes here too, or the menu tests fail (screens.spec.ts, phone.spec.ts). */
export const VIEWS = ['town', 'fields', 'map'];
export const PAGES = ['military', 'reports', 'market', 'flows', 'stats'];
export const PANELS = ['research', 'items', 'armies', 'plans', 'factions'];

export const SCREENS = [...VIEWS, ...PAGES, ...PANELS];

/** What a screen is called in the menus, in the locale the page is in. */
export const screenName = (id: string, locale?: string) => text(`game:nav.${id}`, {}, locale);

/** Still loading: the placeholder a screen shows while its code or its data is on the way (components/ui/skeleton). */
export const loading = (page: Page) => page.locator('[data-slot="skeleton"]');

/**
 * Go straight to a screen by its address (a view or page is the address's last part, a panel the `panel` parameter)
 * and wait until it's shown: the panel, or for the rest the city's name in the top bar, then nothing left loading.
 */
export async function openScreen(page: Page, account: Account, id: string, locale?: string) {
  const panel = PANELS.includes(id);
  await page.goto(`/cities/${account.city.id}/${panel ? `town?panel=${id}` : id}`);
  // with a panel open, the page behind it is hidden from the accessibility tree, the top bar too
  const shown = panel
    ? page.getByRole('dialog', { name: screenName(id, locale) })
    : page.getByRole('banner').getByRole('button', { name: new RegExp(`^${account.city.name}`) });
  await expect(shown).toBeVisible();
  await expect(loading(page)).toHaveCount(0);
}

/**
 * The page's own scroll areas that scroll sideways: the document, `main` (which scrolls by itself, game.tsx) and an
 * open panel. A part of a screen made to scroll sideways (the Items panel's tabs) isn't one of them.
 */
export function sidewaysScroll(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [document.documentElement, ...document.querySelectorAll('main, [role="dialog"]')]
      .filter((e) => e.scrollWidth > e.clientWidth + 1)
      .map((e) => `${e.tagName.toLowerCase()} ${e.scrollWidth} px wide in ${e.clientWidth}`),
  );
}
