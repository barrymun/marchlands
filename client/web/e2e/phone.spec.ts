// The game on a phone (the mobile project, 375 px wide): the town and fields as cards, the tab bar, the menu sheet,
// panels over the whole screen, and nothing wider than the screen.
import type { Page } from '@playwright/test';

import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { openScreen, PAGES, PANELS, screenName, SCREENS, sidewaysScroll } from './support/screens.ts';
import { text } from './support/text.ts';

/** On a phone the bottom bar holds the three views and Menu (routes/game/tab-bar/). */
const tabBar = (page: Page) => page.getByRole('navigation', { name: text('game:mainMenu') });

test('the town and fields show as cards, which a tap opens', async ({ account, loggedIn: page }) => {
  for (const view of ['town', 'fields']) {
    await page.goto(`/cities/${account.city.id}/${view}`);
    // below md there's no Scene (its canvas and keyboard buttons): every slot is a card
    await expect(page.getByRole('application')).toHaveCount(0);
    await page
      .getByRole('button', { name: /^Build at slot \d+$/ })
      .first()
      .tap();
    await expect(page.getByRole('dialog', { name: text('buildings-panel:buildList.title') })).toBeVisible();
    await page.getByRole('button', { name: text('common:actions.close') }).tap();
  }
});

test('the tab bar moves between the views', async ({ account, loggedIn: page }) => {
  await expect(tabBar(page).getByRole('button')).toHaveText([screenName('town'), screenName('fields'), screenName('map'), text('game:menu')]);
  for (const view of ['fields', 'map', 'town']) {
    await tabBar(page)
      .getByRole('button', { name: screenName(view) })
      .tap();
    await expect(page).toHaveURL(new RegExp(`/cities/${account.city.id}/${view}(\\?|$)`));
  }
});

test('the menu sheet offers every page and panel, and a panel fills the screen', async ({ loggedIn: page }) => {
  await tabBar(page)
    .getByRole('button', { name: text('game:menu') })
    .tap();
  const sheet = page.getByRole('dialog', { name: text('game:menu') });
  await expect(sheet.getByRole('button', { name: new RegExp(`^(${[...PANELS, ...PAGES].map((id) => screenName(id)).join('|')})$`) })).toHaveText(
    [...PANELS, ...PAGES].map((id) => screenName(id)),
  );

  await expectAccessible(page, 'menu');

  await sheet.getByRole('button', { name: screenName('research') }).tap();
  const panel = page.getByRole('dialog', { name: screenName('research') });
  // it slides in from the side, still moving for a moment even with reduced motion
  await expect.poll(() => panel.boundingBox()).toMatchObject({ x: 0, y: 0, width: 375, height: 812 });
});

test('every screen fits the phone and passes axe', async ({ account, loggedIn: page }) => {
  for (const id of SCREENS) {
    await openScreen(page, account, id);
    expect(await sidewaysScroll(page), id).toEqual([]);
    await expectAccessible(page, id);
  }
});
