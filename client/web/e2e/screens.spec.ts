// Every screen opens from the game's menus, its code fetched on first use (lib/lazy.ts): a screen whose file is
// missing or that throws while rendering fails here (the pageErrors fixture), not first in a player's browser. Each
// passes axe too.
import type { Page } from '@playwright/test';

import { expectAccessible } from './support/axe.ts';
import { expect, test } from './support/fixtures.ts';
import { loading, PAGES, PANELS, screenName, VIEWS } from './support/screens.ts';
import { text } from './support/text.ts';

const viewSwitch = (page: Page) => page.getByRole('navigation', { name: text('game:viewSwitch') });
const gameMenu = (page: Page) => page.getByRole('navigation', { name: text('game:mainMenu') });

test('the menus offer every screen, and only those', async ({ loggedIn: page }) => {
  await expect(viewSwitch(page).getByRole('button')).toHaveText(VIEWS.map((id) => screenName(id)));
  await expect(gameMenu(page).getByRole('button')).toHaveText([...PANELS, ...PAGES].map((id) => screenName(id)));
});

for (const id of [...VIEWS, ...PAGES]) {
  test(`the ${id} screen opens and passes axe`, async ({ account, loggedIn: page }) => {
    const menu = VIEWS.includes(id) ? viewSwitch(page) : gameMenu(page);
    // the town is where the page starts: go elsewhere first, so opening it is a move like the others
    if (id === 'town')
      await viewSwitch(page)
        .getByRole('button', { name: screenName('fields') })
        .click();
    await menu.getByRole('button', { name: screenName(id) }).click();
    await expect(page).toHaveURL(new RegExp(`/cities/${account.city.id}/${id}(\\?|$)`));
    await expect(loading(page)).toHaveCount(0);
    await expectAccessible(page, id);
  });
}

for (const id of PANELS) {
  test(`the ${id} panel opens and passes axe`, async ({ loggedIn: page }) => {
    await gameMenu(page)
      .getByRole('button', { name: screenName(id) })
      .click();
    await expect(page.getByRole('dialog', { name: screenName(id) })).toBeVisible();
    await expect(loading(page)).toHaveCount(0);
    await expectAccessible(page, id);
  });
}
